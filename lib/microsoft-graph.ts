// lib/microsoft-graph.ts
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";

let graphClient: Client | null = null;

export function getGraphClient() {
  if (!graphClient) {
    const credential = new ClientSecretCredential(
      process.env.ENTRA_TENANT_ID!,
      process.env.ENTRA_CLIENT_ID!,
      process.env.ENTRA_CLIENT_SECRET!
    );

    graphClient = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await credential.getToken("https://graph.microsoft.com/.default");
          return token.token;
        },
      },
    });
  }

  return graphClient;
}

export interface EntraUser {
  id: string;
  userPrincipalName: string;
  displayName: string;
  mail: string;
  jobTitle?: string;
  mobilePhone?: string;
}

export interface EntraGroup {
  id: string;
  displayName: string;
  mail?: string;
  description?: string;
}

type SharePointSyncInput = {
  milestoneId: string;
  noteId?: string | null;
  kind: 'stage' | 'action-item';
  fileName: string;
  isFolder?: boolean;
  base64Content?: string;
  fileType?: string;
};

const encodePath = (path: string) => path.split('/').map((segment) => encodeURIComponent(segment)).join('/');

const sanitizePathSegment = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|#%]/g, '_')
    .replace(/\.+$/g, '')
    .slice(0, 120) || 'untitled';

const getSharePointConfig = () => {
  const siteId = process.env.SHAREPOINT_SITE_ID;
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const rootFolder = process.env.SHAREPOINT_ROOT_FOLDER || 'milestone-files';

  if (!siteId || !driveId) {
    throw new Error('SharePoint 환경 변수가 누락되었습니다. SHAREPOINT_SITE_ID, SHAREPOINT_DRIVE_ID를 설정하세요.');
  }

  return {
    siteId,
    driveId,
    rootFolder: sanitizePathSegment(rootFolder),
  };
};

const ensureFolderPath = async (driveId: string, pathSegments: string[]) => {
  const client = getGraphClient();
  let currentPath = '';

  for (const rawSegment of pathSegments) {
    const segment = sanitizePathSegment(rawSegment);
    const nextPath = currentPath ? `${currentPath}/${segment}` : segment;

    try {
      await client.api(`/drives/${driveId}/root:/${encodePath(nextPath)}`).get();
    } catch {
      const createEndpoint = currentPath
        ? `/drives/${driveId}/root:/${encodePath(currentPath)}:/children`
        : `/drives/${driveId}/root/children`;

      await client.api(createEndpoint).post({
        name: segment,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'replace',
      });
    }

    currentPath = nextPath;
  }
};

export async function syncMilestoneFileToSharePoint(input: SharePointSyncInput): Promise<void> {
  const { driveId, rootFolder } = getSharePointConfig();
  const client = getGraphClient();

  const baseSegments = [
    rootFolder,
    sanitizePathSegment(input.milestoneId),
    input.kind === 'stage'
      ? 'stage'
      : `action-item/${sanitizePathSegment(input.noteId || 'unknown')}`,
  ]
    .join('/')
    .split('/');

  if (input.isFolder) {
    await ensureFolderPath(driveId, [...baseSegments, input.fileName]);
    return;
  }

  if (!input.base64Content) {
    throw new Error('파일 본문(base64Content)이 없어 SharePoint 동기화를 진행할 수 없습니다.');
  }

  await ensureFolderPath(driveId, baseSegments);

  const [, payload = ''] = input.base64Content.split(',');
  const buffer = Buffer.from(payload, 'base64');
  const targetPath = `${baseSegments.join('/')}/${sanitizePathSegment(input.fileName)}`;

  await client
    .api(`/drives/${driveId}/root:/${encodePath(targetPath)}:/content`)
    .header('Content-Type', input.fileType || 'application/octet-stream')
    .put(buffer);
}

// 청크 크기: 10 MiB (Microsoft Graph 요구사항: 320 KiB의 배수)
const UPLOAD_CHUNK_SIZE = 10 * 1024 * 1024

/**
 * createUploadSession → chunked PUT 방식으로 SharePoint에 대용량 파일을 업로드하고 webUrl을 반환한다.
 * Microsoft Graph 단순 PUT 한계(4MB)를 우회하며 사실상 무제한 파일 크기를 지원한다.
 */
