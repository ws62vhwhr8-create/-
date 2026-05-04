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

    const baseSelect = "id,displayName,mail,description,securityEnabled,groupTypes"
    const baseEndpoint = `/groups?$select=${baseSelect}&$top=200`
    const memberOfEndpoint = "/me/memberOf/microsoft.graph.group?$select=id,displayName,mail,description&$top=200"

    let result: { value?: unknown[] } = { value: [] }
    try {
      result = await client.api(baseEndpoint).get()
    } catch {
      // Fallback for tenants/apps where listing all groups is blocked.
      try {
        result = await client.api(memberOfEndpoint).get()
      } catch {
        return NextResponse.json({ groups: [] })
      }
    }

    let groups = (result.value as Array<{
      id: string
      displayName: string
      mail?: string
      description?: string
      securityEnabled?: boolean
      groupTypes?: string[]
    }>)
      .filter((g) => {
        const isUnified = Array.isArray(g.groupTypes) && g.groupTypes.includes("Unified")
        // memberOf fallback may not include these fields; keep entries when absent.
        if (typeof g.securityEnabled === "undefined" && typeof g.groupTypes === "undefined") return true
        return Boolean(g.securityEnabled) || isUnified
      })
      .map((g) => ({
        id: g.id,
        displayName: g.displayName ?? "",
        mail: g.mail ?? "",
        description: g.description ?? "",
      }))

    if (query.trim()) {
      const lower = query.trim().toLowerCase()
      groups = groups.filter(
        (g) => g.displayName.toLowerCase().includes(lower) || g.mail.toLowerCase().includes(lower)
      )
    }

    return NextResponse.json({ groups })
  } catch (error) {
    console.error("[entra/groups] Graph API error:", error)
    return NextResponse.json({ error: "Failed to fetch groups from Entra ID" }, { status: 500 })
  }
}
