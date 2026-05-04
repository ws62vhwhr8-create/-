"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"

export default function DashboardPage() {
  const router = useRouter()
  const { users, currentUserId } = useAppStore()

  useEffect(() => {
    const currentUser = users.find((user) => user.id === currentUserId)
    const destination = currentUser?.role === "admin" ? "/admin-dashboard" : "/customers"
    router.replace(destination)
  }, [users, currentUserId, router])

  return null
}
