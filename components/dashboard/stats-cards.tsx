"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Users, CheckCircle2, AlertTriangle, Clock, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type StatsCardsProps = {
  tone?: "default" | "user"
}

export function StatsCards({ tone = "default" }: StatsCardsProps) {
  const [isOpen, setIsOpen] = useState(true)
  const { customers, users, currentUserId } = useAppStore()
  const isUser = tone === "user"
  const currentUser = users.find((user) => user.id === currentUserId)
  const currentOwnerName = currentUser?.displayName
  const currentUserIdValue = currentUser?.id
  const currentUserGroupIds = currentUser?.groupIds ?? []
  const userAccessibleCustomers = customers.filter((customer) => {
    const isOwner = customer.ownerId
      ? customer.ownerId === currentUserIdValue
      : customer.ownerName === currentOwnerName
    const isSharedUser = !!currentUserIdValue && (customer.sharedUserIds ?? []).includes(currentUserIdValue)
    const isSharedGroup = (customer.sharedGroupIds ?? []).some((groupId) => currentUserGroupIds.includes(groupId))
    return isOwner || isSharedUser || isSharedGroup
  })
  const relevantCustomers = isUser
    ? userAccessibleCustomers
    : customers

  const stats = {
    total: relevantCustomers.length,
    active: relevantCustomers.filter((c) => c.status === "active").length,
    completed: relevantCustomers.filter((c) => c.status === "completed").length,
    atRisk: relevantCustomers.filter((c) => c.status === "at-risk").length,
  }
  const darkCard = "dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]"

  const cards = [
    {
      title: "전체 고객",
      value: stats.total,
      icon: Users,
      color: isUser ? "text-[#4648d4] dark:text-[#c0c1ff]" : "text-[#4648d4] dark:text-[#c0c1ff]",
      bgColor: isUser ? "bg-[#4648d4]/10 dark:bg-[#c0c1ff]/10" : "bg-[#4648d4]/10 dark:bg-[#c0c1ff]/10",
      cardColor: isUser ? `bg-white border-[#E2E8F0] shadow-sm ${darkCard}` : `bg-white border-[#E2E8F0] shadow-sm ${darkCard}`,
    },
    {
      title: "진행중",
      value: stats.active,
      icon: Clock,
      color: isUser ? "text-[#F59E0B] dark:text-[#3b82f6]" : "text-[#F59E0B] dark:text-[#3b82f6]",
      bgColor: isUser ? "bg-[#F59E0B]/10 dark:bg-[#3b82f6]/10" : "bg-[#F59E0B]/10 dark:bg-[#3b82f6]/10",
      cardColor: isUser ? `bg-white border-[#E2E8F0] shadow-sm ${darkCard}` : `bg-white border-[#E2E8F0] shadow-sm ${darkCard}`,
    },
    {
      title: "완료",
      value: stats.completed,
      icon: CheckCircle2,
      color: isUser ? "text-[#10B981] dark:text-[#22c55e]" : "text-[#10B981] dark:text-[#22c55e]",
      bgColor: isUser ? "bg-[#10B981]/10 dark:bg-[#22c55e]/10" : "bg-[#10B981]/10 dark:bg-[#22c55e]/10",
      cardColor: isUser ? `bg-white border-[#E2E8F0] shadow-sm ${darkCard}` : `bg-white border-[#E2E8F0] shadow-sm ${darkCard}`,
    },
    {
      title: "위험",
      value: stats.atRisk,
      icon: AlertTriangle,
      color: isUser ? "text-[#EF4444] dark:text-[#ffb4ab]" : "text-[#EF4444] dark:text-[#ffb4ab]",
      bgColor: isUser ? "bg-[#EF4444]/10 dark:bg-[#ffb4ab]/10" : "bg-[#EF4444]/10 dark:bg-[#ffb4ab]/10",
      cardColor: isUser ? `bg-white border-[#E2E8F0] shadow-sm ${darkCard}` : `bg-white border-[#E2E8F0] shadow-sm ${darkCard}`,
    },
  ]

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={cn("text-sm font-medium", isUser ? "text-[#64748B] dark:text-[#908fa0]" : "text-[#64748B] dark:text-muted-foreground")}>고객 현황 요약</h2>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <ChevronDown 
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isUser ? "text-[#64748B] dark:text-[#908fa0]" : "text-[#64748B] dark:text-muted-foreground",
                isOpen ? "rotate-0" : "-rotate-90"
              )} 
            />
            <span className="sr-only">{isOpen ? "접기" : "펼치기"}</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="transition-all data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.title} className={card.cardColor}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className={cn("text-sm font-medium", isUser ? "text-[#64748B] dark:text-[#908fa0]" : "text-[#64748B] dark:text-muted-foreground")}>
                  {card.title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={cn("text-3xl font-bold dark:text-[#e5e2e1]", isUser ? "text-[#1b1b23]" : "")}>{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
