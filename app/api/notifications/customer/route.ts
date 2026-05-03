import { getServerSession } from "next-auth"
import type { Session } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import {
  canUseOutlookProvider,
  sendMockMail,
  sendOutlookMail,
  type GenericNotificationMessage,
} from "@/lib/notifications/providers"

type CustomerNotificationType = "created" | "shared"

interface CustomerNotificationBody {
  type: CustomerNotificationType
  customerName: string
  solutionName: string
  ownerName: string
  recipientEmails: string[]
  sharedEntityNames?: string[]
}

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase()
}

function isAdminSession(session: Session | null) {
  const sessionUser = session?.user as { role?: string } | undefined
  return sessionUser?.role === "admin"
}

function buildCustomerMessage(body: CustomerNotificationBody): GenericNotificationMessage {
  const now = new Date().toLocaleString("ko-KR")

  if (body.type === "created") {
    return {
      subject: `[고객 등록 알림] ${body.customerName}`,
      bodyHtml: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin-bottom: 12px;">고객 등록 알림</h2>
          <p><b>고객사:</b> ${body.customerName}</p>
          <p><b>솔루션:</b> ${body.solutionName}</p>
          <p><b>담당자:</b> ${body.ownerName}</p>
          <p><b>등록 시각:</b> ${now}</p>
          <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="font-size: 13px; color: #6b7280;">이 메일은 영업 로드맵 시스템에서 자동 발송되었습니다.</p>
        </div>
      `.trim(),
    }
  }

  const sharedTargets = body.sharedEntityNames?.length ? body.sharedEntityNames.join(", ") : "-"
  return {
    subject: `[고객 공유 알림] ${body.customerName}`,
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">고객 정보 공유 알림</h2>
        <p><b>고객사:</b> ${body.customerName}</p>
        <p><b>솔루션:</b> ${body.solutionName}</p>
        <p><b>담당자:</b> ${body.ownerName}</p>
        <p><b>공유 대상:</b> ${sharedTargets}</p>
        <p><b>공유 시각:</b> ${now}</p>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="font-size: 13px; color: #6b7280;">이 메일은 영업 로드맵 시스템에서 자동 발송되었습니다.</p>
      </div>
    `.trim(),
  }
}

function normalizeEmails(emails: string[]) {
  return Array.from(
    new Set(
      emails
        .map((email) => email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    ),
  )
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as CustomerNotificationBody | null

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (body.type !== "created" && body.type !== "shared") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  }

  if (!body.customerName || !body.solutionName || !body.ownerName) {
    return NextResponse.json({ error: "Missing required customer fields" }, { status: 400 })
  }

  if (body.type === "shared") {
    const sessionName = normalizeText(session.user?.name)
    const ownerName = normalizeText(body.ownerName)
    const isOwner = Boolean(sessionName) && sessionName === ownerName
    const isAdmin = isAdminSession(session)

    if (!isOwner && !isAdmin) {
      console.warn("[AUDIT] Customer share denied", {
        actorName: session.user?.name ?? null,
        actorEmail: session.user?.email ?? null,
        customerName: body.customerName,
        ownerName: body.ownerName,
        reason: "forbidden",
      })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    console.info("[AUDIT] Customer share authorized", {
      actorName: session.user?.name ?? null,
      actorEmail: session.user?.email ?? null,
      actorRole: isAdmin ? "admin" : "owner",
      customerName: body.customerName,
      ownerName: body.ownerName,
      sharedTargets: body.sharedEntityNames ?? [],
    })
  }

  const recipientEmails = normalizeEmails(body.recipientEmails ?? [])
  if (recipientEmails.length === 0) {
    return NextResponse.json({ message: "No recipients", total: 0, successCount: 0, failureCount: 0 })
  }

  const message = buildCustomerMessage(body)
  const useOutlook = canUseOutlookProvider()

  const results = []
  for (const recipientEmail of recipientEmails) {
    if (useOutlook) {
      results.push(await sendOutlookMail(recipientEmail, message))
    } else {
      results.push(await sendMockMail(recipientEmail, message))
    }
  }

  const successCount = results.filter((result) => result.success).length
  const failureCount = results.length - successCount

  return NextResponse.json({
    provider: useOutlook ? "outlook" : "mock",
    total: results.length,
    successCount,
    failureCount,
    results,
  })
}
