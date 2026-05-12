import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getContainer, MilestoneFile } from '@/lib/cosmos'
import { uploadFileWithSessionToSharePoint } from '@/lib/microsoft-graph'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const milestoneId = formData.get('milestoneId') as string | null
    const noteId = formData.get('noteId') as string | null
    const kind = formData.get('kind') as 'stage' | 'action-item' | null
    const parentFolderId = formData.get('parentFolderId') as string | null
    const rawFolderPath = formData.get('folderPath') as string | null

    let folderPath: string[] = []
    if (rawFolderPath) {
      try {
        const parsed = JSON.parse(rawFolderPath)
        if (Array.isArray(parsed)) {
          folderPath = parsed.filter((segment): segment is string => typeof segment === 'string')
        }
      } catch {
        folderPath = []
      }
    }

    if (!file || !milestoneId || !kind) {
      return NextResponse.json(
        { error: 'file, milestoneId, kind are required' },
        { status: 400 }
      )
    }

    // Convert File to Buffer for SharePoint upload
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Upload to SharePoint and get web URL
    let contentUrl: string
    try {
      contentUrl = await uploadFileWithSessionToSharePoint({
        milestoneId,
        noteId: noteId || null,
        kind,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileBuffer,
        folderPath,
      })
    } catch (sharePointError) {
      console.error('SharePoint upload error:', sharePointError)
      const detail = sharePointError instanceof Error ? sharePointError.message : 'Unknown SharePoint error'
      return NextResponse.json(
        { error: `SharePoint 업로드 실패: ${detail}` },
        { status: 500 }
      )
    }

    // Save metadata to Cosmos DB (contentUrl instead of base64Content)
    try {
      const container = await getContainer()

      const milestoneFile: MilestoneFile = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        milestoneId,
        noteId: noteId || null,
        parentFolderId: parentFolderId || null,
        folderPath,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        isFolder: false,
        uploadedAt: new Date().toISOString(),
        contentUrl,
        kind,
      }

      const { resource } = await container.items.create(milestoneFile)
      return NextResponse.json(resource, { status: 201 })
    } catch (cosmosError) {
      console.error('Cosmos DB error:', cosmosError)
      const errorMessage = cosmosError instanceof Error ? cosmosError.message : 'Cosmos DB connection failed'
      return NextResponse.json(
        { error: `Cosmos DB 오류: ${errorMessage}` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error uploading large file:', error)
    return NextResponse.json(
      { error: `업로드 오류: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
