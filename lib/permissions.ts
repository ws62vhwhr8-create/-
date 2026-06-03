import type { Customer, Solution, User, Milestone, MilestoneFile } from "@/lib/types"

export type ResourceType = "customer" | "milestone" | "file" | "solution"
export type Action = "view" | "edit" | "delete" | "share"

export interface AccessCheckResult {
  allowed: boolean
  reason?: string
}

export function isAdminRole(role?: string | null) {
  return role === "admin"
}

export function canAccessSolution(params: {
  solution: Solution
  currentUser?: User
  currentEntraId?: string
  isAdmin: boolean
}) {
  const { solution, currentUser, currentEntraId, isAdmin } = params
  if (isAdmin) return true

  const userIds = solution.userIds ?? []
  const groupIds = solution.groupIds ?? []

  // 접근 권한이 비어 있으면 관리자만 접근 가능
  if (userIds.length === 0 && groupIds.length === 0) return false

  if (currentUser && userIds.includes(currentUser.id)) return true
  if (currentEntraId && userIds.includes(currentEntraId)) return true

  const userGroupIds = currentUser?.groupIds ?? []
  return userGroupIds.some((groupId) => groupIds.includes(groupId))
}

export function canAccessCustomer(params: {
  customer: Customer
  currentUser?: User
  currentEntraId?: string
  isAdmin: boolean
}) {
  const { customer, currentUser, currentEntraId, isAdmin } = params
  if (isAdmin) return true

  const currentUserId = currentUser?.id
  const currentOwnerName = currentUser?.displayName
  const currentUserGroupIds = currentUser?.groupIds ?? []

  const isOwner = customer.ownerId
    ? customer.ownerId === currentUserId
    : Boolean(currentOwnerName) && customer.ownerName === currentOwnerName

  const isSharedUser =
    (!!currentUserId && (customer.sharedUserIds ?? []).includes(currentUserId)) ||
    (!!currentEntraId && (customer.sharedUserIds ?? []).includes(currentEntraId))

  const isSharedGroup = (customer.sharedGroupIds ?? []).some((groupId) =>
    currentUserGroupIds.includes(groupId),
  )

  return isOwner || isSharedUser || isSharedGroup
}

/**
 * 마일스톤 편집 권한 검증
 * - 고객 소유자/공유 사용자만 해당 고객의 마일스톤 편집 가능
 */
export function canEditMilestone(params: {
  milestone: Milestone
  customerId: string
  customer?: Customer
  currentUser?: User
  isAdmin: boolean
}): AccessCheckResult {
  const { milestone, customerId, customer, currentUser, isAdmin } = params

  if (isAdmin) {
    return { allowed: true }
  }

  if (!customer) {
    return { allowed: false, reason: "Customer not found" }
  }

  // 고객 접근 권한 먼저 확인
  const hasCustomerAccess = canAccessCustomer({
    customer,
    currentUser,
    isAdmin,
  })

  if (!hasCustomerAccess) {
    return { allowed: false, reason: "No access to customer" }
  }

  return { allowed: true }
}

/**
 * 파일 삭제 권한 검증
 * - 해당 마일스톤의 고객 소유자/공유 사용자만 파일 삭제 가능
 */
export function canDeleteFile(params: {
  file: MilestoneFile
  customerId: string
  customer?: Customer
  currentUser?: User
  isAdmin: boolean
}): AccessCheckResult {
  const { file, customerId, customer, currentUser, isAdmin } = params

  if (isAdmin) {
    return { allowed: true }
  }

  if (!customer) {
    return { allowed: false, reason: "Customer not found" }
  }

  // 고객 접근 권한 먼저 확인
  const hasCustomerAccess = canAccessCustomer({
    customer,
    currentUser,
    isAdmin,
  })

  if (!hasCustomerAccess) {
    return { allowed: false, reason: "No access to customer" }
  }

  return { allowed: true }
}

/**
 * 분석 보기 권한 검증
 * - 관리자 또는 고객 소유자만 분석 및 통계 조회 가능
 */
export function canViewAnalytics(params: {
  customer: Customer
  currentUser?: User
  isAdmin: boolean
}): AccessCheckResult {
  const { customer, currentUser, isAdmin } = params

  if (isAdmin) {
    return { allowed: true }
  }

  const currentUserId = currentUser?.id
  const currentOwnerName = currentUser?.displayName

  const isOwner = customer.ownerId
    ? customer.ownerId === currentUserId
    : Boolean(currentOwnerName) && customer.ownerName === currentOwnerName

  if (isOwner) {
    return { allowed: true }
  }

  return { allowed: false, reason: "Only owner and admin can view analytics" }
}

/**
 * 범용 리소스 접근 검증
 * - resourceType, resourceId, action을 기반으로 권한 체크
 */
export function validateResourceAccess(params: {
  resourceType: ResourceType
  resourceId: string
  action: Action
  customer?: Customer
  currentUser?: User
  isAdmin: boolean
}): AccessCheckResult {
  const { resourceType, resourceId, action, customer, currentUser, isAdmin } = params

  if (isAdmin) {
    return { allowed: true }
  }

  // Customer 리소스 접근
  if (resourceType === "customer") {
    if (!customer) {
      return { allowed: false, reason: "Customer not found" }
    }

    const hasAccess = canAccessCustomer({
      customer,
      currentUser,
      isAdmin,
    })

    if (!hasAccess) {
      return { allowed: false, reason: "No access to this customer" }
    }

    // view 권한 있으면 edit/delete는 소유자만
    if (action === "edit" || action === "delete") {
      const isOwner = customer.ownerId
        ? customer.ownerId === currentUser?.id
        : customer.ownerName === currentUser?.displayName

      if (!isOwner) {
        return { allowed: false, reason: "Only owner can edit/delete customer" }
      }
    }

    return { allowed: true }
  }

  // Milestone, File 리소스 접근 (customer 권한 확인 후 허용)
  if (resourceType === "milestone" || resourceType === "file") {
    if (!customer) {
      return { allowed: false, reason: "Customer not found" }
    }

    const hasCustomerAccess = canAccessCustomer({
      customer,
      currentUser,
      isAdmin,
    })

    if (!hasCustomerAccess) {
      return { allowed: false, reason: "No access to customer" }
    }

    return { allowed: true }
  }

  // Solution 리소스 접근
  if (resourceType === "solution") {
    // Solution은 별도의 권한 체크 필요 (여기서는 기본 허용)
    return { allowed: true }
  }

  return { allowed: false, reason: "Unknown resource type" }
}
