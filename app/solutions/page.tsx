"use client"

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react"
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
import { Plus, Edit2, Trash2, Clock, Layers, X, Users, User, Check, ChevronDown, ChevronRight, Upload, Download, Search, Loader2 } from "lucide-react"
import * as XLSX from "xlsx"
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
  const [dialogSize, setDialogSize] = useState<{ width: number; height: number | undefined }>({ width: 520, height: undefined })
  const dialogResizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)
  const workflowExcelInputRef = useRef<HTMLInputElement | null>(null)
  const [editingSolution, setEditingSolution] = useState<Solution | null>(null)
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())
  const [accessListMode, setAccessListMode] = useState<'group' | 'user'>('group')
  const [accessQuery, setAccessQuery] = useState('')
  const [accessResults, setAccessResults] = useState<{id: string, displayName: string, email?: string}[]>([])
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [accessMeta, setAccessMeta] = useState<Map<string, string>>(new Map())
  const accessAbortRef = useRef<AbortController | null>(null)
  const [collapsedSections, setCollapsedSections] = useState({
    solutionName: false,
    solutionDescription: false,
    workflow: false,
    access: false,
  })
  
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

  const getStageNameWidth = (value: string) => {
    const length = value.trim().length
    const estimated = Math.max(140, length * 9 + 56)
    return `${Math.min(420, estimated)}px`
  }

  const resizeStageNameField = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.max(40, el.scrollHeight)}px`
  }

  const toggleSection = (key: 'solutionName' | 'solutionDescription' | 'workflow' | 'access') => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const normalizeHeader = (value: string) => value.replace(/\s+/g, '').toLowerCase()

  const getCellValue = (row: Record<string, unknown>, headerKeys: string[]) => {
    const normalizedKeys = headerKeys.map(normalizeHeader)
    for (const [key, value] of Object.entries(row)) {
      if (normalizedKeys.includes(normalizeHeader(key))) {
        return value
      }
    }
    return undefined
  }

  const parseLevelFromStageCode = (value: string) => {
    const parts = value.trim().split(/[-._/]/).filter(Boolean)
    if (parts.length <= 1) return 0
    return Math.max(0, Math.min(2, parts.length - 1))
  }

  const buildStagesFromExcelRows = (rows: Record<string, unknown>[]) => {
    const entries: Array<{ name: string; level: number; durationDays: number }> = []

    rows.forEach((row) => {
      const stageCodeRaw = getCellValue(row, ['단계', '스테이지', 'stage', '단계번호', '번호', 'wbs'])
      const levelRaw = getCellValue(row, ['레벨', 'level', '단계레벨', 'depth'])
      const nameRaw = getCellValue(row, ['단계명', '스테이지명', 'name', '업무명', 'title'])
      const durationRaw = getCellValue(row, ['기간', '기간(일)', '소요일', 'duration', 'durationdays', 'days', '일수'])

      const name = String(nameRaw ?? '').trim()
      if (!name) return

      let level = 0
      const stageCode = String(stageCodeRaw ?? '').trim()
      if (stageCode) {
        level = parseLevelFromStageCode(stageCode)
      } else {
        const parsedLevel = Number(String(levelRaw ?? '').trim())
        if (!Number.isNaN(parsedLevel)) {
          level = parsedLevel <= 2 ? parsedLevel : parsedLevel - 1
          level = Math.max(0, Math.min(2, level))
        }
      }

      const parsedDuration = Number(String(durationRaw ?? '').replace(/[^0-9.-]/g, ''))
      const durationDays = Number.isFinite(parsedDuration) && parsedDuration > 0 ? Math.round(parsedDuration) : 1

      entries.push({ name, level, durationDays })
    })

    const roots: Stage[] = []
    const latestByLevel: Array<Stage | undefined> = []

    entries.forEach((entry) => {
      const stage = createEmptyStage(null, entry.level)
      stage.name = entry.name
      stage.durationDays = entry.durationDays

      if (entry.level === 0 || !latestByLevel[entry.level - 1]) {
        stage.level = 0
        stage.parentStageId = null
        roots.push(stage)
        latestByLevel[0] = stage
        latestByLevel[1] = undefined
        latestByLevel[2] = undefined
        return
      }

      const parent = latestByLevel[entry.level - 1]!
      stage.level = entry.level
      stage.parentStageId = parent.id
      parent.children = [...(parent.children ?? []), stage]
      latestByLevel[entry.level] = stage
      if (entry.level < 2) {
        latestByLevel[entry.level + 1] = undefined
      }
    })

    return roots
  }

  const handleWorkflowExcelUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const firstSheet = workbook.Sheets[firstSheetName]

      if (!firstSheet) {
        alert('엑셀 시트를 찾을 수 없습니다.')
        return
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' })
      const stages = buildStagesFromExcelRows(rows)

      if (stages.length === 0) {
        alert('엑셀에서 단계 데이터를 찾지 못했습니다. (예: 단계명, 기간)')
        return
      }

      setFormData((prev) => ({ ...prev, stages }))

      const nextExpanded = new Set<string>()
      const markExpanded = (items: Stage[]) => {
        items.forEach((item) => {
          if (item.children && item.children.length > 0) {
            nextExpanded.add(item.id)
            markExpanded(item.children)
          }
        })
      }
      markExpanded(stages)
      setExpandedStages(nextExpanded)
    } catch (error) {
      console.error('Failed to import workflow excel:', error)
      alert('엑셀 업로드 처리 중 오류가 발생했습니다.')
    } finally {
      event.target.value = ''
    }
  }

  const handleWorkflowTemplateDownload = () => {
    try {
      const rows = [
        { '단계': '1', '단계명': '분석', '기간(일)': 5 },
        { '단계': '1-1', '단계명': '요구사항 수집', '기간(일)': 3 },
        { '단계': '2', '단계명': '설계', '기간(일)': 4 },
      ]
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'workflow')
      XLSX.writeFile(workbook, 'workflow-template.xlsx')
    } catch (error) {
      console.error('Failed to download workflow template:', error)
      alert('템플릿 다운로드 중 오류가 발생했습니다.')
    }
  }

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

  // Entra ID access search effect
  const fetchAccessResults = useCallback(async (q: string, mode: 'group' | 'user') => {
    if (accessAbortRef.current) accessAbortRef.current.abort()
    const controller = new AbortController()
    accessAbortRef.current = controller
    setAccessLoading(true)
    setAccessError(null)
    try {
      const endpoint = mode === 'user'
        ? `/api/entra/users?q=${encodeURIComponent(q)}`
        : `/api/entra/groups?q=${encodeURIComponent(q)}`
      const res = await fetch(endpoint, { signal: controller.signal })
      if (!res.ok) throw new Error('조회 실패')
      const data = await res.json()
      setAccessResults(mode === 'user' ? (data.users ?? []) : (data.groups ?? []))
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setAccessError('Entra ID 조회 실패')
        setAccessResults([])
      }
    } finally {
      setAccessLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isDialogOpen) {
      setAccessQuery('')
      setAccessResults([])
      setAccessMeta(new Map())
      setAccessError(null)
      return
    }
    const timer = setTimeout(() => fetchAccessResults(accessQuery, accessListMode), 350)
    return () => clearTimeout(timer)
  }, [accessQuery, accessListMode, isDialogOpen, fetchAccessResults])

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
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) setDialogSize({ width: 520, height: undefined }); setIsDialogOpen(open) }}>
          <DialogContent
            className="overflow-hidden flex flex-col rounded-[32px] bg-white p-10 dark:bg-[#1c1b1b] dark:border-[#464554]"
            style={{ width: dialogSize.width, ...(dialogSize.height !== undefined ? { height: dialogSize.height } : {}), minWidth: 520, minHeight: 320, maxWidth: '90vw', maxHeight: '90vh', boxSizing: 'border-box' }}
          >
            <DialogHeader className="pb-4 dark:border-b dark:border-[#464554]">
              <DialogTitle className="text-2xl font-bold dark:text-[#e5e2e1]">{editingSolution ? "솔루션 정보 수정" : "새 솔루션 설계"}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-8 py-4 flex-1 overflow-y-auto">
              {/* 기본 정보 */}
              <div className="grid gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-gray-700 dark:text-[#e5e2e1]">솔루션명</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => toggleSection('solutionName')}
                    >
                      {collapsedSections.solutionName ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                  {!collapsedSections.solutionName && (
                    <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="솔루션 이름을 입력하세요" className="rounded-xl h-12 dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]" />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-gray-700 dark:text-[#e5e2e1]">솔루션 설명</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => toggleSection('solutionDescription')}
                    >
                      {collapsedSections.solutionDescription ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                  {!collapsedSections.solutionDescription && (
                    <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="솔루션에 대한 상세 설명을 입력하세요" className="rounded-xl min-h-[100px] resize-none dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]" />
                  )}
                </div>
              </div>

              {/* 워크플로우 설계 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-gray-700 dark:text-[#e5e2e1]">워크플로우 설계 (총 {totalDuration}일)</Label>
                  <div className="flex items-center gap-1">
                    <input
                      ref={workflowExcelInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleWorkflowExcelUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleWorkflowTemplateDownload}
                      className="rounded-full gap-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" /> 템플릿 다운로드
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => workflowExcelInputRef.current?.click()}
                      className="rounded-full gap-1 h-8 text-xs"
                    >
                      <Upload className="h-3 w-3" /> 엑셀 업로드
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={addStage} className="rounded-full gap-1 h-8 text-xs"><Plus className="h-3 w-3"/> 단계 추가</Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => toggleSection('workflow')}
                    >
                      {collapsedSections.workflow ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                {/* 트리 구조 렌더링 */}
                {!collapsedSections.workflow && (
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
                        <Textarea
                          value={stage.name}
                          onChange={(e) => {
                            handleUpdateStage(stage.id, 'name', e.target.value)
                            resizeStageNameField(e.currentTarget)
                          }}
                          onInput={(e) => resizeStageNameField(e.currentTarget)}
                          ref={resizeStageNameField}
                          rows={1}
                          placeholder="1단계명 (예: 기획)"
                          className="flex-1 bg-white border-none shadow-none focus-visible:ring-1 resize-none overflow-hidden leading-5 min-h-0 dark:bg-[#1E1E1E] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]"
                          style={{ width: getStageNameWidth(stage.name), maxWidth: '100%' }}
                        />
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
                            <Textarea
                              value={child2.name}
                              onChange={(e) => {
                                handleUpdateStage(child2.id, 'name', e.target.value)
                                resizeStageNameField(e.currentTarget)
                              }}
                              onInput={(e) => resizeStageNameField(e.currentTarget)}
                              ref={resizeStageNameField}
                              rows={1}
                              placeholder="1-X단계명"
                              className="flex-1 bg-white border-none shadow-none focus-visible:ring-1 resize-none overflow-hidden leading-5 min-h-0 dark:bg-[#1E1E1E] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]"
                              style={{ width: getStageNameWidth(child2.name), maxWidth: '100%' }}
                            />
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
                              <Textarea
                                value={child3.name}
                                onChange={(e) => {
                                  handleUpdateStage(child3.id, 'name', e.target.value)
                                  resizeStageNameField(e.currentTarget)
                                }}
                                onInput={(e) => resizeStageNameField(e.currentTarget)}
                                ref={resizeStageNameField}
                                rows={1}
                                placeholder="1-X-X단계명"
                                className="flex-1 bg-white border-none shadow-none focus-visible:ring-1 resize-none overflow-hidden leading-5 min-h-0 dark:bg-[#1E1E1E] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]"
                                style={{ width: getStageNameWidth(child3.name), maxWidth: '100%' }}
                              />
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
                )}
              </div>

              {/* 권한 관리 */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-[#464554]">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-gray-700 dark:text-[#e5e2e1] flex items-center gap-2">
                    <Users className="h-4 w-4"/> 접근 권한 설정
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => toggleSection('access')}
                  >
                    {collapsedSections.access ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
                {!collapsedSections.access && (
                <>
                <p className="text-xs text-gray-400 dark:text-[#908fa0]">
                  특정 사용자나 그룹을 지정하지 않으면 조직의 모든 멤버가 이 솔루션을 사용할 수 있습니다.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={accessListMode === 'group' ? 'border-primary text-primary bg-primary/5' : 'border-transparent'}
                    onClick={() => { setAccessListMode('group'); setAccessQuery(''); setAccessResults([]) }}
                  >
                    그룹
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={accessListMode === 'user' ? 'border-primary text-primary bg-primary/5' : 'border-transparent'}
                    onClick={() => { setAccessListMode('user'); setAccessQuery(''); setAccessResults([]) }}
                  >
                    사용자
                  </Button>
                </div>
                {(formData.userIds.length > 0 || formData.groupIds.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {formData.groupIds.map(id => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-secondary dark:bg-[#2a2a2a] dark:text-[#c7c4d7] px-2 py-0.5 text-xs font-medium">
                        <Users className="h-3 w-3" />
                        <span className="max-w-[80px] truncate">{accessMeta.get(id) || id}</span>
                        <button type="button" onClick={() => setFormData(f => ({ ...f, groupIds: f.groupIds.filter(x => x !== id) }))} className="ml-0.5 rounded hover:bg-muted dark:hover:bg-[#353534]">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {formData.userIds.map(id => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-secondary dark:bg-[#2a2a2a] dark:text-[#c7c4d7] px-2 py-0.5 text-xs font-medium">
                        <User className="h-3 w-3" />
                        <span className="max-w-[80px] truncate">{accessMeta.get(id) || id}</span>
                        <button type="button" onClick={() => setFormData(f => ({ ...f, userIds: f.userIds.filter(x => x !== id) }))} className="ml-0.5 rounded hover:bg-muted dark:hover:bg-[#353534]">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-gray-400 dark:text-[#908fa0] uppercase">{accessListMode === 'group' ? '그룹 지정' : '사용자 지정'}</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground dark:text-[#908fa0]" />
                    <input
                      type="text"
                      placeholder={accessListMode === 'group' ? '그룹명으로 검색...' : '이름 또는 이메일로 검색...'}
                      value={accessQuery}
                      onChange={e => setAccessQuery(e.target.value)}
                      className="w-full pl-8 pr-3 h-8 text-sm rounded-md border border-gray-200 bg-white dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0] outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="h-[100px] overflow-y-auto rounded-xl border border-gray-200 p-2 space-y-1 bg-gray-50/50 dark:bg-[#0e0e0e] dark:border-[#464554] custom-scrollbar">
                    {accessLoading ? (
                      <div className="h-full flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground dark:text-[#908fa0]" />
                      </div>
                    ) : accessError ? (
                      <div className="h-full flex items-center justify-center text-xs text-destructive">{accessError}</div>
                    ) : accessResults.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-gray-400 dark:text-[#908fa0]">
                        {accessQuery.trim() ? '검색 결과가 없습니다' : accessListMode === 'group' ? '그룹명을 입력하여 검색' : '이름 또는 이메일을 입력하여 검색'}
                      </div>
                    ) : accessListMode === 'user' ? (
                      accessResults.map(u => {
                        const selected = formData.userIds.includes(u.id)
                        return (
                          <button key={u.id} type="button"
                            onClick={() => {
                              if (selected) {
                                setFormData(f => ({ ...f, userIds: f.userIds.filter(id => id !== u.id) }))
                              } else {
                                setFormData(f => ({ ...f, userIds: [...f.userIds, u.id] }))
                                setAccessMeta(m => new Map(m).set(u.id, u.displayName))
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-lg transition-all border text-left ${selected ? 'bg-white border-gray-300 shadow-sm dark:bg-[#2a2a2a] dark:border-[#c0c1ff]/40' : 'border-transparent hover:bg-white hover:shadow-sm hover:border-gray-100 dark:hover:bg-[#2a2a2a] dark:hover:border-[#464554]'}`}
                          >
                            <User className={`h-4 w-4 flex-shrink-0 ${selected ? 'text-[#111827] dark:text-[#c0c1ff]' : 'text-gray-400 dark:text-[#908fa0]'}`} />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-700 dark:text-[#e5e2e1] truncate block">{u.displayName}</span>
                              {u.email && <span className="text-xs text-gray-400 dark:text-[#908fa0] truncate block">{u.email}</span>}
                            </div>
                            {selected && <Check className="h-4 w-4 text-[#111827] dark:text-[#c0c1ff] flex-shrink-0" />}
                          </button>
                        )
                      })
                    ) : (
                      accessResults.map(g => {
                        const selected = formData.groupIds.includes(g.id)
                        return (
                          <button key={g.id} type="button"
                            onClick={() => {
                              if (selected) {
                                setFormData(f => ({ ...f, groupIds: f.groupIds.filter(id => id !== g.id) }))
                              } else {
                                setFormData(f => ({ ...f, groupIds: [...f.groupIds, g.id] }))
                                setAccessMeta(m => new Map(m).set(g.id, g.displayName))
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-lg transition-all border text-left ${selected ? 'bg-white border-gray-300 shadow-sm dark:bg-[#2a2a2a] dark:border-[#c0c1ff]/40' : 'border-transparent hover:bg-white hover:shadow-sm hover:border-gray-100 dark:hover:bg-[#2a2a2a] dark:hover:border-[#464554]'}`}
                          >
                            <Users className={`h-4 w-4 flex-shrink-0 ${selected ? 'text-[#111827] dark:text-[#c0c1ff]' : 'text-gray-400 dark:text-[#908fa0]'}`} />
                            <span className="text-sm font-medium text-gray-700 dark:text-[#e5e2e1] flex-1 truncate">{g.displayName}</span>
                            {selected && <Check className="h-4 w-4 text-[#111827] dark:text-[#c0c1ff] flex-shrink-0" />}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
                </>
                )}
              </div>
            </div>

            <DialogFooter className="mt-8 gap-3 pt-4 dark:border-t dark:border-[#464554]">
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-full px-8 font-bold dark:bg-[#0e0e0e] dark:border dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]">취소</Button>
              <Button onClick={handleSave} className="rounded-full px-10 font-bold bg-[#111827] text-white hover:bg-gray-800 dark:bg-[#c0c1ff] dark:text-[#1c1b1b] dark:hover:bg-[#b3b5ff]">설계 완료 및 저장</Button>
            </DialogFooter>
            {/* 드래그 리사이즈 핸들 */}
            <div
              className="absolute bottom-0 right-0 z-10 h-6 w-8 cursor-se-resize select-none rounded-tl-md bg-white/90 text-[9px] font-mono tracking-tight text-gray-500 opacity-0 transition-opacity hover:opacity-100 dark:bg-[#1c1b1b]/90 dark:text-[#908fa0]"
              title="드래그하여 크기 조절"
              onMouseDown={(e) => {
                e.preventDefault()
                const dialogEl = (e.currentTarget as HTMLElement).closest('[data-slot="dialog-content"]') as HTMLElement
                const rect = dialogEl?.getBoundingClientRect()
                dialogResizeRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  startW: rect?.width ?? dialogSize.width,
                  startH: rect?.height ?? 600,
                }
                const onMove = (ev: MouseEvent) => {
                  if (!dialogResizeRef.current) return
                  const newW = Math.max(520, dialogResizeRef.current.startW + ev.clientX - dialogResizeRef.current.startX)
                  const newH = Math.max(320, dialogResizeRef.current.startH + ev.clientY - dialogResizeRef.current.startY)
                  setDialogSize({ width: newW, height: newH })
                }
                const onUp = () => {
                  dialogResizeRef.current = null
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
            >
              <div className="flex h-full w-full items-center justify-center">
                {'< | >'}
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </SidebarInset>
    </>
  )
}
