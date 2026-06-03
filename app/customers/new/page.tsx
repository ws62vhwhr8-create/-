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
import { CalendarIcon, ArrowRight, Clock, FolderKanban, User, Users, X, ChevronDown, Sparkles, CalendarDays } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { EntraUserSelectDialog } from "@/components/entra-user-select-dialog"
import type { SelectedItem } from "@/components/entra-user-select-dialog"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { Stage } from "@/lib/types"
import { canAccessSolution, isAdminRole } from "@/lib/permissions"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

const MAX_START_DATE = addDays(new Date(), 180)

const newCustomerSchema = z.object({
  companyName: z.string().trim().min(1, "고객사명을 입력해주세요"),
  solutionId: z.string().min(1, "솔루션을 선택해주세요"),
  salesStartDate: z
    .date({
      required_error: "영업 시작일을 선택해주세요",
      invalid_type_error: "유효한 날짜를 선택해주세요",
    })
    .refine((value) => !Number.isNaN(value.getTime()), {
      message: "유효한 날짜를 선택해주세요",
    })
    .refine((value) => value <= MAX_START_DATE, {
      message: "영업 시작일은 오늘 기준 180일 이내로 선택해주세요",
    }),
  ownerId: z.string().optional(),
  ownerName: z.string().trim().min(1, "담당자를 선택해주세요"),
  ownerEmail: z.string().optional(),
})

type NewCustomerFormValues = z.infer<typeof newCustomerSchema>

