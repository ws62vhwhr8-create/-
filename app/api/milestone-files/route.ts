import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getContainer, MilestoneFile } from '@/lib/cosmos'
import { syncMilestoneFileToSharePoint } from '@/lib/microsoft-graph'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const milestoneId = searchParams.get('milestoneId')
    const noteId = searchParams.get('noteId')
    const parentFolderId = searchParams.get('parentFolderId')

    if (!milestoneId) {
      return NextResponse.json(
        { error: 'milestoneId is required' },
        { status: 400 }
      )
    }

    try {
      const container = await getContainer()

      let query = `SELECT * FROM c WHERE c.milestoneId = @milestoneId`
      const parameters = [{ name: '@milestoneId', value: milestoneId }]

      if (noteId) {
        query += ` AND c.noteId = @noteId`
        parameters.push({ name: '@noteId', value: noteId })
      } else {
        query += ` AND (c.noteId = null OR NOT IS_DEFINED(c.noteId))`
      }

      if (parentFolderId) {
        query += ` AND c.parentFolderId = @parentFolderId`
        parameters.push({ name: '@parentFolderId', value: parentFolderId })
      } else {
        query += ` AND (c.parentFolderId = null OR NOT IS_DEFINED(c.parentFolderId))`
      }

      const { resources } = await container.items.query({ query, parameters }).fetchAll()

      return NextResponse.json(resources)
    } catch (cosmosError) {
      console.error('Cosmos DB error:', cosmosError)
      const errorMessage = cosmosError instanceof Error ? cosmosError.message : 'Cosmos DB query failed'
      return NextResponse.json(
        { error: `Cosmos DB 오류: ${errorMessage}. 환경 변수를 확인하세요.` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error fetching files:', error)
    return NextResponse.json(
      { error: `파일 조회 오류: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { milestoneId, noteId, fileName, fileSize, fileType, base64Content, kind, isFolder, parentFolderId, folderPath } = body

    if (!milestoneId || !fileName) {
      return NextResponse.json(
        { error: 'milestoneId and fileName are required' },
        { status: 400 }
      )
    }

    try {
      const container = await getContainer()

      const file: MilestoneFile = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        milestoneId,
        noteId: noteId || null,
        parentFolderId: parentFolderId || null,
        folderPath: Array.isArray(folderPath)
          ? folderPath.filter((segment: unknown): segment is string => typeof segment === 'string')
          : [],
        fileName,
        fileSize,
        fileType,
        isFolder: Boolean(isFolder),
        uploadedAt: new Date().toISOString(),
        uploadedBy: (session.user as { id?: string; email?: string } | undefined)?.id ?? session.user?.email ?? undefined,
        base64Content: base64Content || undefined,
        kind,
      }

      const { resource } = await container.items.create(file)

      try {
        await syncMilestoneFileToSharePoint({
          milestoneId,
          noteId: noteId || null,
          kind,
          fileName,
          isFolder: Boolean(isFolder),
          base64Content,
          fileType,
          folderPath: Array.isArray(folderPath)
            ? folderPath.filter((segment: unknown): segment is string => typeof segment === 'string')
            : [],
        })
      } catch (sharePointError) {
        await container.item(file.id, file.milestoneId).delete().catch(() => undefined)
        const detail = sharePointError instanceof Error ? sharePointError.message : 'Unknown SharePoint sync error'
        throw new Error(`SharePoint 동기화 실패: ${detail}`)
      }

      return NextResponse.json(resource, { status: 201 })
    } catch (cosmosError) {
      console.error('Cosmos DB error:', cosmosError)
      const errorMessage = cosmosError instanceof Error ? cosmosError.message : 'Cosmos DB connection failed'
      return NextResponse.json(
        { error: `Cosmos DB 오류: ${errorMessage}. 환경 변수를 확인하세요.` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: `파일 업로드 오류: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, milestoneId, noteId, kind, parentFolderId, folderPath } = body

    if (!id || !milestoneId) {
      return NextResponse.json({ error: 'id and milestoneId are required' }, { status: 400 })
    }

    try {
      const container = await getContainer()

      const { resources } = await container.items
        .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] })
        .fetchAll()

      if (resources.length === 0) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }

      const existing = resources[0] as MilestoneFile
      const normalizedFolderPath = Array.isArray(folderPath)
        ? folderPath.filter((segment: unknown): segment is string => typeof segment === 'string')
        : (existing.folderPath ?? [])
      const normalizedParentFolderId = parentFolderId === undefined
        ? (existing.parentFolderId ?? null)
        : (parentFolderId || null)

      if (existing.milestoneId === milestoneId) {
        // Same partition key — update in place
        const updated: MilestoneFile = {
          ...existing,
          noteId: noteId ?? null,
          kind: kind ?? existing.kind,
          parentFolderId: normalizedParentFolderId,
          folderPath: normalizedFolderPath,
        }
        const { resource } = await container.item(id, milestoneId).replace(updated)
        return NextResponse.json(resource)
      } else {
        // Different partition key — must delete and recreate
        await container.item(id, existing.milestoneId).delete()
        const updated: MilestoneFile = {
          ...existing,
          milestoneId,
          noteId: noteId ?? null,
          kind: kind ?? existing.kind,
          parentFolderId: normalizedParentFolderId,
          folderPath: normalizedFolderPath,
        }
        const { resource } = await container.items.create(updated)
        return NextResponse.json(resource)
      }
    } catch (cosmosError) {
      console.error('Cosmos DB error:', cosmosError)
      const errorMessage = cosmosError instanceof Error ? cosmosError.message : 'Cosmos DB operation failed'
      return NextResponse.json(
        { error: `Cosmos DB 오류: ${errorMessage}` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error moving file:', error)
    return NextResponse.json(
      { error: `파일 이동 오류: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')

    if (!fileId) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    try {
      const container = await getContainer()

      // Query to get the file and its milestoneId for partition key
      const { resources } = await container.items
        .query({
          query: `SELECT * FROM c WHERE c.id = @id`,
          parameters: [{ name: '@id', value: fileId }],
        })
        .fetchAll()

      if (resources.length === 0) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        )
      }

      const file = resources[0] as MilestoneFile
      await container.item(fileId, file.milestoneId).delete()

      return NextResponse.json({ success: true })
    } catch (cosmosError) {
      console.error('Cosmos DB error:', cosmosError)
      const errorMessage = cosmosError instanceof Error ? cosmosError.message : 'Cosmos DB operation failed'
      return NextResponse.json(
        { error: `Cosmos DB 오류: ${errorMessage}. 환경 변수를 확인하세요.` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error deleting file:', error)
    return NextResponse.json(
      { error: `파일 삭제 오류: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
