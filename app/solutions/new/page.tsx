"use client"

import { useState, useRef, type ChangeEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Navigation } from "@/components/navigation"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, X, Users, User, ChevronDown, ChevronRight, Upload, Download } from "lucide-react"
import * as XLSX from "xlsx"
import type { Stage } from "@/lib/types"
import { EntraUserSelectDialog } from "@/components/entra-user-select-dialog"
import type { SelectedItem } from "@/components/entra-user-select-dialog"

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

export default function NewSolutionPage() {
  const router = useRouter()
  const { addSolution } = useAppStore()

  const workflowExcelInputRef = useRef<HTMLInputElement | null>(null)
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())
  const [isAccessPickerOpen, setIsAccessPickerOpen] = useState(false)
  const [accessMeta, setAccessMeta] = useState<Map<string, string>>(new Map())
  const [collapsedSections, setCollapsedSections] = useState({
    solutionName: false,
    solutionDescription: false,
    workflow: false,
    access: false,
  })

  const [formData, setFormData] = useState<{
    name: string
    description: string
    stages: Stage[]
    userIds: string[]
    groupIds: string[]
  }>({
    name: "",
    description: "",
    stages: [createEmptyStage(null, 0)],
    userIds: [],
    groupIds: [],
  })

  const getAllStages = (stages: Stage[]): Stage[] => {
    const result: Stage[] = []
    const traverse = (stageList: Stage[]) => {
      stageList.forEach((stage) => {
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
  const totalStages = getAllStages(formData.stages).length

  const getStageNameWidth = (value: string) => {
    const length = value.trim().length
    const estimated = Math.max(140, length * 9 + 56)
    return `${Math.min(420, estimated)}px`
  }

  const resizeStageNameField = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.max(40, el.scrollHeight)}px`
  }

  const toggleSection = (key: "solutionName" | "solutionDescription" | "workflow" | "access") => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const normalizeHeader = (value: string) => value.replace(/\s+/g, "").toLowerCase()

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
      const stageCodeRaw = getCellValue(row, ["단계", "스테이지", "stage", "단계번호", "번호", "wbs"])
      const levelRaw = getCellValue(row, ["레벨", "level", "단계레벨", "depth"])
      const nameRaw = getCellValue(row, ["단계명", "스테이지명", "name", "업무명", "title"])
      const durationRaw = getCellValue(row, ["기간", "기간(일)", "소요일", "duration", "durationdays", "days", "일수"])

      const name = String(nameRaw ?? "").trim()
      if (!name) return

      let level = 0
      const stageCode = String(stageCodeRaw ?? "").trim()
      if (stageCode) {
        level = parseLevelFromStageCode(stageCode)
      } else {
        const parsedLevel = Number(String(levelRaw ?? "").trim())
        if (!Number.isNaN(parsedLevel)) {
          level = parsedLevel <= 2 ? parsedLevel : parsedLevel - 1
          level = Math.max(0, Math.min(2, level))
        }
      }

      const parsedDuration = Number(String(durationRaw ?? "").replace(/[^0-9.-]/g, ""))
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
      const workbook = XLSX.read(buffer, { type: "array" })
      const firstSheetName = workbook.SheetNames[0]
      const firstSheet = workbook.Sheets[firstSheetName]

      if (!firstSheet) {
        toast.error("엑셀 시트를 찾을 수 없습니다.")
        return
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" })
      const stages = buildStagesFromExcelRows(rows)

      if (stages.length === 0) {
        toast.error("엑셀에서 단계 데이터를 찾지 못했습니다. (예: 단계명, 기간)")
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
      console.error("Failed to import workflow excel:", error)
      toast.error("엑셀 업로드 처리 중 오류가 발생했습니다.")
    } finally {
      event.target.value = ""
    }
  }

  const handleWorkflowTemplateDownload = () => {
    try {
      const rows = [
        { 단계: "1", 단계명: "분석", "기간(일)": 5 },
        { 단계: "1-1", 단계명: "요구사항 수집", "기간(일)": 3 },
        { 단계: "2", 단계명: "설계", "기간(일)": 4 },
      ]
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(workbook, worksheet, "workflow")
      XLSX.writeFile(workbook, "workflow-template.xlsx")
    } catch (error) {
      console.error("Failed to download workflow template:", error)
      toast.error("템플릿 다운로드 중 오류가 발생했습니다.")
    }
  }

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

  const addChildStage = (parentStageId: string) => {
    const parentStage = findStageById(parentStageId, formData.stages)
    const parentLevel = parentStage?.level ?? 0
    if (parentStage && parentLevel < 2) {
      const newStage = createEmptyStage(parentStageId, parentLevel + 1)
      if (!parentStage.children) {
        parentStage.children = []
      }
      parentStage.children.push(newStage)
      setFormData({ ...formData, stages: [...formData.stages] })
      setExpandedStages(new Set([...expandedStages, parentStageId]))
    }
  }

  const addStage = () => {
    setFormData({ ...formData, stages: [...formData.stages, createEmptyStage(null, 0)] })
  }

  const removeStage = (stageId: string, stages: Stage[]): Stage[] => {
    return stages.filter((stage) => {
      if (stage.id === stageId) {
        return false
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

  const updateStage = (stageId: string, field: "name" | "durationDays", value: string | number, stages: Stage[]): Stage[] => {
    return stages.map((stage) => {
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

  const toggleExpand = (stageId: string) => {
    const newExpanded = new Set(expandedStages)
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId)
    } else {
      newExpanded.add(stageId)
    }
    setExpandedStages(newExpanded)
  }

  const handleSave = () => {
    if (!formData.name.trim()) { toast.error("솔루션명을 입력해주세요."); return }

    addSolution({
      ...formData,
    })

    router.push("/solutions")
  }

  return (
    <>
      <Navigation />
      <SidebarInset>
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/98 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-14 items-center gap-3 px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="h-5 w-px bg-border/70" />
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              <Link href="/solutions" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">솔루션 관리</Link>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <span className="font-medium text-foreground truncate">새 솔루션 설계</span>
            </div>
          </div>
        </header>

        <main className="app-surface flex-1 w-full overflow-y-auto">
          <div className="w-full px-6 py-8 lg:px-12">
            <div className="mb-6 border-b border-[#dbe3ee] pb-4 dark:border-white/10">
              <span className="menu-kicker">Solution Composer</span>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-[#1e1b4b] dark:text-[#e5e2e1]">새 솔루션 설계</h1>
                  <p className="text-sm text-[#6360a0] dark:text-[#908fa0] mt-1.5">워크플로우 스테이지와 접근 대상을 설계해 신규 고객 온보딩 템플릿을 구성합니다.</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full border border-[#d3cef0] bg-white/80 px-2.5 py-1 text-[#5b5785] dark:border-white/10 dark:bg-white/5 dark:text-[#c7c4d7]">
                    총 {totalStages}단계
                  </span>
                  <span className="rounded-full border border-[#d3cef0] bg-white/80 px-2.5 py-1 text-[#5b5785] dark:border-white/10 dark:bg-white/5 dark:text-[#c7c4d7]">
                    예상 {totalDuration}일
                  </span>
                  <span className="rounded-full border border-[#d3cef0] bg-white/80 px-2.5 py-1 text-[#5b5785] dark:border-white/10 dark:bg-white/5 dark:text-[#c7c4d7]">
                    접근 대상 {formData.userIds.length + formData.groupIds.length}개
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-hidden flex flex-col rounded-[32px] bg-white p-10 dark:bg-[#1c1b1b] dark:border dark:border-[#464554]">
              <div className="pb-4 dark:border-b dark:border-[#464554]" />

              <div className="space-y-8 py-4 flex-1 overflow-y-auto">
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold text-gray-700 dark:text-[#e5e2e1]">솔루션명</Label>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSection("solutionName")}>
                        {collapsedSections.solutionName ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                    {!collapsedSections.solutionName && (
                      <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="솔루션 이름을 입력하세요" className="rounded-xl h-12 dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold text-gray-700 dark:text-[#e5e2e1]">솔루션 설명</Label>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSection("solutionDescription")}>
                        {collapsedSections.solutionDescription ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                    {!collapsedSections.solutionDescription && (
                      <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="솔루션에 대한 상세 설명을 입력하세요" className="rounded-xl min-h-[100px] resize-none dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]" />
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-gray-700 dark:text-[#e5e2e1]">워크플로우 설계 (총 {totalDuration}일)</Label>
                    <div className="flex items-center gap-1">
                      <input ref={workflowExcelInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleWorkflowExcelUpload} />
                      <Button type="button" variant="outline" size="sm" onClick={handleWorkflowTemplateDownload} className="rounded-full gap-1 h-8 text-xs">
                        <Download className="h-3 w-3" /> 템플릿 다운로드
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => workflowExcelInputRef.current?.click()} className="rounded-full gap-1 h-8 text-xs">
                        <Upload className="h-3 w-3" /> 엑셀 업로드
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={addStage} className="rounded-full gap-1 h-8 text-xs">
                        <Plus className="h-3 w-3" /> 단계 추가
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSection("workflow")}>
                        {collapsedSections.workflow ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {!collapsedSections.workflow && (
                    <div className="space-y-2">
                      {formData.stages.map((stage, stageIndex) => (
                        <div key={stage.id}>
                          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100 dark:bg-[#0e0e0e] dark:border-[#464554]">
                            {stage.children && stage.children.length > 0 && (
                              <button onClick={() => toggleExpand(stage.id)} className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-[#2a2a2a] rounded transition-colors">
                                {expandedStages.has(stage.id) ? (
                                  <ChevronDown className="h-4 w-4 text-gray-400 dark:text-[#908fa0]" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-400 dark:text-[#908fa0]" />
                                )}
                              </button>
                            )}
                            {(!stage.children || stage.children.length === 0) && <div className="w-6" />}

                            <span className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-xs font-bold text-gray-400 border border-gray-200 dark:bg-[#1E1E1E] dark:text-[#908fa0] dark:border-[#464554]">{stageIndex + 1}</span>
                            <Textarea
                              value={stage.name}
                              onChange={(e) => {
                                handleUpdateStage(stage.id, "name", e.target.value)
                                resizeStageNameField(e.currentTarget)
                              }}
                              onInput={(e) => resizeStageNameField(e.currentTarget)}
                              ref={resizeStageNameField}
                              rows={1}
                              placeholder="1단계명 (예: 기획)"
                              className="flex-1 bg-white border-none shadow-none focus-visible:ring-1 resize-none overflow-hidden leading-5 min-h-0 dark:bg-[#1E1E1E] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]"
                              style={{ width: getStageNameWidth(stage.name), maxWidth: "100%" }}
                            />
                            <div className="flex items-center gap-2 w-24 shrink-0">
                              <Input type="number" value={stage.durationDays} onChange={(e) => handleUpdateStage(stage.id, "durationDays", parseInt(e.target.value) || 0)} className="bg-white dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1] text-center border-none shadow-none" />
                              <span className="text-xs font-bold text-gray-400 dark:text-[#c7c4d7]">일</span>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {(stage.level ?? 0) < 2 && (
                                <Button variant="ghost" size="icon" onClick={() => addChildStage(stage.id)} className="text-gray-300 hover:text-blue-500 dark:text-[#908fa0] dark:hover:text-[#c0c1ff] h-6 w-6" title="하위 단계 추가">
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveStage(stage.id)} className="text-gray-300 hover:text-red-500 dark:text-[#908fa0] dark:hover:text-[#ffb4ab] h-6 w-6">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {expandedStages.has(stage.id) && stage.children && stage.children.map((child2, child2Index) => (
                            <div key={child2.id}>
                              <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-2xl border border-blue-100 ml-4 mt-2 dark:bg-[#121827] dark:border-[#2c3b55]">
                                {child2.children && child2.children.length > 0 && (
                                  <button onClick={() => toggleExpand(child2.id)} className="w-6 h-6 flex items-center justify-center hover:bg-blue-200 dark:hover:bg-[#1f2a40] rounded transition-colors">
                                    {expandedStages.has(child2.id) ? (
                                      <ChevronDown className="h-4 w-4 text-blue-400 dark:text-[#8db6ff]" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-blue-400 dark:text-[#8db6ff]" />
                                    )}
                                  </button>
                                )}
                                {(!child2.children || child2.children.length === 0) && <div className="w-6" />}

                                <span className="min-w-8 h-8 px-2 flex items-center justify-center bg-white rounded-full text-xs font-bold text-blue-400 border border-blue-200 dark:bg-[#1E1E1E] dark:text-[#8db6ff] dark:border-[#2c3b55]">{`${stageIndex + 1}-${child2Index + 1}`}</span>
                                <Textarea
                                  value={child2.name}
                                  onChange={(e) => {
                                    handleUpdateStage(child2.id, "name", e.target.value)
                                    resizeStageNameField(e.currentTarget)
                                  }}
                                  onInput={(e) => resizeStageNameField(e.currentTarget)}
                                  ref={resizeStageNameField}
                                  rows={1}
                                  placeholder="1-X단계명"
                                  className="flex-1 bg-white border-none shadow-none focus-visible:ring-1 resize-none overflow-hidden leading-5 min-h-0 dark:bg-[#1E1E1E] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]"
                                  style={{ width: getStageNameWidth(child2.name), maxWidth: "100%" }}
                                />
                                <div className="flex items-center gap-2 w-24 shrink-0">
                                  <Input type="number" value={child2.durationDays} onChange={(e) => handleUpdateStage(child2.id, "durationDays", parseInt(e.target.value) || 0)} className="bg-white dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1] text-center border-none shadow-none" />
                                  <span className="text-xs font-bold text-blue-400 dark:text-[#c0c1ff]">일</span>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  {(child2.level ?? 0) < 2 && (
                                    <Button variant="ghost" size="icon" onClick={() => addChildStage(child2.id)} className="text-blue-300 hover:text-blue-600 dark:text-[#8db6ff] dark:hover:text-[#c0c1ff] h-6 w-6" title="3단계 추가">
                                      <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" onClick={() => handleRemoveStage(child2.id)} className="text-blue-300 hover:text-red-500 dark:text-[#8db6ff] dark:hover:text-[#ffb4ab] h-6 w-6">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              {expandedStages.has(child2.id) && child2.children && child2.children.map((child3, child3Index) => (
                                <div key={child3.id} className="flex items-center gap-3 bg-purple-50 p-3 rounded-2xl border border-purple-100 ml-8 mt-2 dark:bg-[#1f1526] dark:border-[#4a3458]">
                                  <div className="w-6" />
                                  <span className="min-w-8 h-8 px-2 flex items-center justify-center bg-white rounded-full text-xs font-bold text-purple-400 border border-purple-200 dark:bg-[#1E1E1E] dark:text-[#ddb7ff] dark:border-[#4a3458]">{`${stageIndex + 1}-${child2Index + 1}-${child3Index + 1}`}</span>
                                  <Textarea
                                    value={child3.name}
                                    onChange={(e) => {
                                      handleUpdateStage(child3.id, "name", e.target.value)
                                      resizeStageNameField(e.currentTarget)
                                    }}
                                    onInput={(e) => resizeStageNameField(e.currentTarget)}
                                    ref={resizeStageNameField}
                                    rows={1}
                                    placeholder="1-X-X단계명"
                                    className="flex-1 bg-white border-none shadow-none focus-visible:ring-1 resize-none overflow-hidden leading-5 min-h-0 dark:bg-[#1E1E1E] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]"
                                    style={{ width: getStageNameWidth(child3.name), maxWidth: "100%" }}
                                  />
                                  <div className="flex items-center gap-2 w-24 shrink-0">
                                    <Input type="number" value={child3.durationDays} onChange={(e) => handleUpdateStage(child3.id, "durationDays", parseInt(e.target.value) || 0)} className="bg-white dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1] text-center border-none shadow-none" />
                                    <span className="text-xs font-bold text-purple-400 dark:text-[#ddb7ff]">일</span>
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={() => handleRemoveStage(child3.id)} className="text-purple-300 hover:text-red-500 dark:text-[#ddb7ff] dark:hover:text-[#ffb4ab] h-6 w-6">
                                    <X className="h-4 w-4" />
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

                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-[#464554]">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-gray-700 dark:text-[#e5e2e1] flex items-center gap-2">
                      <Users className="h-4 w-4" /> 접근 권한 설정
                    </Label>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSection("access")}>
                      {collapsedSections.access ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                  {!collapsedSections.access && (
                    <>
                      <p className="text-xs text-gray-400 dark:text-[#908fa0]">특정 사용자나 그룹을 지정하지 않으면 조직의 모든 멤버가 이 솔루션을 사용할 수 있습니다.</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start bg-white dark:bg-[#1E1E1E] text-[#6360a0] dark:text-[#908fa0] font-normal"
                        onClick={() => setIsAccessPickerOpen(true)}
                      >
                        <User className="mr-2 h-4 w-4" />
                        사용자 추가
                      </Button>

                      {(formData.userIds.length > 0 || formData.groupIds.length > 0) && (
                        <div className="flex flex-wrap gap-1">
                          {formData.groupIds.map((id) => (
                            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-secondary dark:bg-[#2a2a2a] dark:text-[#c7c4d7] px-2 py-0.5 text-xs font-medium">
                              <Users className="h-3 w-3" />
                              <span className="max-w-[80px] truncate">{accessMeta.get(id) || id}</span>
                              <button type="button" onClick={() => setFormData((f) => ({ ...f, groupIds: f.groupIds.filter((x) => x !== id) }))} className="ml-0.5 rounded hover:bg-muted dark:hover:bg-[#353534]">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          {formData.userIds.map((id) => (
                            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-secondary dark:bg-[#2a2a2a] dark:text-[#c7c4d7] px-2 py-0.5 text-xs font-medium">
                              <User className="h-3 w-3" />
                              <span className="max-w-[80px] truncate">{accessMeta.get(id) || id}</span>
                              <button type="button" onClick={() => setFormData((f) => ({ ...f, userIds: f.userIds.filter((x) => x !== id) }))} className="ml-0.5 rounded hover:bg-muted dark:hover:bg-[#353534]">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <EntraUserSelectDialog
                        open={isAccessPickerOpen}
                        onOpenChange={setIsAccessPickerOpen}
                        onConfirm={(items: SelectedItem[]) => {
                          const selectedUsers = items.filter((item): item is Extract<SelectedItem, { type: "user" }> => item.type === "user")
                          const selectedGroups = items.filter((item): item is Extract<SelectedItem, { type: "group" }> => item.type === "group")

                          setFormData((prev) => ({
                            ...prev,
                            userIds: Array.from(new Set([...prev.userIds, ...selectedUsers.map((item) => item.user.id)])),
                            groupIds: Array.from(new Set([...prev.groupIds, ...selectedGroups.map((item) => item.group.id)])),
                          }))

                          setAccessMeta((prev) => {
                            const next = new Map(prev)
                            selectedUsers.forEach((item) => next.set(item.user.id, item.user.displayName))
                            selectedGroups.forEach((item) => next.set(item.group.id, item.group.displayName))
                            return next
                          })
                        }}
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="mt-8 gap-3 pt-4 dark:border-t dark:border-[#464554] flex justify-end">
                <Button variant="ghost" onClick={() => router.push("/solutions")} className="rounded-full px-8 font-bold dark:bg-[#0e0e0e] dark:border dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]">
                  취소
                </Button>
                <Button onClick={handleSave} className="rounded-full px-10 font-bold bg-[#111827] text-white hover:bg-gray-800 dark:bg-[#c0c1ff] dark:text-[#1c1b1b] dark:hover:bg-[#b3b5ff]">
                  설계 완료 및 저장
                </Button>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </>
  )
}
