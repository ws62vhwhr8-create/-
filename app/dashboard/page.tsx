"use client"

import { Navigation } from "@/components/navigation"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { CustomerTable } from "@/components/dashboard/customer-table"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

export default function UserDashboardPage() {
  return (
    <>
      <Navigation />
      <SidebarInset>
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center gap-4 px-4">
            <SidebarTrigger />
          </div>
        </header>

        <main className="flex-1 w-full overflow-y-auto bg-[#F8FAFC] dark:bg-[#131313]">
          <div className="w-full px-6 py-8 lg:px-12 space-y-6">
            <div className="mb-6">
              <div>
                <h1 className="text-2xl font-bold leading-tight tracking-tight text-[#1b1b23] dark:text-[#e5e2e1]">대시보드 (개인용)</h1>
                <p className="text-[#64748B] dark:text-[#908fa0]">담당 고객사 현황 및 마일스톤 진행 상태</p>
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