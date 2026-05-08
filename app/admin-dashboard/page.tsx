"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { CustomerTable } from "@/components/dashboard/customer-table"
import { useAppStore } from "@/lib/store"

export default function AdminDashboardPage() {
  const router = useRouter()
  const { users, currentUserId } = useAppStore()
  const currentUser = users.find((u) => u.id === currentUserId)
  const isAdmin = currentUser?.role === "admin"

  useEffect(() => {
    if (users.length > 0 && !isAdmin) {
      router.replace("/dashboard")
    }
  }, [isAdmin, router, users.length])

  if (!isAdmin) return null

  return (
    <>
      <Navigation />
      <SidebarInset>
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/98 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-14 items-center gap-3 px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="h-5 w-px bg-border/70" />
            <span className="text-sm font-medium text-muted-foreground">대시보드 (Admin)</span>
          </div>
        </header>

        <main className="flex-1 w-full overflow-y-auto bg-[#F8FAFC] dark:bg-[#131313]">
          <div className="w-full px-6 py-8 lg:px-12 space-y-6 animate-page-in">
            <div className="mb-6">
              <div>
                <h1 className="text-2xl font-bold leading-tight tracking-tight text-[#1b1b23] dark:text-[#e5e2e1]">대시보드</h1>
                <p className="text-sm text-[#64748B] dark:text-[#908fa0] mt-1">전체 고객사 진행 현황</p>
              </div>
            </div>

            <div className="space-y-6">
              <StatsCards tone="default" />
              <CustomerTable tone="default" />
            </div>
          </div>
        </main>
      </SidebarInset>
    </>
  )
}