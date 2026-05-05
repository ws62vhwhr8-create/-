"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useAppStore } from "@/lib/store"

export function SessionStoreSync() {
  const { data: session, status } = useSession()
  const { users, currentUserId, setCurrentUserId, currentEntraId, setCurrentEntraId } = useAppStore()

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

  return null
}
