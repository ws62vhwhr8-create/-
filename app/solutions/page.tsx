"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, Edit2, Trash2, Clock, Layers, X, Users, User, Check, ChevronDown, ChevronRight } from "lucide-react"
import type { Solution, Stage } from "@/lib/types"

const createEmptyStage = (parentStageId: string | null = null, level: number = 0): Stage => ({
  id: crypto.randomUUID(),
  name: "",
  durationDays: 1,
  role: "담당자",
  notifyDaysBefore: 1,
  parentStageId,
  level,
  children: [],
})

const normalizeStages = (stages: Stage[], parentStageId: string | null = null, level: number = 0): Stage[] => {
  return (stages || []).map((stage) => ({
    ...stage,
    parentStageId: stage.parentStageId ?? parentStageId,
    level: stage.level ?? level,
    children: normalizeStages(stage.children ?? [], stage.id, (stage.level ?? level) + 1),
  }))
}

export default function SolutionsPage() {
  const router = useRouter()
  const { solutions, addSolution, updateSolution, deleteSolution, users, groups, currentUserId } = useAppStore()
  
  // 상태 관리
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSolution, setEditingSolution] = useState<Solution | null>(null)
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())
  const [accessListMode, setAccessListMode] = useState<'group' | 'user'>('group')
  
  // 폼 데이터 상태
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    stages: Stage[];
    userIds: string[];
    groupIds: string[];
  }>({
    name: "",
    description: "",
    stages: [createEmptyStage(null, 0)],
    userIds: [],
    groupIds: [],
  })

  const currentUser = users.find(u => u.id === currentUserId)

  // 트리 구조에서 모든 단계를 1차원 배열로 변환하여 총 기간 계산
  const getAllStages = (stages: Stage[]): Stage[] => {
    const result: Stage[] = []
    const traverse = (stageList: Stage[]) => {
      stageList.forEach(stage => {
        result.push(stage)
        if (stage.children && stage.children.length > 0) {
          traverse(stage.children)
        }
      })
    }
    traverse(stages)
    return result
  }

  const totalDuration = getAllStages(formData.stages).reduce((sum, s) => sum + (Number(s.durationDays) || 0), 0)

  // 수정 버튼 클릭 시 폼 데이터 초기화
  const handleEditClick = (solution: Solution) => {
    setEditingSolution(solution)
    setFormData({
      name: solution.name,
      description: solution.description || "",
      stages: normalizeStages(solution.stages),
      userIds: solution.userIds || [],
      groupIds: solution.groupIds || [],
    })
    setExpandedStages(new Set())
    setIsDialogOpen(true)
  }

  // 새 솔루션 클릭 시 폼 초기화
  const handleCreateClick = () => {
    setEditingSolution(null)
    setFormData({
      name: "",
      description: "",
      stages: [createEmptyStage(null, 0)],
      userIds: [],
      groupIds: [],
    })
    setExpandedStages(new Set())
    setIsDialogOpen(true)
  }

  // 특정 스테이지 찾기 (재귀)
  const findStageById = (stageId: string, stages: Stage[]): Stage | undefined => {
    for (const stage of stages) {
      if (stage.id === stageId) return stage
      if (stage.children) {
        const found = findStageById(stageId, stage.children)
        if (found) return found
      }
    }
    return undefined
  }

  // 단계에 하위 단계 추가
  const addChildStage = (parentStageId: string) => {
    const parentStage = findStageById(parentStageId, formData.stages)
    const parentLevel = parentStage?.level ?? 0
    if (parentStage && parentLevel < 2) { // 최대 3레벨 (0, 1, 2)
      const newStage = createEmptyStage(parentStageId, parentLevel + 1)
      if (!parentStage.children) {
        parentStage.children = []
      }
      parentStage.children.push(newStage)
      setFormData({ ...formData, stages: [...formData.stages] })
      setExpandedStages(new Set([...expandedStages, parentStageId]))
    }
  }

  // 단계 추가 (1레벨)
  const addStage = () => {
    setFormData({ ...formData, stages: [...formData.stages, createEmptyStage(null, 0)] })
  }

  // 단계 제거 (하위 단계도 함께 제거)
  const removeStage = (stageId: string, stages: Stage[]): Stage[] => {
    return stages.filter(stage => {
      if (stage.id === stageId) {
        return false // 제거
      }
      if (stage.children) {
        stage.children = removeStage(stageId, stage.children)
      }
      return true
    })
  }

  const handleRemoveStage = (stageId: string) => {
    const newStages = removeStage(stageId, formData.stages)
    setFormData({ ...formData, stages: newStages })
  }

  // 단계 업데이트
  const updateStage = (stageId: string, field: "name" | "durationDays", value: string | number, stages: Stage[]): Stage[] => {
    return stages.map(stage => {
      if (stage.id === stageId) {
        return { ...stage, [field]: value }
      }
      if (stage.children) {
        return { ...stage, children: updateStage(stageId, field, value, stage.children) }
      }
      return stage
    })
  }

  const handleUpdateStage = (stageId: string, field: "name" | "durationDays", value: string | number) => {
    const newStages = updateStage(stageId, field, value, formData.stages)
    setFormData({ ...formData, stages: newStages })
  }

  // 토글
  const toggleExpand = (stageId: string) => {
    const newExpanded = new Set(expandedStages)
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId)
    } else {
      newExpanded.add(stageId)
    }
    setExpandedStages(newExpanded)
  }

  // 저장 핸들러
  const handleSave = () => {
    if (!formData.name.trim()) return alert("솔루션명을 입력해주세요.")

    if (editingSolution) {
      updateSolution(editingSolution.id, formData)
    } else {
      addSolution({
        ...formData,
      })
    }
    setIsDialogOpen(false)
  }

  // 접근 권한 필터링
  const hasAccess = (solution: Solution) => {
    const userIds = solution.userIds || []
    const groupIds = solution.groupIds || []
    if (userIds.length === 0 && groupIds.length === 0) return true
    if (!currentUser) return false
    if (userIds.includes(currentUser.id)) return true
    const userGroups = currentUser.groupIds || []
    return userGroups.some(g => groupIds.includes(g))
  }

  const visibleSolutions = solutions.filter(s => hasAccess(s))

  return (
    <>
      <Navigation />
      <SidebarInset>
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center gap-4 px-4">
            <SidebarTrigger />
          </div>
        </header>
        
        <main className="flex-1 w-full overflow-y-auto bg-background">
          <div className="w-full px-6 py-8 lg:px-12 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold leading-tight tracking-tight dark:text-[#e5e2e1]">솔루션 관리</h1>
                <p className="text-muted-foreground dark:text-[#c7c4d7] mt-1">표준화된 비즈니스 프로세스 템플릿을 관리합니다.</p>
              </div>

              <Button onClick={handleCreateClick}>
                <Plus className="mr-2 h-4 w-4" />
                새 솔루션 설계
              </Button>
            </div>

            {visibleSolutions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 border-2 border-dashed border-gray-200 dark:border-neutral-800 rounded-[40px] bg-white/50 dark:bg-transparent w-full">
                <p className="text-gray-400 dark:text-neutral-500 font-semibold text-lg">아직 등록된 솔루션이 없습니다.</p>
              </div>
            ) : (
              <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 w-full">
                {visibleSolutions.map((solution) => (
                  <Card
                    key={solution.id}
                    className="flex flex-col rounded-[32px] border border-gray-100 dark:border-[#464554]/30 shadow-sm bg-white dark:bg-[#1c1b1b] overflow-hidden transition-all hover:shadow-xl dark:hover:shadow-none dark:hover:border-[#c0c1ff]/50 cursor-pointer"
                    onClick={() => router.push(`/solutions/${solution.id}`)}
                  >
                    <CardHeader className="pb-0 pt-8 px-8">
                      <div className="flex items-start justify-between mb-2">
                        <CardTitle className="text-[23px] font-bold text-[#111827] dark:text-[#e5e2e1] truncate pr-2">{solution.name}</CardTitle>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full bg-gray-50 dark:bg-[#2a2a2a] hover:bg-gray-100 dark:hover:bg-[#353534]"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/solutions/${solution.id}`)
                            }}
                          >
                              <Edit2 className="h-4 w-4 text-gray-600 dark:text-[#c7c4d7]" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-white rounded-[28px]">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="font-bold">솔루션 삭제</AlertDialogTitle>
                                    <AlertDialogDescription>이 솔루션을 삭제하시겠습니까? 되돌릴 수 없습니다.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-full">취소</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteSolution(solution.id)}
                                      className="bg-red-500 rounded-full hover:bg-red-600"
                                    >
                                      삭제 확인
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <CardDescription className="text-gray-400 dark:text-[#c7c4d7]/70 line-clamp-1 mb-5">{solution.description || "설명이 없습니다."}</CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pt-2 flex-1">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#2a2a2a] border border-gray-100 dark:border-[#464554]/20"><Clock className="h-4 w-4 text-gray-500 dark:text-[#c7c4d7]"/><span className="text-[13px] font-bold text-gray-700 dark:text-[#e5e2e1]">총 {getAllStages(solution.stages).reduce((s, st) => s + st.durationDays, 0)}일</span></div>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#2a2a2a] border border-gray-100 dark:border-[#464554]/20"><Layers className="h-4 w-4 text-gray-500 dark:text-[#c7c4d7]"/><span className="text-[13px] font-bold text-gray-700 dark:text-[#e5e2e1]">{getAllStages(solution.stages).length}단계</span></div>
                      </div>
                      <div className="space-y-4">
                        {getAllStages(solution.stages).slice(0, 3).map((stage, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm font-medium text-gray-600 dark:text-[#e5e2e1]" style={{ paddingLeft: `${stage.level * 16}px` }}>
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-[#c0c1ff]/50"/>
                              <span>{stage.name}{stage.level > 0 ? ` (${Array(stage.level).fill('') .map(() => '-').join('')}${stage.level > 0 ? stage.level + 1 : ''})` : ''}</span>
                            </div>
                            <span className="text-gray-400 dark:text-[#c7c4d7]">{stage.durationDays}D</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="pb-8 px-8 pt-6">
                      <Button
                        variant="outline"
                        className="w-full rounded-[18px] font-bold text-gray-600 dark:text-[#e5e2e1] dark:border-[#464554]/50 hover:bg-[#111827] hover:text-white dark:hover:bg-[#2a2a2a] dark:hover:border-[#464554] transition-all"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/solutions/${solution.id}`)
                        }}
                      >
                        상세 워크플로우 보기
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* 통합 추가/수정 다이얼로그 (사용자 조절 가능) */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent
            className="min-w-[520px] min-h-[320px] max-w-[90vw] max-h-[90vh] overflow-auto resize rounded-[32px] bg-white p-10 dark:bg-[#1c1b1b] dark:border-[#464554]"
            style={{ boxSizing: 'border-box' }}
          >
            <DialogHeader className="pb-4 dark:border-b dark:border-[#464554]">
              <DialogTitle className="text-2xl font-bold dark:text-[#e5e2e1]">{editingSolution ? "솔루션 정보 수정" : "새 솔루션 설계"}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-8 py-4">
              {/* 기본 정보 */}
              <div className="grid gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-gray-700 dark:text-[#e5e2e1]">솔루션명</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="솔루션 이름을 입력하세요" className="rounded-xl h-12 dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-gray-700 dark:text-[#e5e2e1]">솔루션 설명</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="솔루션에 대한 상세 설명을 입력하세요" className="rounded-xl min-h-[100px] resize-none dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]" />
                </div>
              </div>

              {/* 워크플로우 설계 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-gray-700 dark:text-[#e5e2e1]">워크플로우 설계 (총 {totalDuration}일)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addStage} className="rounded-full gap-1 h-8 text-xs"><Plus className="h-3 w-3"/> 단계 추가</Button>
                </div>
                
                {/* 트리 구조 렌더링 */}
                <div className="space-y-2">
                  {formData.stages.map((stage, stageIndex) => (
                    <div key={stage.id}>
                      {/* 1레벨 단계 */}
                      <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100 dark:bg-[#0e0e0e] dark:border-[#464554]">
                        {stage.children && stage.children.length > 0 && (
                          <button
                            onClick={() => toggleExpand(stage.id)}
                            className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-[#2a2a2a] rounded transition-colors"
                          >
                            {expandedStages.has(stage.id) ? (
                              <ChevronDown className="h-4 w-4 text-gray-400 dark:text-[#908fa0]" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400 dark:text-[#908fa0]" />
                            )}
                          </button>
                        )}
                        {!stage.children || stage.children.length === 0 && <div className="w-6" />}
                        
                        <span className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-xs font-bold text-gray-400 border border-gray-200 dark:bg-[#1E1E1E] dark:text-[#908fa0] dark:border-[#464554]">{stageIndex + 1}</span>
                        <Input value={stage.name} onChange={(e) => handleUpdateStage(stage.id, 'name', e.target.value)} placeholder="1단계명 (예: 기획)" className="flex-1 bg-white border-none shadow-none focus-visible:ring-1 dark:bg-[#1E1E1E] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]" />
                        <div className="flex items-center gap-2 w-24 shrink-0">
                          <Input type="number" value={stage.durationDays} onChange={(e) => handleUpdateStage(stage.id, 'durationDays', parseInt(e.target.value) || 0)} className="bg-white dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1] text-center border-none shadow-none" />
                          <span className="text-xs font-bold text-gray-400 dark:text-[#c7c4d7]">일</span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {(stage.level ?? 0) < 2 && (
                            <Button variant="ghost" size="icon" onClick={() => addChildStage(stage.id)} className="text-gray-300 hover:text-blue-500 dark:text-[#908fa0] dark:hover:text-[#c0c1ff] h-6 w-6" title="하위 단계 추가">
                              <Plus className="h-3.5 w-3.5"/>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveStage(stage.id)} className="text-gray-300 hover:text-red-500 dark:text-[#908fa0] dark:hover:text-[#ffb4ab] h-6 w-6">
                            <X className="h-4 w-4"/>
                          </Button>
                        </div>
                      </div>

                      {/* 2레벨 단계 */}
                      {expandedStages.has(stage.id) && stage.children && stage.children.map((child2, child2Index) => (
                        <div key={child2.id}>
                          <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-2xl border border-blue-100 ml-4 mt-2 dark:bg-[#121827] dark:border-[#2c3b55]">
                            {child2.children && child2.children.length > 0 && (
                              <button
                                onClick={() => toggleExpand(child2.id)}
                                className="w-6 h-6 flex items-center justify-center hover:bg-blue-200 dark:hover:bg-[#1f2a40] rounded transition-colors"
                              >
                                {expandedStages.has(child2.id) ? (
                                  <ChevronDown className="h-4 w-4 text-blue-400 dark:text-[#8db6ff]" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-blue-400 dark:text-[#8db6ff]" />
                                )}
                              </button>
                            )}
                            {!child2.children || child2.children.length === 0 && <div className="w-6" />}
                            
                            <span className="min-w-8 h-8 px-2 flex items-center justify-center bg-white rounded-full text-xs font-bold text-blue-400 border border-blue-200 dark:bg-[#1E1E1E] dark:text-[#8db6ff] dark:border-[#2c3b55]">{`${stageIndex + 1}-${child2Index + 1}`}</span>
                            <Input value={child2.name} onChange={(e) => handleUpdateStage(child2.id, 'name', e.target.value)} placeholder="1-X단계명" className="flex-1 bg-white border-none shadow-none focus-visible:ring-1 dark:bg-[#1E1E1E] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]" />
                            <div className="flex items-center gap-2 w-24 shrink-0">
                              <Input type="number" value={child2.durationDays} onChange={(e) => handleUpdateStage(child2.id, 'durationDays', parseInt(e.target.value) || 0)} className="bg-white dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1] text-center border-none shadow-none" />
                              <span className="text-xs font-bold text-blue-400 dark:text-[#c0c1ff]">일</span>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {(child2.level ?? 0) < 2 && (
                                <Button variant="ghost" size="icon" onClick={() => addChildStage(child2.id)} className="text-blue-300 hover:text-blue-600 dark:text-[#8db6ff] dark:hover:text-[#c0c1ff] h-6 w-6" title="3단계 추가">
                                  <Plus className="h-3.5 w-3.5"/>
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveStage(child2.id)} className="text-blue-300 hover:text-red-500 dark:text-[#8db6ff] dark:hover:text-[#ffb4ab] h-6 w-6">
                                <X className="h-4 w-4"/>
                              </Button>
                            </div>
                          </div>

                          {/* 3레벨 단계 */}
                          {expandedStages.has(child2.id) && child2.children && child2.children.map((child3, child3Index) => (
                            <div key={child3.id} className="flex items-center gap-3 bg-purple-50 p-3 rounded-2xl border border-purple-100 ml-8 mt-2 dark:bg-[#1f1526] dark:border-[#4a3458]">
                              <div className="w-6" />
                              <span className="min-w-8 h-8 px-2 flex items-center justify-center bg-white rounded-full text-xs font-bold text-purple-400 border border-purple-200 dark:bg-[#1E1E1E] dark:text-[#ddb7ff] dark:border-[#4a3458]">{`${stageIndex + 1}-${child2Index + 1}-${child3Index + 1}`}</span>
                              <Input value={child3.name} onChange={(e) => handleUpdateStage(child3.id, 'name', e.target.value)} placeholder="1-X-X단계명" className="flex-1 bg-white border-none shadow-none focus-visible:ring-1 dark:bg-[#1E1E1E] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]" />
                              <div className="flex items-center gap-2 w-24 shrink-0">
                                <Input type="number" value={child3.durationDays} onChange={(e) => handleUpdateStage(child3.id, 'durationDays', parseInt(e.target.value) || 0)} className="bg-white dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1] text-center border-none shadow-none" />
                                <span className="text-xs font-bold text-purple-400 dark:text-[#ddb7ff]">일</span>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveStage(child3.id)} className="text-purple-300 hover:text-red-500 dark:text-[#ddb7ff] dark:hover:text-[#ffb4ab] h-6 w-6">
                                <X className="h-4 w-4"/>
                              </Button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* 권한 관리 */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-[#464554]">
                <Label className="text-sm font-bold text-gray-700 dark:text-[#e5e2e1] flex items-center gap-2">
                  <Users className="h-4 w-4"/> 접근 권한 설정
                </Label>
                <p className="text-xs text-gray-400 dark:text-[#908fa0]">
                  특정 사용자나 그룹을 지정하지 않으면 조직의 모든 멤버가 이 솔루션을 사용할 수 있습니다.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={accessListMode === 'group' ? 'border-primary text-primary bg-primary/5' : 'border-transparent'}
                    onClick={() => setAccessListMode('group')}
                  >
                    그룹
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={accessListMode === 'user' ? 'border-primary text-primary bg-primary/5' : 'border-transparent'}
                    onClick={() => setAccessListMode('user')}
                  >
                    사용자
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-gray-400 dark:text-[#908fa0] uppercase">{accessListMode === 'group' ? '그룹 지정' : '사용자 지정'}</Label>
                  <div className="h-[140px] overflow-y-auto rounded-xl border border-gray-200 p-2 space-y-1 bg-gray-50/50 dark:bg-[#0e0e0e] dark:border-[#464554] custom-scrollbar">
                    {accessListMode === 'user' ? (
                      users.map(u => {
                        const selected = formData.userIds.includes(u.id)
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              if (selected) {
                                setFormData({ ...formData, userIds: formData.userIds.filter(id => id !== u.id) })
                              } else {
                                setFormData({ ...formData, userIds: [...formData.userIds, u.id] })
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-all border text-left ${selected ? 'bg-white border-gray-300 shadow-sm dark:bg-[#2a2a2a] dark:border-[#c0c1ff]/40' : 'border-transparent hover:bg-white hover:shadow-sm hover:border-gray-100 dark:hover:bg-[#2a2a2a] dark:hover:border-[#464554]'}`}
                          >
                            <User className={`h-4 w-4 ${selected ? 'text-[#111827] dark:text-[#c0c1ff]' : 'text-gray-400 dark:text-[#908fa0]'}`} />
                            <span className="text-sm font-medium text-gray-700 dark:text-[#e5e2e1] flex-1 truncate">{u.displayName}</span>
                            {selected && <Check className="h-4 w-4 text-[#111827] dark:text-[#c0c1ff]" />}
                          </button>
                        )
                      })
                    ) : groups && groups.length > 0 ? (
                      groups.map(g => {
                        const selected = formData.groupIds.includes(g.id)
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => {
                              if (selected) {
                                setFormData({ ...formData, groupIds: formData.groupIds.filter(id => id !== g.id) })
                              } else {
                                setFormData({ ...formData, groupIds: [...formData.groupIds, g.id] })
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-all border text-left ${selected ? 'bg-white border-gray-300 shadow-sm dark:bg-[#2a2a2a] dark:border-[#c0c1ff]/40' : 'border-transparent hover:bg-white hover:shadow-sm hover:border-gray-100 dark:hover:bg-[#2a2a2a] dark:hover:border-[#464554]'}`}
                          >
                            <Users className={`h-4 w-4 ${selected ? 'text-[#111827] dark:text-[#c0c1ff]' : 'text-gray-400 dark:text-[#908fa0]'}`} />
                            <span className="text-sm font-medium text-gray-700 dark:text-[#e5e2e1] flex-1 truncate">{g.name}</span>
                            {selected && <Check className="h-4 w-4 text-[#111827] dark:text-[#c0c1ff]" />}
                          </button>
                        )
                      })
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs font-medium text-gray-400 dark:text-[#908fa0]">
                        등록된 그룹이 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-8 gap-3 pt-4 dark:border-t dark:border-[#464554]">
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-full px-8 font-bold dark:bg-[#0e0e0e] dark:border dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]">취소</Button>
              <Button onClick={handleSave} className="rounded-full px-10 font-bold bg-[#111827] text-white hover:bg-gray-800 dark:bg-[#c0c1ff] dark:text-[#1c1b1b] dark:hover:bg-[#b3b5ff]">설계 완료 및 저장</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </SidebarInset>
    </>
  )
}