/**
 * 감사 로그 (Audit Log)
 * - 권한 거부, 데이터 수정 등 중요 이벤트 기록
 * - 프로덕션: 별도 감시 서비스 또는 DB에 저장
 * - 개발: 콘솔 로그 + 나중에 DB 마이그레이션 가능
 */

export type AuditAction =
  | "ACCESS_DENIED"
  | "CUSTOMER_CREATE"
  | "CUSTOMER_UPDATE"
  | "CUSTOMER_DELETE"
  | "CUSTOMER_SHARE"
  | "MILESTONE_EDIT"
  | "MILESTONE_DELETE"
  | "FILE_UPLOAD"
  | "FILE_DELETE"
  | "NOTES_ADD"
  | "NOTES_EDIT"
  | "NOTES_DELETE"

export type AuditSeverity = "info" | "warning" | "error" | "critical"

export interface AuditLogEntry {
  action: AuditAction
  timestamp: Date
  userId?: string | null
  userName?: string
  resourceType?: string
  resourceId?: string
  details?: Record<string, any>
  severity: AuditSeverity
  success: boolean
  reason?: string
}

// 메모리 기반 로그 (임시, 프로덕션에서는 DB/서비스로 전환)
const auditLogs: AuditLogEntry[] = []
const MAX_LOGS = 10000

/**
 * 감사 로그 기록
 */
export function logAuditAction(entry: Omit<AuditLogEntry, "timestamp">) {
  const logEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date(),
  }

  // 메모리에 저장
  auditLogs.push(logEntry)
  if (auditLogs.length > MAX_LOGS) {
    auditLogs.shift()
  }

  // 콘솔 로그 (개발용)
  const prefix = `[${logEntry.severity.toUpperCase()}] ${logEntry.action}`
  const message = `${prefix} | User: ${logEntry.userId || "unknown"} | Resource: ${logEntry.resourceId || "-"}`

  if (logEntry.severity === "critical" || logEntry.severity === "error") {
    console.error(message, logEntry.details, logEntry.reason)
  } else if (logEntry.severity === "warning") {
    console.warn(message, logEntry.details)
  } else {
    console.log(message, logEntry.details)
  }

  // TODO: 프로덕션에서는 아래와 같이 API 호출
  // if (process.env.NODE_ENV === 'production') {
  //   fetch('/api/audit', { method: 'POST', body: JSON.stringify(logEntry) })
  // }
}

/**
 * 권한 거부 로그 기록 (편의 함수)
 */
export function logAccessDenied(params: {
  userId?: string | null
  userName?: string
  resourceType: string
  resourceId?: string
  action: string
  reason?: string
}) {
  logAuditAction({
    action: "ACCESS_DENIED",
    severity: "warning",
    success: false,
    userId: params.userId,
    userName: params.userName,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    reason: params.reason,
    details: { attemptedAction: params.action },
  })
}

/**
 * 감사 로그 조회 (개발용)
 */
export function getAuditLogs(filters?: {
  action?: AuditAction
  userId?: string
  severity?: AuditSeverity
  hours?: number
}): AuditLogEntry[] {
  let result = [...auditLogs]

  if (filters?.action) {
    result = result.filter((log) => log.action === filters.action)
  }
  if (filters?.userId) {
    result = result.filter((log) => log.userId === filters.userId)
  }
  if (filters?.severity) {
    result = result.filter((log) => log.severity === filters.severity)
  }
  if (filters?.hours) {
    const cutoff = new Date(Date.now() - filters.hours * 60 * 60 * 1000)
    result = result.filter((log) => log.timestamp >= cutoff)
  }

  return result
}

/**
 * 감사 로그 초기화 (테스트용)
 */
export function clearAuditLogs() {
  auditLogs.length = 0
}
