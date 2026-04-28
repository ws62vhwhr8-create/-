"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, addDays } from "date-fns"
import { ko } from "date-fns/locale"
import { CalendarIcon, ArrowRight, Clock, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export default function NewCustomerPage() {
  const router = useRouter()
  const { solutions, addCustomer } = useAppStore()
  
  const [companyName, setCompanyName] = useState("")
  const [solutionId, setSolutionId] = useState("")
  const [salesStartDate, setSalesStartDate] = useState<Date>()
  const [ownerName, setOwnerName] = useState("")

  const selectedSolution = solutions.find(s => s.id === solutionId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName || !solutionId || !salesStartDate || !ownerName) return

    addCustomer({
      companyName,
      solutionId,
      salesStartDate,
      ownerName,
    })

    router.push("/")
  }

  const isValid = companyName && solutionId && salesStartDate && ownerName

  // Preview milestones
  const previewMilestones = selectedSolution && salesStartDate 
    ? selectedSolution.stages.reduce((acc, stage, index) => {
        const previousDuration = selectedSolution.stages
          .slice(0, index)
          .reduce((sum, s) => sum + s.durationDays, 0)
        const dueDate = addDays(salesStartDate, previousDuration + stage.durationDays)
        return [...acc, { ...stage, dueDate }]
      }, [] as (typeof selectedSolution.stages[0] & { dueDate: Date })[])
    : []

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">고객 등록</h1>
          <p className="text-muted-foreground">새로운 고객을 등록하고 로드맵을 자동 생성합니다.</p>
        </div>

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
                  <Label htmlFor="solution">솔루션</Label>
                  <Select value={solutionId} onValueChange={setSolutionId}>
                    <SelectTrigger className="bg-secondary">
                      <SelectValue placeholder="솔루션 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {solutions.map((solution) => (
                        <SelectItem key={solution.id} value={solution.id}>
                          {solution.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Label htmlFor="ownerName">담당자</Label>
                  <Input
                    id="ownerName"
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="예: 홍길동"
                    className="bg-secondary"
                  />
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
                          {selectedSolution.stages.reduce((sum, s) => sum + s.durationDays, 0)}일
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
