import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getGraphClient } from "@/lib/microsoft-graph"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q") ?? ""

  try {
    const client = getGraphClient()

    let endpoint = "/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department&$top=999&$orderby=displayName"

    if (query.trim()) {
      const escaped = query.trim().replace(/'/g, "''")
      endpoint =
        `/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department&$top=999` +
        `&$filter=startsWith(displayName,'${escaped}') or startsWith(mail,'${escaped}') or startsWith(userPrincipalName,'${escaped}')`
    }

    const result = await client.api(endpoint).get()

    const users = (result.value as Array<{
      id: string
      displayName: string
      mail?: string
      userPrincipalName?: string
      jobTitle?: string
      department?: string
    }>).map((u) => ({
      id: u.id,
      displayName: u.displayName ?? "",
      email: u.mail ?? u.userPrincipalName ?? "",
      jobTitle: u.jobTitle ?? "",
      department: u.department ?? "",
    }))

    return NextResponse.json({ users })
  } catch (error) {
    console.error("[entra/users] Graph API error:", error)
    return NextResponse.json({ error: "Failed to fetch users from Entra ID" }, { status: 500 })
  }
}
