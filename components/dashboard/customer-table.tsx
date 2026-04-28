"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Search, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Customer } from "@/lib/types"

const statusLabels: Record<Customer['status'], string> = {
  active: '진행중',
  completed: '완료',
  'at-risk': '위험',
}

const statusStyles: Record<Customer['status'], string> = {
  active: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-[#3b82f6]/10 dark:text-[#3b82f6] dark:border-[#3b82f6]/20',
  completed: 'bg-lime-100 text-lime-700 border-lime-200 dark:bg-[#22c55e]/10 dark:text-[#22c55e] dark:border-[#22c55e]/20',
  'at-risk': 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-[#ffb4ab]/10 dark:text-[#ffb4ab] dark:border-[#ffb4ab]/20',
}

const statusStylesUser: Record<Customer['status'], string> = {
  active: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 dark:bg-[#3b82f6]/10 dark:text-[#3b82f6] dark:border-[#3b82f6]/20',
  completed: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 dark:bg-[#22c55e]/10 dark:text-[#22c55e] dark:border-[#22c55e]/20',
  'at-risk': 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20 dark:bg-[#ffb4ab]/10 dark:text-[#ffb4ab] dark:border-[#ffb4ab]/20',
}

type CustomerTableProps = {
  tone?: "default" | "user"
}

export function CustomerTable({ tone = "default" }: CustomerTableProps) {
  const { customers, solutions } = useAppStore()
  const [search, setSearch] = useState("")
  const [solutionFilter, setSolutionFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [ownerFilter, setOwnerFilter] = useState<string>("all")

  const uniqueOwners = Array.from(new Set(customers.map(c => c.ownerName)))
  const isUser = tone === "user"
  const activeStatusStyles = isUser ? statusStylesUser : statusStyles

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch = customer.companyName.toLowerCase().includes(search.toLowerCase())
    const matchesSolution = solutionFilter === "all" || customer.solutionId === solutionFilter
    const matchesStatus = statusFilter === "all" || customer.status === statusFilter
    const matchesOwner = ownerFilter === "all" || customer.ownerName === ownerFilter
    return matchesSearch && matchesSolution && matchesStatus && matchesOwner
  })

  const getProgressInfo = (customer: Customer) => {
    const completed = customer.milestones.filter(m => m.status === 'completed').length
    const total = customer.milestones.length
    const percentage = Math.round((completed / total) * 100)
    return { completed, total, percentage }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", isUser ? "text-[#64748B] dark:text-[#908fa0]" : "text-muted-foreground")} />
          <Input
            placeholder="고객사 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn("pl-9", isUser ? "bg-white border-[#E2E8F0] dark:bg-[#1E1E1E] dark:border-[#464554]/50" : "bg-background border-border")}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className={cn("h-4 w-4", isUser ? "text-[#64748B] dark:text-[#908fa0]" : "text-muted-foreground")} />
            <span className={cn("text-sm hidden sm:inline", isUser ? "text-[#64748B] dark:text-[#908fa0]" : "text-muted-foreground")}>필터:</span>
          </div>
          
          <Select value={solutionFilter} onValueChange={setSolutionFilter}>
            <SelectTrigger className="w-[140px] dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]">
              <SelectValue placeholder="솔루션" />
            </SelectTrigger>
            <SelectContent className="dark:bg-[#1E1E1E] dark:border-[#333333]">
              <SelectItem value="all" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">전체 솔루션</SelectItem>
              {solutions.map((solution) => (
                <SelectItem key={solution.id} value={solution.id} className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">
                  {solution.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent className="dark:bg-[#1E1E1E] dark:border-[#333333]">
              <SelectItem value="all" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">전체 상태</SelectItem>
              <SelectItem value="active" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">진행중</SelectItem>
              <SelectItem value="completed" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">완료</SelectItem>
              <SelectItem value="at-risk" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">위험</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[160px] dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]">
              <SelectValue placeholder="담당자" />
            </SelectTrigger>
            <SelectContent className="dark:bg-[#1E1E1E] dark:border-[#333333]">
              <SelectItem value="all" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">전체 담당자</SelectItem>
              {uniqueOwners.map((owner) => (
                <SelectItem key={owner} value={owner} className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">
                  {owner}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={cn(
        "rounded-lg border overflow-hidden dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]",
        isUser ? "bg-white border-[#E2E8F0] shadow-sm" : "bg-card border-border"
      )}>
        <Table>
          <TableHeader>
            <TableRow className={cn("dark:bg-[#1c1b1b]/80 dark:hover:bg-[#1c1b1b]/80", isUser ? "bg-[#F8FAFC] hover:bg-[#F8FAFC]" : "bg-secondary/50 hover:bg-secondary/50")}>
              <TableHead className={cn("w-[30%] text-left font-medium dark:text-[#908fa0] dark:uppercase dark:tracking-wider", isUser ? "text-[#64748B]" : "text-muted-foreground")}>고객사</TableHead>
              <TableHead className={cn("w-[14%] text-center font-medium dark:text-[#908fa0] dark:uppercase dark:tracking-wider", isUser ? "text-[#64748B]" : "text-muted-foreground")}>솔루션</TableHead>
              <TableHead className={cn("w-[16%] text-center font-medium dark:text-[#908fa0] dark:uppercase dark:tracking-wider", isUser ? "text-[#64748B]" : "text-muted-foreground")}>영업 시작일</TableHead>
              <TableHead className={cn("w-[14%] text-center font-medium dark:text-[#908fa0] dark:uppercase dark:tracking-wider", isUser ? "text-[#64748B]" : "text-muted-foreground")}>담당자</TableHead>
              <TableHead className={cn("w-[16%] text-left font-medium whitespace-nowrap pl-4 dark:text-[#908fa0] dark:uppercase dark:tracking-wider", isUser ? "text-[#64748B]" : "text-muted-foreground")}>진행률</TableHead>
              <TableHead className={cn("w-[10%] text-right font-medium pr-6 dark:text-[#908fa0] dark:uppercase dark:tracking-wider", isUser ? "text-[#64748B]" : "text-muted-foreground")}>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className={cn("h-24 text-center", isUser ? "text-[#64748B] dark:text-[#908fa0]" : "text-muted-foreground")}>
                  등록된 고객이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => {
                const progress = getProgressInfo(customer)
                return (
                  <TableRow key={customer.id} className={cn("dark:hover:bg-[#2A2A2A]", isUser ? "hover:bg-[#F8FAFC]" : "hover:bg-secondary/30")}>
                    <TableCell className={cn("font-medium", isUser ? "text-[#1b1b23] dark:text-[#e5e2e1]" : "")}>{customer.companyName}</TableCell>
                    <TableCell className={cn("text-center", isUser ? "text-[#64748B] dark:text-[#908fa0]" : "text-muted-foreground text-center")}>{customer.solutionName}</TableCell>
                    <TableCell className={cn("text-center", isUser ? "text-[#64748B] dark:text-[#908fa0]" : "text-muted-foreground text-center")}>
                      {format(customer.salesStartDate, 'yyyy.MM.dd', { locale: ko })}
                    </TableCell>
                    <TableCell className={cn("text-center", isUser ? "text-[#1b1b23] dark:text-[#e5e2e1]" : "text-muted-foreground text-center")}>{customer.ownerName}</TableCell>
                    <TableCell className="pl-4">
                      <div className="flex w-[160px] flex-col gap-1">
                        <div className="flex items-center">
                          <span className={cn("text-sm", isUser ? "text-[#64748B] dark:text-[#908fa0]" : "text-muted-foreground")}>
                            {progress.completed}/{progress.total}
                          </span>
                        </div>
                        <div className={cn("h-1.5 w-full rounded-full overflow-hidden", isUser ? "bg-[#dbd8e4] dark:bg-[#2A2A2A]" : "bg-secondary")}>
                          <div
                            className={cn(
                              "h-full transition-all",
                              customer.status === 'active' ? (isUser ? 'bg-[#F59E0B] dark:bg-[#3b82f6]' : 'bg-primary dark:bg-[#3b82f6]') :
                              customer.status === 'completed' ? (isUser ? 'bg-[#10B981] dark:bg-[#22c55e]' : 'bg-primary dark:bg-[#22c55e]') :
                              (isUser ? 'bg-[#EF4444] dark:bg-[#ffb4ab]' : 'bg-primary dark:bg-[#ffb4ab]')
                            )}
                            style={{ width: `${progress.percentage}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Badge variant="outline" className={activeStatusStyles[customer.status]}>
                        {statusLabels[customer.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
