"use client"

import type { ReactNode } from "react"
import { SessionProvider } from "next-auth/react"
import { SessionStoreSync } from "@/components/session-store-sync"

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider>
      <SessionStoreSync />
      {children}
    </SessionProvider>
  )
}
