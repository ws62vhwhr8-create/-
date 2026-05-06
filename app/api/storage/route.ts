import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'

const STORAGE_FILE = join(process.cwd(), '.data', 'storage.json')

// Ensure .data directory exists
async function ensureDataDir() {
  try {
    await readFile(STORAGE_FILE)
  } catch {
    // File doesn't exist, will be created on first save
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    
    // Create directory if it doesn't exist
    const { mkdir } = await import('fs/promises')
    const dir = join(process.cwd(), '.data')
    try {
      await mkdir(dir, { recursive: true })
    } catch {
      // Directory might already exist
    }
    
    // Save to file
    await writeFile(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8')
    
    return Response.json({ success: true })
  } catch (error) {
    console.error('Storage save error:', error)
    return Response.json({ error: 'Failed to save storage' }, { status: 500 })
  }
}

export async function GET() {
  try {
    await ensureDataDir()
    
    try {
      const data = await readFile(STORAGE_FILE, 'utf-8')
      return Response.json(JSON.parse(data))
    } catch {
      // File doesn't exist yet, return empty
      return Response.json(null)
    }
  } catch (error) {
    console.error('Storage load error:', error)
    return Response.json({ error: 'Failed to load storage' }, { status: 500 })
  }
}
