"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Navigation } from "@/components/navigation"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Share2,
  Building2,
  Calendar,
  User,
} from "lucide-react"
import type { Customer } from "@/lib/types"
import { ShareDialog } from "@/components/share-dialog-new"
import { canAccessCustomer, isAdminRole } from "@/lib/permissions"

const statusLabels: Record<Customer['status'], string> = {
  active: '진행중',
  completed: '완료',
  'at-risk': '위험',
}

const statusStyles: Record<Customer['status'], string> = {
  active: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 dark:bg-[#3b82f6]/10 dark:text-[#3b82f6] dark:border-[#3b82f6]/20',
  completed: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 dark:bg-[#22c55e]/10 dark:text-[#22c55e] dark:border-[#22c55e]/20',
  'at-risk': 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20 dark:bg-[#ffb4ab]/10 dark:text-[#ffb4ab] dark:border-[#ffb4ab]/20',
}

const statusBarClass: Record<Customer['status'], string> = {
  active: 'bg-[#F59E0B] dark:bg-[#3b82f6]',
  completed: 'bg-[#10B981] dark:bg-[#22c55e]',
  'at-risk': 'bg-[#EF4444] dark:bg-[#ffb4ab]',
}

const statusTextClass: Record<Customer['status'], string> = {
  active: 'text-[#F59E0B] dark:text-[#3b82f6]',
  completed: 'text-[#10B981] dark:text-[#22c55e]',
  'at-risk': 'text-[#EF4444] dark:text-[#ffb4ab]',
}

export default function CustomersPage() {
  const router = useRouter()
  const { customers, solutions, users, groups, currentUserId, currentEntraId, deleteCustomer, shareCustomer } = useAppStore()
  const [search, setSearch] = useState("")
  const [solutionFilter, setSolutionFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [customerToShare, setCustomerToShare] = useState<Customer | null>(null)

  const currentUser = users.find((user) => user.id === currentUserId)
  const isAdmin = isAdminRole(currentUser?.role)
  const scopedCustomers = customers.filter((customer) =>
    canAccessCustomer({
      customer,
      currentUser,
      currentEntraId,
      isAdmin,
    }),
  )

  const filteredCustomers = scopedCustomers.filter((customer) => {
    const matchesSearch = customer.companyName.toLowerCase().includes(search.toLowerCase())
    const matchesSolution = solutionFilter === "all" || customer.solutionId === solutionFilter
    const matchesStatus = statusFilter === "all" || customer.status === statusFilter
    return matchesSearch && matchesSolution && matchesStatus
  })

  const handleEdit = (customerId: string) => {
    router.push(`/customers/${customerId}?edit=true`)
  }

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (customerToDelete) {
      deleteCustomer(customerToDelete.id)
      setDeleteDialogOpen(false)
      setCustomerToDelete(null)
    }
  }

  const handleShare = (customer: Customer) => {
    setCustomerToShare(customer)
    setShareDialogOpen(true)
  }

  const normalizeRecipientEmails = (emails: Array<string | undefined>) => {
    return Array.from(
      new Set(
        emails
          .map((email) => email?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email)),
      ),
    )
  }

  const sendCustomerNotification = async (payload: {
    type: 'created' | 'shared'
    customerName: string
    solutionName: string
    ownerName: string
    recipientEmails: string[]
    sharedEntityNames?: string[]
  }) => {
    if (payload.recipientEmails.length === 0) return

    try {
      await fetch('/api/notifications/customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      console.error('Failed to send customer notification:', error)
    }
  }

  const handleShareConfirm = async (userIds: string[], groupIds: string[]) => {
    if (!customerToShare) return

    shareCustomer(customerToShare.id, userIds, groupIds)

    await sendCustomerNotification({
      type: 'shared',
      customerName: customerToShare.companyName,
      solutionName: customerToShare.solutionName,
      ownerName: customerToShare.ownerName,
      recipientEmails: [],
      sharedEntityNames: [...userIds, ...groupIds],
    })

    toast.success(`${customerToShare.companyName} 정보가 공유되었습니다`)
  }

  const getProgress = (customer: Customer) => {
    const completed = customer.milestones.filter(m => m.status === 'completed').length
    const total = customer.milestones.length
    return { completed, total, percentage: Math.round((completed / total) * 100) }
  }

  return (
    <>
      <Navigation />
      <SidebarInset>
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/98 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-14 items-center gap-3 px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="h-5 w-px bg-border/70" />
            <span className="text-sm font-medium text-muted-foreground">고객 관리</span>
          </div>
        </header>
        
        <main className="app-surface flex-1 w-full overflow-y-auto">
          <div className="w-full px-6 py-8 lg:px-12 space-y-6 animate-page-in">
            <div className="flex items-end justify-between gap-4">
              <div className="w-full p-6 md:p-7">
                <span className="menu-kicker">Customer Portfolio</span>
                <div className="mt-3">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-[#1e1b4b] dark:text-[#e5e2e1]">고객 관리</h1>
                    <p className="text-sm text-[#5b5785] dark:text-[#908fa0] mt-1.5">고객 상태, 진행률, 담당자, 공유 현황을 빠르게 탐색하고 관리합니다.</p>
                  </div>
                </div>
              </div>

              <Button className="ml-4 shadow-sm" onClick={() => router.push('/customers/new')}>
                <Plus className="mr-2 h-4 w-4" />
                고객 등록
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#dbe3ee] bg-white/92 px-5 py-3.5 shadow-[0_20px_48px_-36px_rgba(15,23,42,0.55)] sm:flex-row sm:items-center dark:bg-[#1E1E1E]/60 dark:border-[#333333]">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6360a0] dark:text-[#908fa0]" />
                <Input
                  placeholder="고객사 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-transparent border-[#dbd6f0] dark:bg-transparent dark:border-[#464554]/50"
                />
              </div>

              <Select value={solutionFilter} onValueChange={setSolutionFilter}>
                <SelectTrigger className="w-[160px] dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]">
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
                <SelectTrigger className="w-[140px] dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent className="dark:bg-[#1E1E1E] dark:border-[#333333]">
                  <SelectItem value="all" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">전체 상태</SelectItem>
                  <SelectItem value="active" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">진행중</SelectItem>
                  <SelectItem value="completed" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">완료</SelectItem>
                  <SelectItem value="at-risk" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">위험</SelectItem>
                </SelectContent>
              </Select>
            </div>

          {/* Customer Cards Grid */}
          {filteredCustomers.length === 0 ? (
            <Card className="border-[#dbd6f0] bg-white shadow-sm dark:border-[#333333] dark:bg-[#1E1E1E]/60">
              <CardContent className="p-6">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Building2 />
                    </EmptyMedia>
                    <EmptyTitle>
                      {scopedCustomers.length === 0 ? "접근 가능한 고객사가 없습니다" : "검색 조건에 맞는 고객사가 없습니다"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {scopedCustomers.length === 0
                        ? "접근 권한이 할당된 고객사가 없습니다."
                        : "검색어나 필터를 조정해서 원하는 고객을 다시 찾아보세요."}
                    </EmptyDescription>
                  </EmptyHeader>
                  {scopedCustomers.length === 0 && (
                    <EmptyContent>
                      <Button asChild>
                        <Link href="/customers/new">
                          <Plus className="mr-2 h-4 w-4" />
                          첫 고객 등록하기
                        </Link>
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredCustomers.map((customer) => {
                const progress = getProgress(customer)
                return (
                  <Card 
                    key={customer.id} 
                    className="bg-white border-[#dbd6f0] shadow-[0_4px_20px_-4px_rgba(30,41,59,0.05)] hover:shadow-[0_12px_24px_-8px_rgba(30,41,59,0.1)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]"
                  >
                    {/* Kebab Menu */}
                    <div className="absolute top-3 right-3 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">메뉴 열기</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="top" className="dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]">
                          <DropdownMenuItem onClick={() => handleEdit(customer.id)} className="dark:text-[#e5e2e1] dark:focus:bg-[#2A2A2A] dark:focus:text-[#e5e2e1]">
                            <Pencil className="mr-2 h-4 w-4" />
                            수정
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClick(customer)}
                            className="text-destructive focus:text-destructive dark:focus:bg-red-900/20 dark:focus:text-[#ffb4ab]"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            삭제
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare(customer)} className="dark:text-[#e5e2e1] dark:focus:bg-[#2A2A2A] dark:focus:text-[#e5e2e1]">
                            <Share2 className="mr-2 h-4 w-4" />
                            공유
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <CardContent 
                      className="p-5"
                      onClick={() => router.push(`/customers/${customer.id}`)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#efecf8] dark:bg-primary/10">
                            <Building2 className="h-5 w-5 text-[#4f46e5] dark:text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[#1b1b23] dark:text-[#e5e2e1]">
                              {customer.companyName}
                            </h3>
                            <p className="text-sm text-[#6360a0] dark:text-[#908fa0]">
                              {customer.solutionName}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-[#6360a0] dark:text-[#908fa0]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{format(customer.salesStartDate, 'yyyy.MM.dd', { locale: ko })}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          <span>{customer.ownerName}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#6360a0] dark:text-[#908fa0]">진행률</span>
                          <span className={`font-medium ${statusTextClass[customer.status]}`}>
                            {progress.completed}/{progress.total} ({progress.percentage}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#e4e1ed] dark:bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${statusBarClass[customer.status]}`}
                            style={{ width: `${progress.percentage}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-1">
                        <Badge variant="outline" className={statusStyles[customer.status]}>
                          {statusLabels[customer.status]}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
          </div>
        </main>

        {/* Share Dialog */}
        {customerToShare && (
          <ShareDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            customerName={customerToShare.companyName}
            sharedUserIds={customerToShare.sharedUserIds}
            sharedGroupIds={customerToShare.sharedGroupIds}
            users={users}
            groups={groups}
            onShare={handleShareConfirm}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-white dark:bg-[#1c1b1b] dark:border-[#464554]">
            <AlertDialogHeader className="pb-4 dark:border-b dark:border-[#464554]">
              <AlertDialogTitle className="dark:text-[#e5e2e1]">고객 삭제</AlertDialogTitle>
              <AlertDialogDescription className="dark:text-[#c7c4d7]">
                정말로 &quot;{customerToDelete?.companyName}&quot;을(를) 삭제하시겠습니까?
                모든 마일스톤 데이터가 함께 삭제됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="pt-4">
              <AlertDialogCancel className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]">취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:border dark:border-[#464554] dark:bg-[#0e0e0e] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </>
  )
}