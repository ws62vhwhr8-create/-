import type { Customer, Solution, User } from "@/lib/types"

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
