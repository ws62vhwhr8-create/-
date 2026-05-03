"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Search, Clock, Layers } from "lucide-react"
import type { Solution, Stage } from "@/lib/types"

function flattenStages(stages: Stage[]): Stage[] {
  return stages.flatMap((stage) => [stage, ...flattenStages(stage.children ?? [])])
}

function getTotalDays(solution: Solution): number {
  return flattenStages(solution.stages).reduce((sum, s) => sum + s.durationDays, 0)
}

function getStageCount(solution: Solution): number {
  return flattenStages(solution.stages).length
}

type SortKey = "default" | "stages" | "duration"

interface SolutionCardGridProps {
  solutions: Solution[]
  value: string
  onChange: (id: string) => void
}

export function SolutionCardGrid({ solutions, value, onChange }: SolutionCardGridProps) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("default")

  const showSearch = solutions.length >= 5

  const filtered = useMemo(() => {
    let list = solutions
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      )
    }
    if (sort === "stages") {
      list = [...list].sort((a, b) => getStageCount(a) - getStageCount(b))
    } else if (sort === "duration") {
      list = [...list].sort((a, b) => getTotalDays(a) - getTotalDays(b))
    }
    return list
  }, [solutions, search, sort])

  return (
    <div className="space-y-3">
      {showSearch && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="솔루션 검색..."
              className="pl-8 bg-secondary h-9"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-9 rounded-md border border-input bg-secondary px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="default">기본 순</option>
            <option value="stages">단계 수 순</option>
            <option value="duration">기간 순</option>
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          검색 결과가 없습니다.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((solution) => {
            const stageCount = getStageCount(solution)
            const totalDays = getTotalDays(solution)
            const isSelected = solution.id === value

            return (
              <button
                key={solution.id}
                type="button"
                onClick={() => onChange(solution.id)}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
                  "hover:border-primary/60 hover:bg-accent",
                  isSelected
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-border bg-secondary"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm leading-snug">{solution.name}</span>
                  {isSelected && (
                    <Badge variant="default" className="shrink-0 text-xs px-1.5 py-0">
                      선택됨
                    </Badge>
                  )}
                </div>
                {solution.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {solution.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {stageCount}단계
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {totalDays}일
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
