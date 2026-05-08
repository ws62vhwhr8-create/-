import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getContainer, MilestoneFile } from '@/lib/cosmos'
import { getGraphClient } from '@/lib/microsoft-graph'

const toSharePointDownloadUrl = (rawUrl: string): string => {
  const url = new URL(rawUrl)
  const isSharePointListView = /\/Forms\/AllItems\.aspx$/i.test(url.pathname)
  const sourceId = url.searchParams.get('id')

  if (isSharePointListView && sourceId) {
    const decodedPath = decodeURIComponent(sourceId)
    if (decodedPath.startsWith('/')) {
      const sourceUrl = `${url.origin}${decodedPath}`
      return `${url.origin}/_layouts/15/download.aspx?SourceUrl=${encodeURIComponent(sourceUrl)}`
    }
  }

  if (!url.searchParams.has('download')) {
    url.searchParams.set('download', '1')
  }
  return url.toString()
}

const isSharePointUrl = (rawUrl: string): boolean => {
  try {
    const url = new URL(rawUrl)
    return url.hostname.toLowerCase().includes('.sharepoint.com')
  } catch {
    return false
  }
}

const toGraphShareId = (rawUrl: string): string => {
  const encoded = Buffer.from(rawUrl, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
  return `u!${encoded}`
}

const resolveDownloadUrlWithGraph = async (rawUrl: string): Promise<string | null> => {
  try {
    const client = getGraphClient()
    const shareId = toGraphShareId(rawUrl)
    const driveItem = await client.api(`/shares/${shareId}/driveItem`).get()
    const graphDownloadUrl = driveItem?.['@microsoft.graph.downloadUrl'] as string | undefined
    return graphDownloadUrl || null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')

    if (!fileId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const container = await getContainer()
    const { resources } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: fileId }],
      })
      .fetchAll()

    if (resources.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = resources[0] as MilestoneFile

    if (file.base64Content) {
      const [, payload = ''] = file.base64Content.split(',')
      const bytes = Buffer.from(payload, 'base64')
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          'Content-Type': file.fileType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    if (!file.contentUrl) {
      return NextResponse.json({ error: 'No content URL for this file' }, { status: 400 })
    }

    const graphResolvedUrl = isSharePointUrl(file.contentUrl)
      ? await resolveDownloadUrlWithGraph(file.contentUrl)
      : null

    let resolvedUrl = graphResolvedUrl || toSharePointDownloadUrl(file.contentUrl)
    let upstream = await fetch(resolvedUrl, {
      headers: {
        Accept: '*/*',
      },
      redirect: 'follow',
      cache: 'no-store',
    })

    // Legacy links may return an HTML page (200) instead of file bytes.
    const upstreamContentType = upstream.headers.get('content-type') || ''
    const returnedHtml = upstreamContentType.toLowerCase().includes('text/html')

    if (
      isSharePointUrl(file.contentUrl) &&
      (!upstream.ok || returnedHtml)
    ) {
      const fallbackUrl = toSharePointDownloadUrl(file.contentUrl)
      if (fallbackUrl !== resolvedUrl) {
        resolvedUrl = fallbackUrl
        upstream = await fetch(resolvedUrl, {
          headers: {
            Accept: '*/*',
          },
          redirect: 'follow',
          cache: 'no-store',
        })
      }
    }

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      return NextResponse.json(
        { error: `Upstream fetch failed: ${upstream.status} ${detail.slice(0, 120)}` },
        { status: 502 },
      )
    }

    const contentType = upstream.headers.get('content-type') || file.fileType || 'application/octet-stream'
    const arrayBuffer = await upstream.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `File content fetch failed: ${message}` }, { status: 500 })
  }
}
