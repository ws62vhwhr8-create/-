import { NextRequest, NextResponse } from 'next/server'
import { initializeCosmosDB, getContainer, MilestoneFile } from '@/lib/cosmos'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const milestoneId = searchParams.get('milestoneId')
    const noteId = searchParams.get('noteId')

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

      const { resources } = await container.items.query(query, { parameters }).fetchAll()

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
  try {
    const body = await request.json()
    const { milestoneId, noteId, fileName, fileSize, fileType, base64Content, kind, isFolder } = body

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
        fileName,
        fileSize,
        fileType,
        isFolder: Boolean(isFolder),
        uploadedAt: new Date().toISOString(),
        base64Content: base64Content || undefined,
        kind,
      }

      const { resource } = await container.items.create(file)

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

export async function DELETE(request: NextRequest) {
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
        .query(`SELECT * FROM c WHERE c.id = @id`, {
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
