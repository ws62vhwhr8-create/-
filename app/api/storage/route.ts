import { writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'

const PRIMARY_STORAGE_FILE = join(process.cwd(), '.data', 'storage.json')
const TMP_STORAGE_FILE = '/tmp/storage.json'

async function writeStorageFile(filePath: string, data: unknown) {
  if (filePath.startsWith('/tmp/')) {
    await mkdir('/tmp', { recursive: true })
  } else {
    await mkdir(join(process.cwd(), '.data'), { recursive: true })
  }

  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

async function readStorageFile(filePath: string) {
  const data = await readFile(filePath, 'utf-8')
  return JSON.parse(data)
}

function isReadOnlyFsError(error: unknown) {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'EROFS' || (error as NodeJS.ErrnoException).code === 'EPERM')
  )
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    try {
      await writeStorageFile(PRIMARY_STORAGE_FILE, data)
      return Response.json({ success: true, target: 'primary' })
    } catch (error) {
      if (!isReadOnlyFsError(error)) {
        throw error
      }

      // Serverless environments (like Vercel) use read-only deployment fs.
      await writeStorageFile(TMP_STORAGE_FILE, data)
      return Response.json({ success: true, target: 'tmp' })
    }
  } catch (error) {
    console.error('Storage save error:', error)
    return Response.json({ error: 'Failed to save storage' }, { status: 500 })
  }
}

export async function GET() {
  try {
    try {
      const data = await readStorageFile(PRIMARY_STORAGE_FILE)
      return Response.json(data)
    } catch (primaryError) {
      try {
        const data = await readStorageFile(TMP_STORAGE_FILE)
        return Response.json(data)
      } catch {
        if (isReadOnlyFsError(primaryError)) {
          return Response.json(null)
        }
        return Response.json(null)
      }
    }
  } catch (error) {
    console.error('Storage load error:', error)
    return Response.json({ error: 'Failed to load storage' }, { status: 500 })
  }
}
