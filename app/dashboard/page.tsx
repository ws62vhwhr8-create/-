"use client"

import { Navigation } from "@/components/navigation"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { CustomerTable } from "@/components/dashboard/customer-table"

export default function UserDashboardPage() {
  return (
    <>
      <Navigation />
      <SidebarInset>
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/98 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-14 items-center gap-3 px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="h-5 w-px bg-border/70" />
            <span className="text-sm font-medium text-muted-foreground">대시보드</span>
          </div>
        </header>

        <main className="app-surface flex-1 w-full overflow-y-auto">
          <div className="w-full px-6 py-8 lg:px-12 space-y-6 animate-page-in">
            <div className="p-6 md:p-7">
              <span className="menu-kicker">User Workspace</span>
              <div className="mt-3">
                <div>
                  <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#1e1b4b] dark:text-[#e5e2e1]">개인 대시보드</h1>
                  <p className="text-sm text-[#5b5785] dark:text-[#908fa0] mt-1.5">내가 생성한 고객과 공유 받은 고객의 진행 흐름을 빠르게 확인합니다.</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <StatsCards tone="user" />
              <CustomerTable tone="user" />
            </div>
          </div>
        </main>
      </SidebarInset>
    </>
  )
}