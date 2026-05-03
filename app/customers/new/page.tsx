"use client"

import Link from "next/link"
import { useState } from "react"
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, addDays } from "date-fns"
import { ko } from "date-fns/locale"
import { CalendarIcon, ArrowRight, Clock, FolderKanban, User, X, ChevronDown } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import EntraPicker from "@/components/entra-picker"
import type { PickerUser } from "@/components/entra-picker"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { Stage } from "@/lib/types"

function flattenStages(stages: Stage[]): Stage[] {
  return stages.flatMap((stage) => [stage, ...flattenStages(stage.children ?? [])])
}

export default function NewCustomerPage() {
  const router = useRouter()
  const { solutions, addCustomer } = useAppStore()
  
  const [companyName, setCompanyName] = useState("")
  const [solutionId, setSolutionId] = useState("")
  const [salesStartDate, setSalesStartDate] = useState<Date>()
  const [ownerId, setOwnerId] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const [isOwnerPickerOpen, setIsOwnerPickerOpen] = useState(false)
  const [isSolutionOpen, setIsSolutionOpen] = useState(true)

  const selectedSolution = solutions.find(s => s.id === solutionId)
  const flattenedSelectedStages = selectedSolution ? flattenStages(selectedSolution.stages) : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName || !solutionId || !salesStartDate || !ownerName) return

    const customerId = addCustomer({
      companyName,
      solutionId,
      salesStartDate,
      ownerId: ownerId || undefined,
      ownerName,
      ownerEmail: ownerEmail || undefined,
    })

    router.push(customerId ? `/customers/${customerId}` : "/customers")
  }

  const isValid = companyName && solutionId && salesStartDate && ownerName

  // Preview milestones
  const previewMilestones = selectedSolution && salesStartDate 
    ? flattenedSelectedStages.reduce((acc, stage, index) => {
        const previousDuration = flattenedSelectedStages
          .slice(0, index)
          .reduce((sum, s) => sum + s.durationDays, 0)
        const dueDate = addDays(salesStartDate, previousDuration + stage.durationDays)
        return [...acc, { ...stage, dueDate }]
      }, [] as (Stage & { dueDate: Date })[])
    : []

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
          <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-12">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[#1b1b23] dark:text-[#e5e2e1]">고객 등록</h1>
              <p className="text-[#64748B] dark:text-[#908fa0]">새로운 고객을 등록하고 로드맵을 자동 생성합니다.</p>
            </div>

            {solutions.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FolderKanban />
                      </EmptyMedia>
                      <EmptyTitle>등록된 솔루션이 없습니다</EmptyTitle>
                      <EmptyDescription>
                        고객을 만들기 전에 솔루션 관리에서 워크플로우 템플릿을 먼저 등록해야 합니다.
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
                <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>고객 정보</CardTitle>
              <CardDescription>고객사 정보와 적용할 솔루션을 선택하세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">고객사명</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="예: 삼성전자"
                    className="bg-secondary"
                  />
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setIsSolutionOpen((v) => !v)}
                    className="flex w-full items-center justify-between"
                  >
                    <Label className="pointer-events-none">솔루션</Label>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform duration-200",
                        isSolutionOpen ? "rotate-0" : "-rotate-90"
                      )}
                    />
                  </button>
                  {isSolutionOpen && (
                    <SolutionCardGrid
                      solutions={solutions}
                      value={solutionId}
                      onChange={setSolutionId}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>영업 시작일</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-secondary",
                          !salesStartDate && "text-muted-foreground"
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
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={salesStartDate}
                        onSelect={setSalesStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>담당자</Label>
                  {ownerName ? (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 items-center gap-2 rounded-md border bg-secondary px-3 py-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-primary/20 text-primary dark:bg-[#353534] dark:text-[#c0c1ff]">
                            {ownerName.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{ownerName}</span>
                        <button
                          type="button"
                          onClick={() => { setOwnerId(""); setOwnerName(""); setOwnerEmail("") }}
                          className="ml-auto text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsOwnerPickerOpen(true)}
                      >
                        변경
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start bg-secondary text-muted-foreground font-normal"
                      onClick={() => setIsOwnerPickerOpen(true)}
                    >
                      <User className="mr-2 h-4 w-4" />
                      담당자 선택
                    </Button>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => router.back()}
                    className="flex-1"
                  >
                    취소
                  </Button>
                  <Button type="submit" disabled={!isValid} className="flex-1">
                    등록하기
                  </Button>
                  <EntraPicker
                    open={isOwnerPickerOpen}
                    onOpenChange={setIsOwnerPickerOpen}
                    onConfirm={(selectedUsers: PickerUser[]) => {
                      if (selectedUsers.length > 0) {
                        setOwnerId(selectedUsers[0].id)
                        setOwnerName(selectedUsers[0].displayName)
                        setOwnerEmail(selectedUsers[0].email ?? "")
                      }
                    }}
                  />
                </div>
              </form>
            </CardContent>
          </Card>

                <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>마일스톤 미리보기</CardTitle>
              <CardDescription>
                선택한 솔루션에 따라 자동 생성될 마일스톤입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedSolution ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ArrowRight className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">솔루션을 선택하면 마일스톤이 표시됩니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {previewMilestones.map((milestone, index) => (
                    <div 
                      key={milestone.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border"
                    >
                      <Badge variant="outline" className="mt-0.5 shrink-0">
                        {index + 1}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{milestone.name}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
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
                    <div className="pt-2 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        총 소요 기간: <span className="font-medium text-foreground">
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
    </>
  )
}
