"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useAppStore } from "@/lib/store"

export function SessionStoreSync() {
  const { data: session, status } = useSession()
  const { users, groups, solutions, currentUserId, setCurrentUserId, currentEntraId, setCurrentEntraId } = useAppStore()
  const hasLoadedServerData = useRef(false)

  // 세션 기반 사용자 동기화
  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return

    const sessionUserId = session.user.id
    const sessionEntraId = session.user.entraId
    const sessionEmail = session.user.email?.toLowerCase()
    const sessionName = session.user.name?.trim()

    const matchedUser = users.find((user) => {
      if (sessionUserId && user.id === sessionUserId) return true
      if (sessionEmail && user.email?.toLowerCase() === sessionEmail) return true
      if (sessionName && user.displayName === sessionName) return true
      return false
    })

    if (matchedUser && matchedUser.id !== currentUserId) {
      setCurrentUserId(matchedUser.id)
    }

    const entraId = sessionEntraId || sessionUserId
    if (entraId && entraId !== currentEntraId) {
      setCurrentEntraId(entraId)
    }
  }, [status, session, users, currentUserId, setCurrentUserId, currentEntraId, setCurrentEntraId])

  // 서버 저장본이 있으면 초기 로드 시 반영
  useEffect(() => {
    let isMounted = true

    const loadFromServer = async () => {
      try {
        const response = await fetch("/api/storage", { cache: "no-store" })
        if (!response.ok) return

        const serverData = await response.json()
        if (!isMounted) return

        const nextUsers = Array.isArray(serverData?.users) ? serverData.users : undefined
        const nextGroups = Array.isArray(serverData?.groups) ? serverData.groups : undefined
        const nextSolutions = Array.isArray(serverData?.solutions)
          ? serverData.solutions.map((solution: any) => ({
              ...solution,
              createdAt: new Date(solution.createdAt),
              updatedAt: new Date(solution.updatedAt),
            }))
          : undefined

        if (
          (nextUsers && nextUsers.length > 0) ||
          (nextGroups && nextGroups.length > 0) ||
          (nextSolutions && nextSolutions.length > 0)
        ) {
          useAppStore.setState((state) => ({
            ...state,
            users: nextUsers ?? state.users,
            groups: nextGroups ?? state.groups,
            solutions: nextSolutions ?? state.solutions,
          }))
        }
      } catch (error) {
        console.warn("Failed to load from server:", error)
      } finally {
        hasLoadedServerData.current = true
      }
    }

    loadFromServer()

    return () => {
      isMounted = false
    }
  }, [])

  // 사용자/그룹/솔루션 변경 사항을 서버에 저장
  useEffect(() => {
    if (!hasLoadedServerData.current) return

    const timer = setTimeout(async () => {
      try {
        await fetch("/api/storage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ users, groups, solutions }),
        })
      } catch (error) {
        console.warn("Failed to sync to server:", error)
      }
    }, 500)

    return () => {
      clearTimeout(timer)
    }
  }, [users, groups, solutions])

  return null
}