export async function uploadFileWithSessionToSharePoint(input: {
  milestoneId: string
  noteId?: string | null
  kind: 'stage' | 'action-item'
  fileName: string
  fileType?: string
  fileBuffer: Buffer
}): Promise<string> {
  const { driveId, rootFolder } = getSharePointConfig()
  const client = getGraphClient()

  const baseSegments = [
    rootFolder,
    sanitizePathSegment(input.milestoneId),
    input.kind === 'stage'
      ? 'stage'
      : `action-item/${sanitizePathSegment(input.noteId || 'unknown')}`,
  ]
    .join('/')
    .split('/')

  await ensureFolderPath(driveId, baseSegments)

  const targetPath = `${baseSegments.join('/')}/${sanitizePathSegment(input.fileName)}`
  const fileSize = input.fileBuffer.length

  // 1. 업로드 세션 생성
  const sessionResponse = await client
    .api(`/drives/${driveId}/root:/${encodePath(targetPath)}:/createUploadSession`)
    .post({
      item: {
        '@microsoft.graph.conflictBehavior': 'replace',
        name: sanitizePathSegment(input.fileName),
      },
    })

  const uploadUrl: string | undefined = sessionResponse?.uploadUrl
  if (!uploadUrl) {
    throw new Error('SharePoint 업로드 세션 URL을 가져올 수 없습니다.')
  }

  // 2. 청크 단위 PUT 업로드
  let start = 0
  let lastResponse: Response | null = null

  while (start < fileSize) {
    const end = Math.min(start + UPLOAD_CHUNK_SIZE, fileSize)
    const chunk = input.fileBuffer.subarray(start, end)

    const chunkResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${start}-${end - 1}/${fileSize}`,
        'Content-Type': input.fileType || 'application/octet-stream',
      },
      body: chunk,
    })

    // 202: 진행 중, 201/200: 완료
    if (!chunkResponse.ok && chunkResponse.status !== 202) {
      const errorBody = await chunkResponse.text().catch(() => '')
      throw new Error(
        `청크 업로드 실패 (bytes ${start}-${end - 1}): HTTP ${chunkResponse.status} ${errorBody}`
      )
    }

    lastResponse = chunkResponse
    start = end
  }

  if (!lastResponse) {
    throw new Error('업로드 응답이 없습니다.')
  }

  const result = await lastResponse.json()
  const directDownloadUrl = result?.['@microsoft.graph.downloadUrl'] as string | undefined
  const webUrl = result?.webUrl as string | undefined

  if (directDownloadUrl) {
    return directDownloadUrl
  }

  if (webUrl) {
    return webUrl
  }

  throw new Error('업로드 결과 URL을 확인할 수 없습니다.')
}

/**
 * Entra ID에서 모든 사용자 조회
 */
export async function getAllUsers(): Promise<EntraUser[]> {
  try {
    const client = getGraphClient();
    const response = await client.api("/users").select(["id", "userPrincipalName", "displayName", "mail", "jobTitle"]).get();
    return response.value || [];
  } catch (error) {
    console.error("Error fetching users from Microsoft Graph:", error);
    throw error;
  }
}

/**
 * 특정 사용자 조회
 */
export async function getUser(userId: string): Promise<EntraUser> {
  try {
    const client = getGraphClient();
    const response = await client.api(`/users/${userId}`).select(["id", "userPrincipalName", "displayName", "mail", "jobTitle"]).get();
    return response;
  } catch (error) {
    console.error(`Error fetching user ${userId} from Microsoft Graph:`, error);
    throw error;
  }
}

/**
 * Entra ID에서 모든 그룹 조회
 */
export async function getAllGroups(): Promise<EntraGroup[]> {
  try {
    const client = getGraphClient();
    const response = await client.api("/groups").select(["id", "displayName", "mail", "description"]).get();
    return response.value || [];
  } catch (error) {
    console.error("Error fetching groups from Microsoft Graph:", error);
    throw error;
  }
}

/**
 * 특정 그룹의 멤버 조회
 */
export async function getGroupMembers(groupId: string): Promise<EntraUser[]> {
  try {
    const client = getGraphClient();
    const response = await client
      .api(`/groups/${groupId}/members`)
      .select(["id", "userPrincipalName", "displayName", "mail"])
      .get();
    return response.value || [];
  } catch (error) {
    console.error(`Error fetching members of group ${groupId}:`, error);
    throw error;
  }
}

/**
 * 사용자가 속한 그룹 조회
 */
export async function getUserGroups(userId: string): Promise<EntraGroup[]> {
  try {
    const client = getGraphClient();
    const response = await client
      .api(`/users/${userId}/memberOf`)
      .select(["id", "displayName", "mail"])
      .get();
    return response.value || [];
  } catch (error) {
    console.error(`Error fetching groups for user ${userId}:`, error);
    throw error;
  }
}
