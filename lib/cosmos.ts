import { CosmosClient, Database, Container } from '@azure/cosmos'

let cosmosClient: CosmosClient | null = null
let database: Database | null = null
let container: Container | null = null

export const initializeCosmosDB = async () => {
  if (cosmosClient && database && container) {
    return { database, container }
  }

  const endpoint = process.env.COSMOS_DB_ENDPOINT
  const key = process.env.COSMOS_DB_KEY
  const databaseId = process.env.COSMOS_DB_DATABASE || 'milestone-files'
  const containerId = process.env.COSMOS_DB_CONTAINER || 'files'

  if (!endpoint || !key) {
    const missingVars = []
    if (!endpoint) missingVars.push('COSMOS_DB_ENDPOINT')
    if (!key) missingVars.push('COSMOS_DB_KEY')
    throw new Error(
      `Cosmos DB 설정이 누락되었습니다. 다음 환경 변수를 .env.local 파일에 추가하세요:\n${missingVars.join(', ')}`
    )
  }

  try {
    cosmosClient = new CosmosClient({ endpoint, key })

    // Create database if it doesn't exist
    const { database: db } = await cosmosClient.databases.createIfNotExists({ id: databaseId })
    database = db

    // Create container if it doesn't exist
    const { container: cont } = await database.containers.createIfNotExists(
      { id: containerId, partitionKey: '/milestoneId' }
    )
    container = cont

    return { database, container }
  } catch (error) {
    cosmosClient = null
    database = null
    container = null

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(
      `Cosmos DB 연결 실패: ${errorMessage}. 환경 변수와 네트워크 연결을 확인하세요.`
    )
  }
}

export const getContainer = async () => {
  if (!container) {
    try {
      const { container: cont } = await initializeCosmosDB()
      return cont
    } catch (error) {
      console.error('Failed to get Cosmos DB container:', error)
      throw error
    }
  }
  return container
}

export type MilestoneFile = {
  id: string
  milestoneId: string
  noteId: string | null
  parentFolderId?: string | null
  folderPath?: string[]
  fileName: string
  fileSize: number
  fileType: string
  isFolder?: boolean
  uploadedAt: string
  uploadedBy?: string
  base64Content?: string // For small files
  contentUrl?: string // For large files stored in blob storage
  kind: 'stage' | 'action-item'
}