interface DuplicateConflictResponse {
  error?: string
  code?: string
  duplicateCount?: number
}

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
  const { solutions, users, currentUserId, currentEntraId } = useAppStore()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors, touchedFields, isSubmitted, isDirty, isSubmitting },
  } = useForm<NewCustomerFormValues>({
    resolver: zodResolver(newCustomerSchema),
    mode: 'onBlur',
    defaultValues: {
      companyName: '',
      solutionId: '',
      salesStartDate: undefined,
      ownerId: '',
      ownerName: '',
      ownerEmail: '',
    },
  })
  
  const companyName = watch('companyName') ?? ''
  const solutionId = watch('solutionId') ?? ''
  const salesStartDate = watch('salesStartDate')
  const ownerId = watch('ownerId') ?? ''
  const ownerName = watch('ownerName') ?? ''
  const ownerEmail = watch('ownerEmail') ?? ''

  const [isOwnerPickerOpen, setIsOwnerPickerOpen] = useState(false)
  const [isSolutionOpen, setIsSolutionOpen] = useState(true)
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false)
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false)
  const [isDuplicateSubmitting, setIsDuplicateSubmitting] = useState(false)
  const [pendingDuplicatePayload, setPendingDuplicatePayload] = useState<NewCustomerFormValues | null>(null)
  const [selectedOwnerItems, setSelectedOwnerItems] = useState<SelectedItem[]>([])
  const [useCustomSchedule, setUseCustomSchedule] = useState(false)
  const [adjustedStageDurations, setAdjustedStageDurations] = useState<Record<string, number>>({})

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

  // 솔루션이 변경되면 adjustedStageDurations 초기화
  useEffect(() => {
    if (selectedSolution) {
      const allStages = flattenStages(selectedSolution.stages)
      const initial: Record<string, number> = {}
      allStages.forEach(stage => {
        initial[stage.id] = stage.durationDays
      })
      setAdjustedStageDurations(initial)
    }
  }, [solutionId])

  const createCustomerAndMilestones = async (
    validated: NewCustomerFormValues,
    options?: { allowDuplicate?: boolean }
  ) => {
    if (!selectedSolution) {
      await trigger('solutionId')
      return
    }

    const allowDuplicate = options?.allowDuplicate ?? false

    // 조정된 기간 기반 전체 프로젝트 기간 계산
    const durationsBasis = useCustomSchedule ? adjustedStageDurations : 
      flattenedSelectedStagesWithOrder.reduce((acc, stage) => {
        acc[stage.id] = stage.durationDays
        return acc
      }, {} as Record<string, number>)
    
    const totalProjectDays = Object.values(durationsBasis).reduce((sum, days) => sum + days, 0)
    const projectEndDate = addDays(validated.salesStartDate, totalProjectDays)

    try {
      const customerResponse = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: validated.companyName,
          solutionId: validated.solutionId,
          solutionName: selectedSolution.name,
          solutionTemplateVersion: selectedSolution.templateVersion ?? 1,
          salesStartDate: validated.salesStartDate.toISOString(),
          ownerId: ownerId || undefined,
          ownerName: validated.ownerName,
          ownerEmail: ownerEmail || undefined,
          useCustomSchedule: useCustomSchedule || false,
          adjustedStageDurations: useCustomSchedule ? adjustedStageDurations : undefined,
          totalProjectDays,
          projectEndDate: projectEndDate.toISOString(),
          allowDuplicate,
        }),
      })

      if (!customerResponse.ok) {
        const errorData = (await customerResponse.json().catch(() => ({}))) as DuplicateConflictResponse
        if (customerResponse.status === 409 && errorData.code === 'DUPLICATE_COMPANY' && !allowDuplicate) {
          setPendingDuplicatePayload(validated)
          setIsDuplicateDialogOpen(true)
          toast.warning(errorData.error ?? '동일한 고객사명이 존재합니다. 계속 진행 여부를 확인해주세요.')
          return
        }

        throw new Error(errorData.error ?? '고객 생성 API 요청이 실패했습니다.')
      }

      const createdCustomer = await customerResponse.json()

      const milestoneRequests = flattenedSelectedStagesWithOrder.map((stage, index) => {
        const durationBasis = useCustomSchedule
          ? (adjustedStageDurations[stage.id] || stage.durationDays)
          : stage.durationDays
        const previousDuration = flattenedSelectedStagesWithOrder
          .slice(0, index)
          .reduce((sum, s) => {
            const sDuration = useCustomSchedule
              ? (adjustedStageDurations[s.id] || s.durationDays)
              : s.durationDays
            return sum + sDuration
          }, 0)

        const dueDate = addDays(validated.salesStartDate, previousDuration + durationBasis)
        const notifyOffset = Number.isFinite(stage.notifyDaysBefore) ? stage.notifyDaysBefore : 0
        const notifyDate = addDays(dueDate, -notifyOffset)

        return fetch('/api/milestones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: createdCustomer.id,
            stageId: stage.id,
            stageName: stage.name,
            stageLevel: stage.level ?? 0,
            dueDate: dueDate.toISOString(),
            notifyDate: notifyDate.toISOString(),
            role: stage.role,
            status: 'pending',
          }),
        })
      })

      const milestoneResults = await Promise.all(milestoneRequests)
      const hasMilestoneFailure = milestoneResults.some((res) => !res.ok)
      if (hasMilestoneFailure) {
        toast.warning('고객은 생성되었지만 일부 마일스톤 생성에 실패했습니다.')
      } else {
        toast.success('고객이 등록되었습니다')
      }

      setPendingDuplicatePayload(null)
      setIsDuplicateDialogOpen(false)
      router.push(`/customers/${createdCustomer.id}`)
    } catch (error) {
      console.error('고객 등록 실패:', error)
      toast.error(error instanceof Error ? error.message : '등록에 실패했습니다. 다시 시도해주세요')
    } finally {
      if (allowDuplicate) {
        setIsDuplicateSubmitting(false)
      }
    }
  }

  const onSubmit = async (validated: NewCustomerFormValues) => {
    await createCustomerAndMilestones(validated)
  }

  const handleDuplicateConfirm = async () => {
    if (!pendingDuplicatePayload) {
      setIsDuplicateDialogOpen(false)
      return
    }

    setIsDuplicateSubmitting(true)
    await createCustomerAndMilestones(pendingDuplicatePayload, { allowDuplicate: true })
  }

  const isValid = !!(companyName.trim() && solutionId && salesStartDate && ownerName.trim())
  const showFieldError = (field: keyof NewCustomerFormValues) => {
    return Boolean(errors[field] && (touchedFields[field] || isSubmitted))
  }

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Preview milestones
  const previewMilestones = selectedSolution && salesStartDate 
    ? flattenedSelectedStagesWithOrder.reduce((acc, stage, index) => {
        const durationBasis = useCustomSchedule 
          ? (adjustedStageDurations[stage.id] || stage.durationDays)
          : stage.durationDays
        const previousDuration = flattenedSelectedStagesWithOrder
          .slice(0, index)
          .reduce((sum, s) => {
            const sDuration = useCustomSchedule 
              ? (adjustedStageDurations[s.id] || s.durationDays)
              : s.durationDays
            return sum + sDuration
          }, 0)
        const dueDate = addDays(salesStartDate, previousDuration + durationBasis)
        return [...acc, { ...stage, dueDate, adjustedDuration: durationBasis }]
      }, [] as Array<Stage & { dueDate: Date; displayOrder: string; adjustedDuration?: number }>)
    : []

  const standardTotalDays = flattenedSelectedStages.reduce((sum, stage) => sum + stage.durationDays, 0)
  const customTotalDays = flattenedSelectedStagesWithOrder.reduce((sum, stage) => {
    return sum + (adjustedStageDurations[stage.id] || stage.durationDays)
  }, 0)
  const activeTotalDays = useCustomSchedule ? customTotalDays : standardTotalDays
  const activeEndDate = salesStartDate ? addDays(salesStartDate, activeTotalDays) : undefined

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

        <main className="app-surface flex-1 w-full overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-12">
            <div className="mb-6 p-6 md:p-7">
              <span className="menu-kicker">Customer Onboarding</span>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1e1b4b] dark:text-[#e5e2e1]">고객 등록</h1>
              <p className="text-sm text-[#5b5785] dark:text-[#908fa0] mt-1.5">신규 고객을 등록하고 솔루션 템플릿으로 초기 로드맵을 자동 구성합니다.</p>
            </div>

            {accessibleSolutions.length === 0 ? (
              <Card className="bg-white border-[#dbd6f0] dark:bg-[#1E1E1E] dark:border-[#333333]">
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
              <ResizablePanelGroup
                direction="horizontal"
                className="min-h-[860px] w-full items-stretch overflow-hidden rounded-3xl border border-[#dbd6f0] bg-white/60 shadow-sm dark:border-[#333333] dark:bg-[#1E1E1E]/60"
              >
                <ResizablePanel defaultSize={44} minSize={34} maxSize={58} className="min-w-0">
                  <Card className="h-full border-0 bg-transparent shadow-none dark:bg-transparent">
            <CardHeader>
              <CardTitle>고객 정보</CardTitle>
              <CardDescription>고객사 정보와 적용할 솔루션을 선택하세요.</CardDescription>
            </CardHeader>
            <CardContent className="h-full">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">고객사명 <span className="text-red-500 dark:text-[#ffb4ab]">*</span></Label>
                  <Input
                    id="companyName"
                    {...register('companyName')}
                    placeholder="예: 삼성전자"
                    className={cn("bg-white dark:bg-[#1E1E1E]", showFieldError('companyName') && "border-red-500 dark:border-[#ffb4ab]")}
                  />
                  {showFieldError('companyName') && <p className="text-sm text-red-500 dark:text-[#ffb4ab]">{errors.companyName?.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>영업 시작일 <span className="text-red-500 dark:text-[#ffb4ab]">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-white dark:bg-[#1E1E1E]",
                          !salesStartDate && "text-[#6360a0] dark:text-[#908fa0]",
                          showFieldError('salesStartDate') && "border-red-500 dark:border-[#ffb4ab]"
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
                        onSelect={(d) => {
                          if (!d) return
                          setValue('salesStartDate', d, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {showFieldError('salesStartDate') && <p className="text-sm text-red-500 dark:text-[#ffb4ab]">{errors.salesStartDate?.message}</p>}
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
                        "h-4 w-4 text-[#6360a0] dark:text-[#908fa0] transition-transform duration-200",
                        isSolutionOpen ? "rotate-0" : "-rotate-90"
                      )}
                    />
                  </button>
                  {isSolutionOpen && (
                    <SolutionCardGrid
                      solutions={accessibleSolutions}
                      value={solutionId}
                      onChange={(id) => {
                        setValue('solutionId', id, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
                      }}
                    />
                  )}
                  {showFieldError('solutionId') && <p className="text-sm text-red-500 dark:text-[#ffb4ab]">{errors.solutionId?.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>담당자 <span className="text-red-500 dark:text-[#ffb4ab]">*</span></Label>
                  {selectedOwnerItems.length > 0 ? (
                    <div className="space-y-2">
                      <div className={cn("rounded-md border bg-white dark:bg-[#1E1E1E] border-[#dbd6f0] dark:border-[#464554]/50 p-2 space-y-2", showFieldError('ownerName') && "border-red-500 dark:border-[#ffb4ab]")}>
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
                                  setValue('ownerName', nextNames.join(", "), { shouldDirty: true, shouldTouch: true, shouldValidate: true })
                                  if (next.length === 1 && next[0].type === "user") {
                                    setValue('ownerId', next[0].user.id, { shouldDirty: true, shouldTouch: true })
                                    setValue('ownerEmail', next[0].user.email ?? "", { shouldDirty: true, shouldTouch: true })
                                  } else {
                                    setValue('ownerId', '', { shouldDirty: true, shouldTouch: true })
                                    setValue('ownerEmail', '', { shouldDirty: true, shouldTouch: true })
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
                      className={cn("w-full justify-start bg-white dark:bg-[#1E1E1E] text-[#6360a0] dark:text-[#908fa0] font-normal", showFieldError('ownerName') && "border-red-500 dark:border-[#ffb4ab]")}
                      onClick={() => setIsOwnerPickerOpen(true)}
                    >
                      <User className="mr-2 h-4 w-4" />
                      담당자 선택
                    </Button>
                  )}
                  {showFieldError('ownerName') && <p className="text-sm text-red-500 dark:text-[#ffb4ab]">{errors.ownerName?.message}</p>}
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
                      if (confirmedUsers.length === 0) {
                        toast.error('담당자는 사용자 1명을 선택해주세요')
                        return
                      }

                      if (items.length > 1) {
                        toast.info('담당자는 첫 번째 사용자 1명만 반영됩니다')
                      }

                      const singleOwner = confirmedUsers[0]
                      setSelectedOwnerItems([singleOwner])
                      setValue('ownerName', singleOwner.user.displayName, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
                      setValue('ownerId', singleOwner.user.id, { shouldDirty: true, shouldTouch: true })
                      setValue('ownerEmail', singleOwner.user.email ?? '', { shouldDirty: true, shouldTouch: true })
                    }}
                  />
                </div>
              </form>
            </CardContent>
          </Card>

                </ResizablePanel>

                <ResizableHandle withHandle className="mx-2 hidden lg:flex" />

                <ResizablePanel defaultSize={56} minSize={42} className="min-w-0">
                  <Card className="h-full border-0 bg-transparent shadow-none dark:bg-transparent">
                  <CardHeader>
                    <CardTitle>일정 설정</CardTitle>
                    <CardDescription>
                      표준 일정을 사용하거나 프로젝트에 맞게 단계별 기간을 조정할 수 있습니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-full">
                    {!selectedSolution ? (
                      <div className="flex flex-col items-center justify-center py-8 text-[#6360a0] dark:text-[#908fa0]">
                        <p className="text-sm">솔루션을 선택하면 일정을 설정할 수 있습니다.</p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className={cn(
                          "relative overflow-hidden rounded-2xl border p-4 shadow-sm",
                          "border-[#d8d0f5] bg-gradient-to-br from-white via-[#faf8ff] to-[#f3f7ff]",
                          "dark:border-[#333333] dark:from-[#17161d] dark:via-[#1c1b21] dark:to-[#151518]"
                        )}>
                          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#8b7cf0]/10 blur-3xl" />
                          <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-[#5bc0eb]/10 blur-3xl" />
                          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#5b57db] text-white shadow-lg shadow-[#5b57db]/25 dark:bg-[#7c78ff]">
                                <Sparkles className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#1e1b4b] dark:text-[#f3f2ff]">맞춤 일정 빌더</p>
                                <p className="text-sm text-[#6360a0] dark:text-[#a3a1bf]">
                                  체크하면 각 단계의 기간을 직접 조정하고, 즉시 완료일을 확인할 수 있습니다.
                                </p>
                              </div>
                            </div>

                            <div className="ml-auto flex items-center gap-2 rounded-xl border border-white/70 bg-white/80 px-3 py-2 shadow-sm backdrop-blur dark:border-[#3a3847] dark:bg-[#1f1e24]/85">
                              <input
                                type="checkbox"
                                id="useCustomSchedule"
                                checked={useCustomSchedule}
                                onChange={(e) => setUseCustomSchedule(e.target.checked)}
                                className="h-4 w-4 rounded border-[#c8c0eb] text-[#5b57db] focus:ring-[#5b57db]"
                              />
                              <label htmlFor="useCustomSchedule" className="cursor-pointer text-sm font-medium text-[#1e1b4b] dark:text-[#f3f2ff]">
                                맞춤 일정 설정
                              </label>
                            </div>
                          </div>

                          {salesStartDate && selectedSolution && (
                            <div className="relative mt-4 grid gap-3 sm:grid-cols-3">
                              <div className="rounded-2xl border border-[#dcd4f5] bg-white/85 p-4 shadow-sm dark:border-[#353245] dark:bg-[#1b1a20]/80">
                                <p className="text-xs uppercase tracking-[0.18em] text-[#7d74ba] dark:text-[#9a98c5]">기준일</p>
                                <p className="mt-2 text-sm font-semibold text-[#1e1b4b] dark:text-[#f3f2ff]">
                                  {format(salesStartDate, "yyyy.MM.dd", { locale: ko })}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-[#dcd4f5] bg-white/85 p-4 shadow-sm dark:border-[#353245] dark:bg-[#1b1a20]/80">
                                <p className="text-xs uppercase tracking-[0.18em] text-[#7d74ba] dark:text-[#9a98c5]">전체 기간</p>
                                <p className="mt-2 text-sm font-semibold text-[#1e1b4b] dark:text-[#f3f2ff]">
                                  {activeTotalDays}일
                                  <span className="ml-2 text-xs font-normal text-[#7d74ba] dark:text-[#9a98c5]">
                                    약 {Math.round(activeTotalDays / 30 * 10) / 10}개월
                                  </span>
                                </p>
                              </div>
                              <div className="rounded-2xl border border-[#dcd4f5] bg-white/85 p-4 shadow-sm dark:border-[#353245] dark:bg-[#1b1a20]/80">
                                <p className="text-xs uppercase tracking-[0.18em] text-[#7d74ba] dark:text-[#9a98c5]">예상 완료일</p>
                                <p className="mt-2 text-sm font-semibold text-[#1e1b4b] dark:text-[#f3f2ff]">
                                  {activeEndDate ? format(activeEndDate, "yyyy.MM.dd", { locale: ko }) : "-"}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {useCustomSchedule ? (
                          <div className="rounded-3xl border border-[#d9d2f2] bg-gradient-to-b from-white to-[#faf8ff] p-4 shadow-sm dark:border-[#353245] dark:from-[#1b1a20] dark:to-[#17161b]">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-[#1e1b4b] dark:text-[#f3f2ff]">단계별 기간 편집</p>
                                <p className="text-xs leading-5 text-[#6f689d] dark:text-[#9d9ab8]">각 단계의 기간을 바로 수정하면 완료일이 즉시 재계산됩니다.</p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {flattenedSelectedStagesWithOrder.map((stage, index) => {
                                const currentDuration = adjustedStageDurations[stage.id] || stage.durationDays
                                const stageCompletion = previewMilestones[index]
                                const accentClasses = ["from-[#5b57db] to-[#8b7cf0]", "from-[#12b5a6] to-[#5bc0eb]", "from-[#f59e0b] to-[#f97316]", "from-[#ec4899] to-[#a855f7]", "from-[#22c55e] to-[#14b8a6]"]
                                const accentClass = accentClasses[index % accentClasses.length]
                                const durationShare = customTotalDays > 0 ? Math.max(8, (currentDuration / customTotalDays) * 100) : 20
                                const ownerDisplayName = stage.role === "영업 담당자" && ownerName ? ownerName : stage.role

                                return (
                                  <div key={stage.id} className="group relative overflow-hidden rounded-2xl border border-[#e3dcf8] bg-white/90 px-4 py-3 shadow-[0_10px_24px_rgba(86,72,146,0.08)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(86,72,146,0.12)] dark:border-[#373445] dark:bg-[#1e1d24]/90">
                                    <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${accentClass}`} />
                                    <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#8b7cf0]/5 blur-3xl" />

                                    <div className="relative flex flex-col gap-2">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <Badge className="h-6 rounded-full bg-[#f0ecff] px-2 text-[#5b57db] hover:bg-[#f0ecff] dark:bg-[#2b2742] dark:text-[#d4d0ff]">
                                            {stage.displayOrder}
                                          </Badge>
                                          <div className="min-w-0">
                                            <span className="text-xs font-medium uppercase tracking-[0.16em] leading-none text-[#8a84ae] dark:text-[#9f9ac2]">
                                              Step
                                            </span>
                                            <p className="mt-0.5 truncate text-sm font-semibold leading-5 text-[#1d1a44] dark:text-[#f3f2ff]">
                                              {stage.name}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 rounded-xl border border-[#ddd6f5] bg-[#fbfaff] px-2.5 py-1.5 dark:border-[#3a3849] dark:bg-[#23212d]">
                                          <span className="text-[11px] font-medium text-[#8a84ae] dark:text-[#9f9ac2]">조정 기간</span>
                                          <div className="flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 shadow-sm dark:bg-[#191821]">
                                            <Input
                                              type="number"
                                              min="1"
                                              max="365"
                                              value={currentDuration}
                                              onChange={(e) => {
                                                const val = Math.max(1, parseInt(e.target.value) || 1)
                                                setAdjustedStageDurations(prev => ({
                                                  ...prev,
                                                  [stage.id]: val
                                                }))
                                              }}
                                              className="h-7 w-14 border-0 bg-transparent p-0 text-right text-sm font-semibold text-[#1e1b4b] shadow-none focus-visible:ring-0 dark:text-[#f3f2ff]"
                                            />
                                            <span className="text-xs font-medium text-[#6f689d] dark:text-[#a09cc0]">일</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6f689d] dark:text-[#a09cc0]">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f7f5ff] px-2.5 py-1 dark:bg-[#262433]">
                                          <Clock className="h-3.5 w-3.5" />
                                          표준 {stage.durationDays}일
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f7f5ff] px-2.5 py-1 dark:bg-[#262433]">
                                          <User className="h-3.5 w-3.5" />
                                          {ownerDisplayName}
                                        </span>
                                        {stageCompletion && (
                                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            {format(stageCompletion.dueDate, "MM/dd", { locale: ko })}
                                          </span>
                                        )}
                                      </div>

                                      <div className="mt-1">
                                        <div className="mb-1 flex items-center justify-between text-[11px] text-[#8a84ae] dark:text-[#9f9ac2]">
                                          <span>프로젝트 비중</span>
                                          <span>{Math.round(durationShare)}%</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-[#ece7fb] dark:bg-[#2d2a3a]">
                                          <div
                                            className={`h-full rounded-full bg-gradient-to-r ${accentClass}`}
                                            style={{ width: `${durationShare}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-[#d9d2f2] bg-[#f8f6ff] p-4 dark:border-[#383546] dark:bg-[#22212c]">
                                <p className="text-xs uppercase tracking-[0.18em] text-[#8a84ae] dark:text-[#9f9ac2]">현재 설정 요약</p>
                                <p className="mt-2 text-sm text-[#6f689d] dark:text-[#a09cc0]">
                                  커스텀 기간 기준으로 총 <span className="font-semibold text-[#1e1b4b] dark:text-[#f3f2ff]">{customTotalDays}일</span>이 적용됩니다.
                                </p>
                              </div>
                              <div className="rounded-2xl border border-[#d9d2f2] bg-[#f8f6ff] p-4 dark:border-[#383546] dark:bg-[#22212c]">
                                <p className="text-xs uppercase tracking-[0.18em] text-[#8a84ae] dark:text-[#9f9ac2]">예상 완료일</p>
                                <p className="mt-2 text-sm text-[#6f689d] dark:text-[#a09cc0]">
                                  {activeEndDate ? (
                                    <span className="font-semibold text-[#1e1b4b] dark:text-[#f3f2ff]">
                                      {format(activeEndDate, "yyyy.MM.dd", { locale: ko })}
                                    </span>
                                  ) : (
                                    "영업 시작일을 선택하면 자동 계산됩니다."
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-3xl border border-[#d9d2f2] bg-white p-4 shadow-sm dark:border-[#353245] dark:bg-[#1b1a20]">
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-[#1e1b4b] dark:text-[#f3f2ff]">표준 일정 미리보기</p>
                                <p className="text-xs text-[#6f689d] dark:text-[#9d9ab8]">표준 기간과 예상 완료일을 한눈에 확인할 수 있습니다.</p>
                              </div>
                              <div className="rounded-full border border-[#d9d2f2] bg-[#f5f3ff] px-3 py-1 text-xs text-[#5b57db] dark:border-[#363349] dark:bg-[#242235] dark:text-[#c0bbff]">
                                {standardTotalDays}일
                              </div>
                            </div>

                            <div className="space-y-3">
                              {previewMilestones.map((milestone, index) => (
                                <div key={milestone.id} className="flex items-start gap-3 rounded-2xl border border-[#e3dcf8] bg-[#fbfaff] p-4 dark:border-[#373445] dark:bg-[#1e1d24]">
                                  <Badge variant="outline" className="mt-0.5 shrink-0 rounded-full">
                                    {milestone.displayOrder}
                                  </Badge>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-[#1e1b4b] dark:text-[#f3f2ff]">{milestone.name}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6360a0] dark:text-[#908fa0]">
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 dark:bg-[#262433]">
                                        <Clock className="h-3.5 w-3.5" />
                                        {milestone.durationDays}일
                                      </span>
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 dark:bg-[#262433]">
                                        <User className="h-3.5 w-3.5" />
                                        {milestone.role}
                                      </span>
                                      {salesStartDate && (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                          <CalendarDays className="h-3.5 w-3.5" />
                                          {format(milestone.dueDate, "MM/dd", { locale: ko })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-4 rounded-2xl border border-[#d9d2f2] bg-[#f8f6ff] p-4 dark:border-[#383546] dark:bg-[#22212c]">
                              <p className="text-xs uppercase tracking-[0.18em] text-[#8a84ae] dark:text-[#9f9ac2]">예상 완료일</p>
                              <p className="mt-2 text-sm text-[#6f689d] dark:text-[#a09cc0]">
                                {activeEndDate ? (
                                  <span className="font-semibold text-[#1e1b4b] dark:text-[#f3f2ff]">
                                    {format(activeEndDate, "yyyy.MM.dd", { locale: ko })}
                                  </span>
                                ) : (
                                  "영업 시작일을 선택하면 자동 계산됩니다."
                                )}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
                </ResizablePanel>
              </ResizablePanelGroup>
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

      <AlertDialog
        open={isDuplicateDialogOpen}
        onOpenChange={(open) => {
          if (isDuplicateSubmitting) return
          setIsDuplicateDialogOpen(open)
        }}
      >
        <AlertDialogContent className="bg-white dark:bg-[#1c1b1b] dark:border-[#464554]">
          <AlertDialogHeader>
            <AlertDialogTitle>동일한 고객사명이 이미 존재합니다</AlertDialogTitle>
            <AlertDialogDescription>
              기존 데이터와 중복될 수 있습니다. 그래도 신규 고객으로 계속 등록하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDuplicateSubmitting}
              onClick={() => {
                if (isDuplicateSubmitting) return
                setIsDuplicateDialogOpen(false)
              }}
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction disabled={isDuplicateSubmitting} onClick={handleDuplicateConfirm}>
              {isDuplicateSubmitting ? '등록 중...' : '중복 허용 후 등록'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

