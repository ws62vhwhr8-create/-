"use client"

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { Navigation } from "@/components/navigation"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Users, User, ChevronDown, ChevronRight, Clock, Layers, Save } from "lucide-react"
import { EntraUserSelectDialog } from "@/components/entra-user-select-dialog"
import type { SelectedItem } from "@/components/entra-user-select-dialog"
import type { Stage } from "@/lib/types"
import { isAdminRole } from "@/lib/permissions"

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

export default function SolutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { solutions, users, groups, currentUserId, updateSolution } = useAppStore()

  const { data: session } = useSession()
  const solution = useMemo(() => solutions.find((item) => item.id === id), [solutions, id])
  const currentUser = users.find((item) => item.id === currentUserId)

  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())
  const [isAccessPickerOpen, setIsAccessPickerOpen] = useState(false)
  const [accessMeta, setAccessMeta] = useState<Map<string, string>>(new Map())
  const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(true)
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(true)
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

  useEffect(() => {
    if (!solution) return
    setFormData({
      name: solution.name,
      description: solution.description || "",
      stages: normalizeStages(solution.stages),
      userIds: solution.userIds || [],
      groupIds: solution.groupIds || [],
    })
    setExpandedStages(new Set())
  }, [solution])

  const hasAccess = useMemo(() => {
    if (!solution) return false

    const isAdmin = isAdminRole(session?.user?.role) || isAdminRole(currentUser?.role)
    if (isAdmin) return true

    const userIds = solution.userIds || []
    const groupIds = solution.groupIds || []
    if (userIds.length === 0 && groupIds.length === 0) return true
    if (!currentUser) return false
    if (userIds.includes(currentUser.id)) return true
    const userGroups = currentUser.groupIds || []
    return userGroups.some((groupId) => groupIds.includes(groupId))
  }, [solution, currentUser, session])

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

  const totalDuration = getAllStages(formData.stages).reduce((sum, stage) => sum + (Number(stage.durationDays) || 0), 0)

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
    if (!solution) return
    if (!formData.name.trim()) {
      toast.error("솔루션명을 입력해주세요.")
      return
    }

    updateSolution(solution.id, {
      name: formData.name,
      description: formData.description,
      stages: formData.stages,
      userIds: formData.userIds,
      groupIds: formData.groupIds,
    })

    toast.success("솔루션 정보가 저장되었습니다.")
  }

  if (!solution) {
    return (
      <>
        <Navigation />
        <SidebarInset>
          <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center gap-4 px-4">
              <SidebarTrigger />
            </div>
          </header>
          <main className="app-surface flex-1 px-4 py-6 lg:px-6">
            <Card>
              <CardHeader>
                <CardTitle>솔루션을 찾을 수 없습니다.</CardTitle>
                <CardDescription>삭제되었거나 접근할 수 없는 솔루션입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/solutions">솔루션 관리로 이동</Link>
                </Button>
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </>
    )
  }

  if (!hasAccess) {
    return (
      <>
        <Navigation />
        <SidebarInset>
          <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center gap-4 px-4">
              <SidebarTrigger />
            </div>
          </header>
          <main className="app-surface flex-1 px-4 py-6 lg:px-6">
            <Card>
              <CardHeader>
                <CardTitle>접근 권한이 없습니다.</CardTitle>
                <CardDescription>이 솔루션은 현재 사용자에게 공개되지 않았습니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/solutions">솔루션 관리로 이동</Link>
                </Button>
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </>
    )
  }

  return (
    <>
      <Navigation />
      <SidebarInset>
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/98 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-14 items-center gap-3 px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="h-5 w-px bg-border/70" />
            <div className="flex min-w-0 items-center gap-1.5 text-sm">
              <Link href="/solutions" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">솔루션 관리</Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
              <span className="truncate font-medium text-foreground">{formData.name || solution.name}</span>
            </div>
          </div>
        </header>

        <main className="app-surface flex-1 px-6 py-8 lg:px-12">
          <div className="w-full space-y-6 animate-page-in">
            <div className="rounded-2xl border border-[#dbe3ee] bg-white/88 px-6 py-6 shadow-[0_20px_48px_-36px_rgba(37,22,120,0.35)] dark:border-white/10 dark:bg-[#1E1E1E]/60">
              <span className="menu-kicker">Workflow Designer</span>
              <div className="mt-3">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-[#1e1b4b] dark:text-[#e5e2e1]">{formData.name || solution.name}</h1>
                  <p className="text-sm text-[#5b5785] dark:text-[#908fa0] mt-1.5">단계 구조, 소요 기간, 접근 대상을 관리하는 솔루션 편집 화면입니다.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div />

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="flex items-center gap-1 border-[#d3cef0] bg-white/90 text-[#5b5785] dark:border-[#464554]/30 dark:text-[#c7c4d7]">
                  <Clock className="h-3 w-3" /> 총 {totalDuration}일
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1 border-[#d3cef0] bg-white/90 text-[#5b5785] dark:border-[#464554]/30 dark:text-[#c7c4d7]">
                  <Layers className="h-3 w-3" /> {getAllStages(formData.stages).length}단계
                </Badge>
              </div>
            </div>

            <Card className="border-[#dbe3ee] bg-white/92 shadow-[0_20px_48px_-36px_rgba(37,22,120,0.32)] dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="dark:text-[#e5e2e1]">기본 정보</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsBasicInfoOpen((prev) => !prev)}
                  aria-label={isBasicInfoOpen ? "기본 정보 접기" : "기본 정보 펼치기"}
                >
                  {isBasicInfoOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CardHeader>
              {isBasicInfoOpen && (
                <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>솔루션명</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="솔루션 이름을 입력하세요"
                  />
                </div>
                <div className="space-y-2">
                  <Label>솔루션 설명</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="솔루션 설명을 입력하세요"
                    className="min-h-[100px]"
                  />
                </div>
                </CardContent>
              )}
            </Card>

            <Card className="border-[#dbe3ee] bg-white/92 shadow-[0_20px_48px_-36px_rgba(37,22,120,0.32)] dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="dark:text-[#e5e2e1]">워크플로우 설계</CardTitle>
                <div className="flex items-center gap-2">
                  {isWorkflowOpen && (
                    <Button type="button" variant="outline" size="sm" onClick={addStage}>
                      <Plus className="h-4 w-4 mr-1" /> 단계 추가
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsWorkflowOpen((prev) => !prev)}
                    aria-label={isWorkflowOpen ? "워크플로우 접기" : "워크플로우 펼치기"}
                  >
                    {isWorkflowOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              {isWorkflowOpen && (
                <CardContent className="space-y-2">
                {formData.stages.map((stage, stageIndex) => (
                  <div key={stage.id}>
                    <div className="flex items-center gap-3 rounded-xl border border-[#e5def6] bg-[#f9f7ff] p-3 dark:bg-[#2a2a2a] dark:border-[#464554]/30">
                      {stage.children && stage.children.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(stage.id)}
                          className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#ebe6ff]"
                        >
                          {expandedStages.has(stage.id) ? (
                            <ChevronDown className="h-4 w-4 text-[#7f74b8]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-[#7f74b8]" />
                          )}
                        </button>
                      ) : (
                        <div className="w-6" />
                      )}

                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d9d1f0] bg-white text-xs font-bold text-[#70679e] dark:bg-[#353534] dark:text-[#c7c4d7] dark:border-[#464554]">
                        {stageIndex + 1}
                      </span>
                      <Input
                        value={stage.name}
                        onChange={(e) => handleUpdateStage(stage.id, "name", e.target.value)}
                        placeholder="단계명을 입력하세요"
                        className="flex-1 bg-white dark:bg-[#1E1E1E] dark:border-[#464554]/50"
                      />
                      <div className="flex items-center gap-2 w-28 shrink-0">
                        <Input
                          type="number"
                          value={stage.durationDays}
                          onChange={(e) => handleUpdateStage(stage.id, "durationDays", parseInt(e.target.value) || 0)}
                          className="text-center bg-white dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]"
                        />
                        <span className="text-xs text-muted-foreground dark:text-[#c7c4d7]">일</span>
                      </div>
                      <div className="flex gap-1">
                        {(stage.level ?? 0) < 2 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => addChildStage(stage.id)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveStage(stage.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {expandedStages.has(stage.id) && stage.children && stage.children.map((child2, child2Index) => (
                      <div key={child2.id}>
                        <div className="ml-4 mt-2 flex items-center gap-3 rounded-xl border border-[#ddd6ff] bg-[#f3f1ff] p-3 dark:bg-[#c0c1ff]/5 dark:border-[#c0c1ff]/20">
                          {child2.children && child2.children.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleExpand(child2.id)}
                              className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#e5e0ff]"
                            >
                              {expandedStages.has(child2.id) ? (
                                <ChevronDown className="h-4 w-4 text-[#7562d2]" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-[#7562d2]" />
                              )}
                            </button>
                          ) : (
                            <div className="w-6" />
                          )}

                          <span className="min-w-8 h-8 px-2 flex items-center justify-center rounded-full border border-[#ccc3ff] bg-white text-xs font-bold text-[#7562d2] dark:bg-[#353534] dark:text-[#c0c1ff] dark:border-[#c0c1ff]/30">
                            {`${stageIndex + 1}-${child2Index + 1}`}
                          </span>
                          <Input
                            value={child2.name}
                            onChange={(e) => handleUpdateStage(child2.id, "name", e.target.value)}
                            placeholder="하위 단계명을 입력하세요"
                            className="flex-1 bg-white dark:bg-[#1E1E1E] dark:border-[#464554]/50"
                          />
                          <div className="flex items-center gap-2 w-28 shrink-0">
                            <Input
                              type="number"
                              value={child2.durationDays}
                              onChange={(e) => handleUpdateStage(child2.id, "durationDays", parseInt(e.target.value) || 0)}
                              className="text-center bg-white dark:bg-[#1E1E1E] dark:border-[#464554]/50"
                            />
                            <span className="text-xs text-muted-foreground dark:text-[#c7c4d7]">일</span>
                          </div>
                          <div className="flex gap-1">
                            {(child2.level ?? 0) < 2 && (
                              <Button type="button" variant="ghost" size="icon" onClick={() => addChildStage(child2.id)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveStage(child2.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {expandedStages.has(child2.id) && child2.children && child2.children.map((child3, child3Index) => (
                          <div key={child3.id} className="ml-8 mt-2 flex items-center gap-3 rounded-xl border border-[#efd9ff] bg-[#f9f1ff] p-3 dark:bg-[#ddb7ff]/5 dark:border-[#ddb7ff]/20">
                            <div className="w-6" />
                            <span className="min-w-8 h-8 px-2 flex items-center justify-center rounded-full border border-[#e4beff] bg-white text-xs font-bold text-[#9d5ac8] dark:bg-[#353534] dark:text-[#ddb7ff] dark:border-[#ddb7ff]/30">
                              {`${stageIndex + 1}-${child2Index + 1}-${child3Index + 1}`}
                            </span>
                            <Input
                              value={child3.name}
                              onChange={(e) => handleUpdateStage(child3.id, "name", e.target.value)}
                              placeholder="3단계명을 입력하세요"
                              className="flex-1 bg-white dark:bg-[#1E1E1E] dark:border-[#464554]/50"
                            />
                            <div className="flex items-center gap-2 w-28 shrink-0">
                              <Input
                                type="number"
                                value={child3.durationDays}
                                onChange={(e) => handleUpdateStage(child3.id, "durationDays", parseInt(e.target.value) || 0)}
                                className="text-center bg-white dark:bg-[#1E1E1E] dark:border-[#464554]/50"
                              />
                              <span className="text-xs text-[#9d5ac8] dark:text-[#ddb7ff]">일</span>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveStage(child3.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
                </CardContent>
              )}
            </Card>

            <Card className="border-[#dbe3ee] bg-white/92 shadow-[0_20px_48px_-36px_rgba(37,22,120,0.32)] dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 dark:text-[#e5e2e1]">
                  <Users className="h-4 w-4" /> 접근 권한 설정
                </CardTitle>
                <CardDescription className="dark:text-[#908fa0]">권한 미설정 시 조직 전체에 공개됩니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-[#d3cef0] bg-white/90 text-[#4b4678] hover:bg-[#f4f1ff]" onClick={() => router.push("/solutions")}>목록으로</Button>
              <Button onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" /> 저장
              </Button>
            </div>
          </div>
        </main>
      </SidebarInset>
    </>
  )
}
