import { getGraphClient } from "@/lib/microsoft-graph"
import type {
  NotificationItem,
  NotificationMessage,
  NotificationSendResult,
} from "@/lib/notifications/types"

export interface GenericNotificationMessage {
  subject: string
  bodyHtml: string
}

export interface GenericNotificationSendResult {
  provider: "mock" | "outlook"
  recipientEmail: string
  subject: string
  success: boolean
  error?: string
}

function buildMessage(item: NotificationItem): NotificationMessage {
  const dueDate = item.dueDate.toLocaleDateString("ko-KR")
  const notifyDate = item.notifyDate.toLocaleDateString("ko-KR")

  return {
    subject: `[로드맵 알림] ${item.customerName} - ${item.stageName} 단계 일정 안내`,
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">워크플로우 알림</h2>
        <p><b>고객사:</b> ${item.customerName}</p>
        <p><b>솔루션:</b> ${item.solutionName}</p>
        <p><b>단계:</b> ${item.stageName}</p>
        <p><b>알림일:</b> ${notifyDate}</p>
        <p><b>마감일:</b> ${dueDate}</p>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="font-size: 13px; color: #6b7280;">이 메일은 영업 로드맵 알림 시스템에 의해 자동 발송되었습니다.</p>
      </div>
    `.trim(),
  }
}

export async function sendMockNotification(item: NotificationItem): Promise<NotificationSendResult> {
  const message = buildMessage(item)
  console.info("[MOCK_NOTIFICATION]", {
    to: item.recipientEmail,
    subject: message.subject,
    milestoneId: item.milestoneId,
  })

  return {
    provider: "mock",
    recipientEmail: item.recipientEmail,
    subject: message.subject,
    success: true,
  }
}

export function canUseOutlookProvider() {
  return Boolean(
    process.env.ENTRA_TENANT_ID &&
      process.env.ENTRA_CLIENT_ID &&
      process.env.ENTRA_CLIENT_SECRET &&
      process.env.OUTLOOK_SENDER_UPN,
  )
}

export async function sendOutlookNotification(item: NotificationItem): Promise<NotificationSendResult> {
  const sender = process.env.OUTLOOK_SENDER_UPN
  if (!sender) {
    return {
      provider: "outlook",
      recipientEmail: item.recipientEmail,
      subject: "",
      success: false,
      error: "OUTLOOK_SENDER_UPN is not configured",
    }
  }

  const message = buildMessage(item)

  try {
    const client = getGraphClient()
    await client.api(`/users/${encodeURIComponent(sender)}/sendMail`).post({
      message: {
        subject: message.subject,
        body: {
          contentType: "HTML",
          content: message.bodyHtml,
        },
        toRecipients: [
          {
            emailAddress: {
              address: item.recipientEmail,
            },
          },
        ],
      },
      saveToSentItems: true,
    })

    return {
      provider: "outlook",
      recipientEmail: item.recipientEmail,
      subject: message.subject,
      success: true,
    }
  } catch (error) {
    return {
      provider: "outlook",
      recipientEmail: item.recipientEmail,
      subject: message.subject,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function sendMockMail(
  recipientEmail: string,
  message: GenericNotificationMessage,
): Promise<GenericNotificationSendResult> {
  console.info("[MOCK_MAIL]", {
    to: recipientEmail,
    subject: message.subject,
  })

  return {
    provider: "mock",
    recipientEmail,
    subject: message.subject,
    success: true,
  }
}

export async function sendOutlookMail(
  recipientEmail: string,
  message: GenericNotificationMessage,
): Promise<GenericNotificationSendResult> {
  const sender = process.env.OUTLOOK_SENDER_UPN
  if (!sender) {
    return {
      provider: "outlook",
      recipientEmail,
      subject: message.subject,
      success: false,
      error: "OUTLOOK_SENDER_UPN is not configured",
    }
  }

  try {
    const client = getGraphClient()
    await client.api(`/users/${encodeURIComponent(sender)}/sendMail`).post({
      message: {
        subject: message.subject,
        body: {
          contentType: "HTML",
          content: message.bodyHtml,
        },
        toRecipients: [
          {
            emailAddress: {
              address: recipientEmail,
            },
          },
        ],
      },
      saveToSentItems: true,
    })

    return {
      provider: "outlook",
      recipientEmail,
      subject: message.subject,
      success: true,
    }
  } catch (error) {
    return {
      provider: "outlook",
      recipientEmail,
      subject: message.subject,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
