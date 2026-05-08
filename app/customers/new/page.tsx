"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SolutionCardGrid } from "@/components/solution-card-grid"
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, addDays } from "date-fns"
import { ko } from "date-fns/locale"
import { CalendarIcon, ArrowRight, Clock, FolderKanban, User, Users, X, ChevronDown } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { EntraUserSelectDialog } from "@/components/entra-user-select-dialog"
import type { SelectedItem } from "@/components/entra-user-select-dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { Stage } from "@/lib/types"
import { canAccessSolution, isAdminRole } from "@/lib/permissions"

function flattenStages(stages: Stage[]): Stage[] {
  return stages.flatMap((stage) => [stage, ...flattenStages(stage.children ?? [])])
}

function flattenStagesWithDisplayOrder(
  stages: Stage[],
  prefix: number[] = []
): Array<Stage & { displayOrder: string }> {
  return stages.flatMap((stage, index) => {
    const currentPath = [...prefix, index + 1]
    return [
      { ...stage, displayOrder: currentPath.join("-") },
      ...flattenStagesWithDisplayOrder(stage.children ?? [], currentPath),
    ]
  })
}

export default function NewCustomerPage() {
  const router = useRouter()
  const { solutions, addCustomer, users, currentUserId, currentEntraId } = useAppStore()
  
  const [companyName, setCompanyName] = useState("")
  const [solutionId, setSolutionId] = useState("")
  const [salesStartDate, setSalesStartDate] = useState<Date>()
  const [ownerId, setOwnerId] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const [isOwnerPickerOpen, setIsOwnerPickerOpen] = useState(false)
  const [isSolutionOpen, setIsSolutionOpen] = useState(true)
  const [touched, setTouched] = useState({ companyName: false, solutionId: false, salesStartDate: false, ownerName: false })
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedOwnerItems, setSelectedOwnerItems] = useState<SelectedItem[]>([])

  const currentUser = users.find((user) => user.id === currentUserId)
  const isAdmin = isAdminRole(currentUser?.role)
  const accessibleSolutions = solutions.filter((solution) =>
    canAccessSolution({
      solution,
      currentUser,
      currentEntraId,
      isAdmin,
    }),
  )

  const selectedSolution = accessibleSolutions.find(s => s.id === solutionId)
  const flattenedSelectedStages = selectedSolution ? flattenStages(selectedSolution.stages) : []
  const flattenedSelectedStagesWithOrder = selectedSolution
    ? flattenStagesWithDisplayOrder(selectedSolution.stages)
    : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName || !solutionId || !salesStartDate || !ownerName) {
      setTouched({ companyName: true, solutionId: true, salesStartDate: true, ownerName: true })
      return
    }
    if (isSubmitting) return
    setIsSubmitting(true)

    const customerId = addCustomer({
      companyName,
      solutionId,
      salesStartDate,
      ownerId: ownerId || undefined,
      ownerName,
      ownerEmail: ownerEmail || undefined,
    })

    if (customerId) {
      toast.success("고객이 등록되었습니다")
      router.push(`/customers/${customerId}`)
    } else {
      toast.error("등록에 실패했습니다. 다시 시도해주세요")
      setIsSubmitting(false)
    }
  }

  const isValid = companyName && solutionId && salesStartDate && ownerName
  const isDirty = !!(companyName || solutionId || salesStartDate || ownerName)

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const errors = {
    companyName: touched.companyName && !companyName.trim() ? "고객사명을 입력해주세요" : null,
    solutionId: touched.solutionId && !solutionId ? "솔루션을 선택해주세요" : null,
    salesStartDate: touched.salesStartDate && !salesStartDate ? "영업 시작일을 선택해주세요" : null,
    ownerName: touched.ownerName && !ownerName ? "담당자를 선택해주세요" : null,
  }

  // Preview milestones
  const previewMilestones = selectedSolution && salesStartDate 
    ? flattenedSelectedStagesWithOrder.reduce((acc, stage, index) => {
        const previousDuration = flattenedSelectedStagesWithOrder
          .slice(0, index)
          .reduce((sum, s) => sum + s.durationDays, 0)
        const dueDate = addDays(salesStartDate, previousDuration + stage.durationDays)
        return [...acc, { ...stage, dueDate }]
      }, [] as Array<Stage & { dueDate: Date; displayOrder: string }>)
    : []

  return (
    <>
      <Navigation />
      <SidebarInset>
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/98 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-14 items-center gap-3 px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="h-5 w-px bg-border/70" />
            <Link href="/customers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">고객 관리</Link>
            <span className="text-muted-foreground/50 text-sm">/</span>
            <span className="text-sm font-medium text-foreground">고객 등록</span>
          </div>
        </header>

        <main className="flex-1 w-full overflow-y-auto bg-[#F8FAFC] dark:bg-[#131313]">
          <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-12">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[#1b1b23] dark:text-[#e5e2e1]">고객 등록</h1>
              <p className="text-[#64748B] dark:text-[#908fa0]">새로운 고객을 등록하고 로드맵을 자동 생성합니다.</p>
            </div>

            {accessibleSolutions.length === 0 ? (
              <Card className="bg-white border-[#E2E8F0] dark:bg-[#1E1E1E] dark:border-[#333333]">
                <CardContent className="p-6">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FolderKanban />
                      </EmptyMedia>
                      <EmptyTitle>등록된 솔루션이 없습니다</EmptyTitle>
                      <EmptyDescription>
                        접근 가능한 솔루션이 없습니다. 관리자에게 솔루션 접근 권한을 요청하세요.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button asChild>
                        <Link href="/solutions">솔루션 관리로 이동</Link>
                      </Button>
                    </EmptyContent>
                  </Empty>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="bg-white border-[#E2E8F0] dark:bg-[#1E1E1E] dark:border-[#333333]">
            <CardHeader>
              <CardTitle>고객 정보</CardTitle>
              <CardDescription>고객사 정보와 적용할 솔루션을 선택하세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">고객사명 <span className="text-red-500 dark:text-[#ffb4ab]">*</span></Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    onBlur={() => setTouched(p => ({ ...p, companyName: true }))}
                    placeholder="예: 삼성전자"
                    className={cn("bg-white dark:bg-[#1E1E1E]", errors.companyName && "border-red-500 dark:border-[#ffb4ab]")}
                  />
                  {errors.companyName && <p className="text-sm text-red-500 dark:text-[#ffb4ab]">{errors.companyName}</p>}
                </div>

                <div className="space-y-2">
                  <Label>영업 시작일 <span className="text-red-500 dark:text-[#ffb4ab]">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-white dark:bg-[#1E1E1E]",
                          !salesStartDate && "text-[#64748B] dark:text-[#908fa0]",
                          errors.salesStartDate && "border-red-500 dark:border-[#ffb4ab]"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {salesStartDate ? (
                          format(salesStartDate, "PPP", { locale: ko })
                        ) : (
                          "날짜 선택"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" style={{ backgroundColor: 'var(--popover)' }} align="start">
                      <Calendar
                        mode="single"
                        selected={salesStartDate}
                        onSelect={(d) => { setSalesStartDate(d); setTouched(p => ({ ...p, salesStartDate: true })) }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.salesStartDate && <p className="text-sm text-red-500 dark:text-[#ffb4ab]">{errors.salesStartDate}</p>}
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setIsSolutionOpen((v) => !v)}
                    className="flex w-full items-center justify-between"
                  >
                    <Label className="pointer-events-none">솔루션 <span className="text-red-500 dark:text-[#ffb4ab]">*</span></Label>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-[#64748B] dark:text-[#908fa0] transition-transform duration-200",
                        isSolutionOpen ? "rotate-0" : "-rotate-90"
                      )}
                    />
                  </button>
                  {isSolutionOpen && (
                    <SolutionCardGrid
                      solutions={accessibleSolutions}
                      value={solutionId}
                      onChange={(id) => { setSolutionId(id); setTouched(p => ({ ...p, solutionId: true })) }}
                    />
                  )}
                  {errors.solutionId && <p className="text-sm text-red-500 dark:text-[#ffb4ab]">{errors.solutionId}</p>}
                </div>

                <div className="space-y-2">
                  <Label>담당자 <span className="text-red-500 dark:text-[#ffb4ab]">*</span></Label>
                  {selectedOwnerItems.length > 0 ? (
                    <div className="space-y-2">
                      <div className={cn("rounded-md border bg-white dark:bg-[#1E1E1E] border-[#E2E8F0] dark:border-[#464554]/50 p-2 space-y-2", errors.ownerName && "border-red-500 dark:border-[#ffb4ab]")}>
                        {selectedOwnerItems.map((item) => {
                          const itemId = item.type === "user" ? item.user.id : item.group.id
                          const name = item.type === "user" ? item.user.displayName : item.group.displayName
                          return (
                            <div key={itemId} className="flex items-center gap-2 p-2 rounded-lg border dark:border-[#464554] dark:bg-[#1c1b1b]">
                              <Avatar className="h-7 w-7 shrink-0">
                                <AvatarFallback className="text-xs bg-primary/20 text-primary dark:bg-[#353534] dark:text-[#c0c1ff]">
                                  {item.type === "group" ? <Users className="h-3 w-3" /> : name.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate dark:text-[#e5e2e1]">{name}</p>
                                <Badge variant="outline" className="text-xs py-0 mt-0.5 dark:border-[#464554] dark:text-[#c7c4d7]">
                                  {item.type === "group" ? "그룹" : "사용자"}
                                </Badge>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = selectedOwnerItems.filter((i) => (i.type === "user" ? i.user.id : i.group.id) !== itemId)
                                  setSelectedOwnerItems(next)
                                  const nextUsers = next.filter((i): i is Extract<SelectedItem, { type: "user" }> => i.type === "user")
                                  const nextGroups = next.filter((i): i is Extract<SelectedItem, { type: "group" }> => i.type === "group")
                                  const nextNames = [...nextUsers.map((i) => i.user.displayName), ...nextGroups.map((i) => i.group.displayName)]
                                  setOwnerName(nextNames.join(", "))
                                  if (next.length === 1 && next[0].type === "user") {
                                    setOwnerId(next[0].user.id)
                                    setOwnerEmail(next[0].user.email ?? "")
                                  } else {
                                    setOwnerId("")
                                    setOwnerEmail("")
                                  }
                                }}
                                className="shrink-0 text-muted-foreground hover:text-destructive dark:text-[#908fa0] dark:hover:text-red-400 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsOwnerPickerOpen(true)}>
                        수정
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("w-full justify-start bg-white dark:bg-[#1E1E1E] text-[#64748B] dark:text-[#908fa0] font-normal", errors.ownerName && "border-red-500 dark:border-[#ffb4ab]")}
                      onClick={() => setIsOwnerPickerOpen(true)}
                    >
                      <User className="mr-2 h-4 w-4" />
                      담당자 선택
                    </Button>
                  )}
                  {errors.ownerName && <p className="text-sm text-red-500 dark:text-[#ffb4ab]">{errors.ownerName}</p>}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      if (isDirty) {
                        setIsLeaveDialogOpen(true)
                      } else {
                        router.back()
                      }
                    }}
                    className="flex-1"
                  >
                    취소
                  </Button>
                  <Button type="submit" disabled={!isValid || isSubmitting} className="flex-1">
                    {isSubmitting ? "등록 중..." : "등록하기"}
                  </Button>
                  <EntraUserSelectDialog
                    open={isOwnerPickerOpen}
                    onOpenChange={setIsOwnerPickerOpen}
                    initialItems={selectedOwnerItems}
                    onConfirm={(items: SelectedItem[]) => {
                      const confirmedUsers = items.filter((item): item is Extract<SelectedItem, { type: "user" }> => item.type === "user")
                      const confirmedGroups = items.filter((item): item is Extract<SelectedItem, { type: "group" }> => item.type === "group")

                      const confirmedNames = [
                        ...confirmedUsers.map((item) => item.user.displayName),
                        ...confirmedGroups.map((item) => item.group.displayName),
                      ]

                      if (confirmedNames.length === 0) return

                      setSelectedOwnerItems(items)
                      setOwnerName(confirmedNames.join(", "))

                      if (confirmedUsers.length === 1 && confirmedGroups.length === 0) {
                        setOwnerId(confirmedUsers[0].user.id)
                        setOwnerEmail(confirmedUsers[0].user.email ?? "")
                      } else {
                        setOwnerId("")
                        setOwnerEmail("")
                      }

                      setTouched(p => ({ ...p, ownerName: true }))
                    }}
                  />
                </div>
              </form>
            </CardContent>
          </Card>

                <Card className="bg-white border-[#E2E8F0] dark:bg-[#1E1E1E] dark:border-[#333333]">
            <CardHeader>
              <CardTitle>마일스톤 미리보기</CardTitle>
              <CardDescription>
                선택한 솔루션에 따라 자동 생성될 마일스톤입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedSolution ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#64748B] dark:text-[#908fa0]">
                  <ArrowRight className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">솔루션을 선택하면 마일스톤이 표시됩니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {previewMilestones.map((milestone) => (
                    <div 
                      key={milestone.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#252525] border border-[#E2E8F0] dark:border-[#333333]"
                    >
                      <Badge variant="outline" className="mt-0.5 shrink-0">
                        {milestone.displayOrder}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{milestone.name}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-[#64748B] dark:text-[#908fa0]">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{milestone.durationDays}일</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{milestone.role}</span>
                          </div>
                          {salesStartDate && (
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              <span>
                                {format(milestone.dueDate, "MM/dd", { locale: ko })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {selectedSolution && (
                  <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#333333]">
                      <p className="text-sm text-[#64748B] dark:text-[#908fa0]">
                        열 소요 기간: <span className="font-medium text-[#1b1b23] dark:text-[#e5e2e1]">
                          {flattenedSelectedStages.reduce((sum, s) => sum + s.durationDays, 0)}일
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
              </div>
            )}
          </div>
        </main>
      </SidebarInset>

      <AlertDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-[#1c1b1b] dark:border-[#464554]">
          <AlertDialogHeader>
            <AlertDialogTitle>저장하지 않은 입력이 있습니다</AlertDialogTitle>
            <AlertDialogDescription>
              페이지를 떠나면 입력한 내용이 모두 사라집니다. 정말 취소하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>계속 입력</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.back()}>
              입력 내용 폐기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

