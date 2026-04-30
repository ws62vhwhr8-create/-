"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
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
  ChevronDown
} from "lucide-react"
import type { Customer } from "@/lib/types"
import { ShareDialog } from "@/components/share-dialog"
import { OwnerPicker } from "@/components/owner-picker"

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
  const { customers, solutions, users, groups, deleteCustomer, addCustomer, shareCustomer } = useAppStore()
  const [search, setSearch] = useState("")
  const [solutionFilter, setSolutionFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [customerToShare, setCustomerToShare] = useState<Customer | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isOwnerPickerOpen, setIsOwnerPickerOpen] = useState(false)
  const [formData, setFormData] = useState({
    companyName: '',
    solutionId: '',
    salesStartDate: new Date().toISOString().split('T')[0],
    ownerName: '',
  })

  const filteredCustomers = customers.filter((customer) => {
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

  const handleCreate = async () => {
    if (!formData.companyName.trim() || !formData.solutionId || !formData.ownerName) {
      alert('모든 필드를 입력해주세요.')
      return
    }

    const solutionName = solutions.find(s => s.id === formData.solutionId)?.name || ''
    
    addCustomer({
      companyName: formData.companyName,
      solutionId: formData.solutionId,
      solutionName,
      salesStartDate: new Date(formData.salesStartDate),
      ownerName: formData.ownerName,
    })

    const ownerRecipientEmails = normalizeRecipientEmails(
      users
        .filter((user) => user.displayName === formData.ownerName)
        .map((user) => user.email),
    )

    await sendCustomerNotification({
      type: 'created',
      customerName: formData.companyName,
      solutionName,
      ownerName: formData.ownerName,
      recipientEmails: ownerRecipientEmails,
    })

    setFormData({
      companyName: '',
      solutionId: '',
      salesStartDate: new Date().toISOString().split('T')[0],
      ownerName: '',
    })
    setIsCreateOpen(false)
  }

  const handleShareConfirm = async (entities: any[]) => {
    if (!customerToShare) return
    
    // Separate users and groups
    const userIds = entities.filter(e => e.type === 'user').map(e => e.id)
    const groupIds = entities.filter(e => e.type === 'group').map(e => e.id)
    
    // Update customer with shared information
    shareCustomer(customerToShare.id, userIds, groupIds)

    const directUserEmails = users
      .filter((user) => userIds.includes(user.id))
      .map((user) => user.email)

    const groupMemberEmails = users
      .filter((user) => (user.groupIds ?? []).some((groupId) => groupIds.includes(groupId)))
      .map((user) => user.email)

    const recipientEmails = normalizeRecipientEmails([...directUserEmails, ...groupMemberEmails])

    await sendCustomerNotification({
      type: 'shared',
      customerName: customerToShare.companyName,
      solutionName: customerToShare.solutionName,
      ownerName: customerToShare.ownerName,
      recipientEmails,
      sharedEntityNames: entities.map((entity) => entity.name),
    })
    
    const entityNames = entities.map(e => e.name).join(', ')
    alert(
      `${customerToShare.companyName} 정보가 다음에 공유되었습니다:\n${entityNames}`
    )
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
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center gap-4 px-4">
            <SidebarTrigger />
          </div>
        </header>
        
        <main className="flex-1 w-full overflow-y-auto bg-[#F8FAFC] dark:bg-[#131313]">
          <div className="w-full px-6 py-8 lg:px-12 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#1b1b23] dark:text-[#e5e2e1]">고객 관리</h1>
                <p className="text-[#64748B] dark:text-[#908fa0] mt-1">등록된 고객사를 관리합니다.</p>
              </div>
            
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                고객 등록
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 border-b border-[#E2E8F0] dark:border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B] dark:text-[#908fa0]" />
                <Input
                  placeholder="고객사 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white border-[#E2E8F0] dark:bg-[#1E1E1E] dark:border-[#464554]/50"
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
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                {customers.length === 0 
                  ? "등록된 고객사가 없습니다." 
                  : "검색 조건에 맞는 고객사가 없습니다."}
              </p>
              {customers.length === 0 && (
                <Button asChild className="mt-4">
                  <Link href="/customers/new">
                    <Plus className="mr-2 h-4 w-4" />
                    첫 고객 등록하기
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredCustomers.map((customer) => {
                const progress = getProgress(customer)
                return (
                  <Card 
                    key={customer.id} 
                    className="bg-white border-[#E2E8F0] shadow-[0_4px_20px_-4px_rgba(30,41,59,0.05)] hover:shadow-[0_12px_24px_-8px_rgba(30,41,59,0.1)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]"
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
                            <Building2 className="h-5 w-5 text-[#4648d4] dark:text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[#1b1b23] dark:text-[#e5e2e1]">
                              {customer.companyName}
                            </h3>
                            <p className="text-sm text-[#64748B] dark:text-[#908fa0]">
                              {customer.solutionName}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-[#64748B] dark:text-[#908fa0]">
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
                          <span className="text-[#64748B] dark:text-[#908fa0]">진행률</span>
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

        {/* Create Customer Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-md dark:bg-[#1c1b1b] dark:border-[#464554]">
            <DialogHeader className="dark:border-b dark:border-[#464554]">
              <DialogTitle className="dark:text-[#e5e2e1]">새 고객 등록</DialogTitle>
              <DialogDescription className="dark:text-[#c7c4d7]">고객 정보를 입력해주세요.</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company" className="dark:text-[#e5e2e1]">기업명</Label>
                <Input
                  id="company"
                  placeholder="기업명을 입력하세요"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="solution" className="dark:text-[#e5e2e1]">솔루션 선택</Label>
                <Select value={formData.solutionId} onValueChange={(value) => setFormData({ ...formData, solutionId: value })}>
                  <SelectTrigger id="solution" className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1]">
                    <SelectValue placeholder="솔루션을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-[#1c1b1b] dark:border-[#464554]">
                    {solutions.map((solution) => (
                      <SelectItem key={solution.id} value={solution.id} className="dark:text-[#c7c4d7] dark:focus:bg-[#2a2a2a] dark:focus:text-[#e5e2e1]">
                        {solution.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate" className="dark:text-[#e5e2e1]">시작일 선택</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.salesStartDate}
                  onChange={(e) => setFormData({ ...formData, salesStartDate: e.target.value })}
                  className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner" className="dark:text-[#e5e2e1]">담당자 선택</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"
                  onClick={() => setIsOwnerPickerOpen(true)}
                >
                  <span className={formData.ownerName ? 'text-foreground dark:text-[#e5e2e1]' : 'text-muted-foreground dark:text-[#908fa0]'}>
                    {formData.ownerName || '담당자를 선택하세요'}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </div>
            </div>

            <DialogFooter className="dark:border-t dark:border-t-[#464554] pt-6">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]">취소</Button>
              <Button onClick={handleCreate} className="dark:bg-primary dark:text-white dark:hover:bg-primary/90">등록</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Owner Picker */}
        <OwnerPicker
          open={isOwnerPickerOpen}
          onOpenChange={setIsOwnerPickerOpen}
          users={users}
          groups={groups}
          selectedOwner={formData.ownerName}
          onConfirm={(owners) => setFormData({ ...formData, ownerName: owners.map(o => o.name).join(', ') })}
        />

        {/* Share Dialog */}
        {customerToShare && (
          <ShareDialog 
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            customerName={customerToShare.companyName}
            sharedUserIds={customerToShare.sharedUserIds}
            sharedGroupIds={customerToShare.sharedGroupIds}
            storeUsers={users}
            storeGroups={groups}
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