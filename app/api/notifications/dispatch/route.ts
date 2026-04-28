import { NextRequest, NextResponse } from "next/server"
import {
  buildDueMilestoneNotifications,
  dispatchMilestoneNotifications,
  type NotificationProvider,
} from "@/lib/notifications/service"

const DEFAULT_LIMIT = 100

function isAuthorized(req: NextRequest) {
  const secret = process.env.NOTIFICATION_CRON_SECRET
  if (!secret) return true
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  return token === secret
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limitParam = req.nextUrl.searchParams.get("limit")
  const limit = limitParam ? Number(limitParam) : DEFAULT_LIMIT

  const items = await buildDueMilestoneNotifications({
    limit: Number.isNaN(limit) ? DEFAULT_LIMIT : limit,
  })

  return NextResponse.json({
    mode: "preview",
    total: items.length,
    items,
    outlookConfigured: Boolean(
      process.env.ENTRA_TENANT_ID &&
        process.env.ENTRA_CLIENT_ID &&
        process.env.ENTRA_CLIENT_SECRET &&
        process.env.OUTLOOK_SENDER_UPN,
    ),
  })
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const provider = (body.provider ?? "mock") as NotificationProvider
  const dryRun = body.dryRun ?? true
  const limitRaw = body.limit ?? DEFAULT_LIMIT
  const limit = typeof limitRaw === "number" ? limitRaw : Number(limitRaw)

  if (provider !== "mock" && provider !== "outlook") {
    return NextResponse.json(
      { error: "Invalid provider. Use 'mock' or 'outlook'." },
      { status: 400 },
    )
  }

  const items = await buildDueMilestoneNotifications({
    limit: Number.isNaN(limit) ? DEFAULT_LIMIT : limit,
  })

  if (dryRun) {
    return NextResponse.json({
      mode: "dry-run",
      provider,
      total: items.length,
      items,
      message: "No emails were sent. Set dryRun=false to dispatch.",
    })
  }

  const results = await dispatchMilestoneNotifications(items, provider)
  const successCount = results.filter((r) => r.success).length
  const failureCount = results.length - successCount

  return NextResponse.json({
    mode: "dispatch",
    provider,
    total: results.length,
    successCount,
    failureCount,
    results,
  })
}
