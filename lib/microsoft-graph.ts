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
