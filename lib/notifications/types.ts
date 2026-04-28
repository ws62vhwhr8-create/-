export interface NotificationItem {
  milestoneId: string
  customerId: string
  customerName: string
  solutionName: string
  stageName: string
  dueDate: Date
  notifyDate: Date
  recipientEmail: string
  ownerName: string
}

export interface NotificationMessage {
  subject: string
  bodyHtml: string
}

export interface NotificationSendResult {
  provider: "mock" | "outlook"
  recipientEmail: string
  subject: string
  success: boolean
  error?: string
}
