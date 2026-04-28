import { prisma } from "@/lib/prisma"
import {
  canUseOutlookProvider,
  sendMockNotification,
  sendOutlookNotification,
} from "@/lib/notifications/providers"
import type { NotificationItem, NotificationSendResult } from "@/lib/notifications/types"

export type NotificationProvider = "mock" | "outlook"

interface BuildOptions {
  limit?: number
}

export async function buildDueMilestoneNotifications(options: BuildOptions = {}): Promise<NotificationItem[]> {
  const now = new Date()
  const milestones = await prisma.milestone.findMany({
    where: {
      notifyDate: {
        lte: now,
      },
      status: {
        not: "completed",
      },
    },
    include: {
      customer: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      notifyDate: "asc",
    },
    take: options.limit,
  })

  const ownerNames = Array.from(new Set(milestones.map((m) => m.customer.ownerName).filter(Boolean)))
  const usersByName = ownerNames.length
    ? await prisma.user.findMany({
        where: {
          displayName: {
            in: ownerNames,
          },
        },
        select: {
          displayName: true,
          email: true,
        },
      })
    : []

  const ownerEmailMap = new Map(usersByName.map((u) => [u.displayName, u.email]))

  return milestones
    .map((m) => {
      const recipientEmail = m.customer.user?.email ?? ownerEmailMap.get(m.customer.ownerName)
      if (!recipientEmail) return null

      return {
        milestoneId: m.id,
        customerId: m.customerId,
        customerName: m.customer.companyName,
        solutionName: m.customer.solutionName,
        stageName: m.stageName,
        dueDate: m.dueDate,
        notifyDate: m.notifyDate,
        recipientEmail,
        ownerName: m.customer.ownerName,
      } satisfies NotificationItem
    })
    .filter((item): item is NotificationItem => Boolean(item))
}

export async function dispatchMilestoneNotifications(
  items: NotificationItem[],
  provider: NotificationProvider,
): Promise<NotificationSendResult[]> {
  if (provider === "outlook" && !canUseOutlookProvider()) {
    return items.map((item) => ({
      provider: "outlook",
      recipientEmail: item.recipientEmail,
      subject: "",
      success: false,
      error:
        "Outlook provider is not configured. Required env: ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, OUTLOOK_SENDER_UPN",
    }))
  }

  const results: NotificationSendResult[] = []
  for (const item of items) {
    if (provider === "outlook") {
      results.push(await sendOutlookNotification(item))
    } else {
      results.push(await sendMockNotification(item))
    }
  }
  return results
}
