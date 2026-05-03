"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useAppStore } from "@/lib/store"

export function SessionStoreSync() {
  const { data: session, status } = useSession()
  const { users, currentUserId, setCurrentUserId } = useAppStore()

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return

    const sessionUserId = session.user.id
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
  }, [status, session, users, currentUserId, setCurrentUserId])

  return null
}
