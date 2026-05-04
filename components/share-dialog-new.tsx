"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, X, Users, User as UserIcon, Check, Send, Loader2, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

interface EntraUser {
  id: string
  displayName: string
  email: string
  department: string
}

interface EntraGroup {
  id: string
  displayName: string
  mail: string
  description: string
}

type SelectedEntity =
  | { type: "user"; id: string; name: string; email: string }
  | { type: "group"; id: string; name: string }

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

interface SharedUser {
  id: string
  displayName: string
}

interface SharedGroup {
  id: string
  name: string
}

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerName: string
  sharedUserIds?: string[]
  sharedGroupIds?: string[]
  users?: SharedUser[]
  groups?: SharedGroup[]
  onShare: (userIds: string[], groupIds: string[]) => void
}

export function ShareDialog({
  open,
  onOpenChange,
  customerName,
  sharedUserIds = [],
  sharedGroupIds = [],
  users = [],
  groups = [],
  onShare,
}: ShareDialogProps) {
  const [tab, setTab] = useState<"group" | "user">("group")
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedQuery = useDebounce(searchQuery, 350)
  const [userResults, setUserResults] = useState<EntraUser[]>([])
  const [groupResults, setGroupResults] = useState<EntraGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedEntity[]>([])
  const [isSharing, setIsSharing] = useState(false)
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const [nameCache, setNameCache] = useState<Record<string, string>>({})
  const [sharedRoles, setSharedRoles] = useState<Record<string, "user" | "admin">>({})
  const abortRef = useRef<AbortController | null>(null)

  const getUserName = (id: string) => nameCache[id] || users.find((u) => u.id === id)?.displayName || id
  const getGroupName = (id: string) => nameCache[id] || groups.find((g) => g.id === id)?.name || id

  // Preload both tabs on open to build name cache for already-shared IDs
  useEffect(() => {
    if (!open) return
    const preload = async () => {
      try {
        const [uRes, gRes] = await Promise.all([
          fetch(`/api/entra/users?q=`),
          fetch(`/api/entra/groups?q=`),
        ])
        const [uData, gData] = await Promise.all([uRes.json(), gRes.json()])
        const cache: Record<string, string> = {}
        ;(uData.users ?? []).forEach((u: { id: string; displayName: string }) => { cache[u.id] = u.displayName })
        ;(gData.groups ?? []).forEach((g: { id: string; displayName: string }) => { cache[g.id] = g.displayName })
        setNameCache(cache)
      } catch { /* ignore preload errors */ }
    }
    preload()
  }, [open])

  // Update name cache whenever search results arrive
  useEffect(() => {
    if (userResults.length === 0) return
    setNameCache((prev) => {
      const next = { ...prev }
      userResults.forEach((u) => { next[u.id] = u.displayName })
      return next
    })
  }, [userResults])

  useEffect(() => {
    if (groupResults.length === 0) return
    setNameCache((prev) => {
      const next = { ...prev }
      groupResults.forEach((g) => { next[g.id] = g.displayName })
      return next
    })
  }, [groupResults])

  const fetchData = useCallback(async (q: string, mode: "group" | "user") => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const endpoint =
        mode === "user"
          ? `/api/entra/users?q=${encodeURIComponent(q)}`
          : `/api/entra/groups?q=${encodeURIComponent(q)}`
      const res = await fetch(endpoint, { signal: controller.signal })
      if (!res.ok) throw new Error("조회 실패")
      const data = await res.json()
      if (mode === "user") setUserResults(data.users ?? [])
      else setGroupResults(data.groups ?? [])
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError("Entra ID에서 데이터를 불러오지 못했습니다.")
        if (mode === "user") setUserResults([])
        else setGroupResults([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    fetchData(debouncedQuery, tab)
  }, [open, debouncedQuery, tab, fetchData])

  const isSelectedId = (id: string) => selected.some((s) => s.id === id)
  const isAlreadyShared = (id: string, type: "user" | "group") => {
    if (type === "user") return sharedUserIds.includes(id) && !removedIds.has(id)
    return sharedGroupIds.includes(id) && !removedIds.has(id)
  }
  const removeShared = (id: string) => setRemovedIds((prev) => new Set([...prev, id]))

  const toggleUser = (u: EntraUser) => {
    if (isSelectedId(u.id)) {
      setSelected((s) => s.filter((x) => x.id !== u.id))
    } else {
      setSelected((s) => [...s, { type: "user", id: u.id, name: u.displayName, email: u.email }])
    }
  }

  const toggleGroup = (g: EntraGroup) => {
    if (isSelectedId(g.id)) {
      setSelected((s) => s.filter((x) => x.id !== g.id))
    } else {
      setSelected((s) => [...s, { type: "group", id: g.id, name: g.displayName }])
    }
  }

  const removeSelected = (id: string) => {
    setSelected((s) => s.filter((x) => x.id !== id))
  }

  const handleShare = async () => {
    if (selected.length === 0 && removedIds.size === 0) return
    setIsSharing(true)
    await new Promise((r) => setTimeout(r, 600))
    setIsSharing(false)
    const userIds = selected.filter((s) => s.type === "user").map((s) => s.id)
    const groupIds = selected.filter((s) => s.type === "group").map((s) => s.id)
    onShare(
      [...sharedUserIds.filter((id) => !removedIds.has(id)), ...userIds.filter((id) => !sharedUserIds.includes(id))],
      [...sharedGroupIds.filter((id) => !removedIds.has(id)), ...groupIds.filter((id) => !sharedGroupIds.includes(id))]
    )
    handleClose()
  }

  const handleClose = () => {
    setSearchQuery("")
    setUserResults([])
    setGroupResults([])
    setSelected([])
    setRemovedIds(new Set())
    setNameCache({})
    setSharedRoles({})
    setError(null)
    onOpenChange(false)
  }

  const handleTabChange = (newTab: "group" | "user") => {
    setTab(newTab)
    setSearchQuery("")
  }

  const getInitials = (name: string) => name.slice(0, 2)

  const results = tab === "user" ? userResults : groupResults

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] dark:bg-[#1c1b1b] dark:border-[#464554] max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="border-b dark:border-[#464554] px-6 py-5">
          <DialogTitle className="dark:text-[#e5e2e1]">고객 정보 공유</DialogTitle>
          <DialogDescription className="dark:text-[#c7c4d7]">
            &quot;{customerName}&quot; 정보를 공유할 사용자 또는 그룹을 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-0 flex-1 overflow-hidden">
          {/* Left: Search + Tabs + Results */}
          <div className="space-y-4 border-r dark:border-r-[#464554] px-4 py-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-[#908fa0] dark:group-focus-within:text-[#c0c1ff] transition-colors" />
              <Input
                placeholder={tab === "group" ? "그룹명으로 검색..." : "이름, 이메일로 검색..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]"
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b dark:border-b-[#464554] pb-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleTabChange("group")}
                className={
                  tab === "group"
                    ? "border-primary text-primary bg-primary/5 dark:border-[#464554] dark:bg-[#2a2a2a] dark:text-[#c0c1ff]"
                    : "border-transparent dark:text-[#908fa0] dark:hover:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"
                }
              >
                그룹
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleTabChange("user")}
                className={
                  tab === "user"
                    ? "border-primary text-primary bg-primary/5 dark:border-[#464554] dark:bg-[#2a2a2a] dark:text-[#c0c1ff]"
                    : "border-transparent dark:text-[#908fa0] dark:hover:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"
                }
              >
                사용자
              </Button>
            </div>

            {/* Selected badges */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.map((entity) => (
                  <Badge
                    key={entity.id}
                    variant="secondary"
                    className="flex items-center gap-1 py-1 px-2 dark:bg-[#2a2a2a] dark:text-[#c7c4d7]"
                  >
                    {entity.type === "group" ? (
                      <Users className="h-3 w-3" />
                    ) : (
                      <UserIcon className="h-3 w-3" />
                    )}
                    <span>{entity.name}</span>
                    <button
                      type="button"
                      onClick={() => removeSelected(entity.id)}
                      className="ml-1 hover:bg-muted dark:hover:bg-[#353534] rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Results list */}
            <div className="border rounded-lg bg-secondary/30 dark:bg-[#0e0e0e] dark:border-[#464554]">
              <ScrollArea className="h-[260px]">
                <div className="p-2 space-y-1">
                  {loading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground dark:text-[#908fa0]" />
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  ) : results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Search className="h-8 w-8 text-muted-foreground/40 dark:text-[#908fa0]/40 mb-2" />
                      <p className="text-sm text-muted-foreground dark:text-[#908fa0]">
                        {searchQuery.trim()
                          ? "검색 결과가 없습니다"
                          : tab === "group"
                          ? "그룹명을 입력하세요"
                          : "이름 또는 이메일을 입력하세요"}
                      </p>
                    </div>
                  ) : tab === "group" ? (
                    (results as EntraGroup[]).map((g) => {
                      const sel = isSelectedId(g.id)
                      const shared = isAlreadyShared(g.id, "group")
                      return (
                        <button
                          key={g.id}
                          type="button"
                          disabled={shared}
                          onClick={() => !shared && toggleGroup(g)}
                          className={cn(
                            "w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left",
                            shared
                              ? "opacity-50 cursor-not-allowed"
                              : sel
                              ? "bg-primary/10 border border-primary/30 dark:bg-[#2a2a2a] dark:border-[#c0c1ff]/40"
                              : "hover:bg-secondary dark:hover:bg-[#2a2a2a]"
                          )}
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-chart-2/20 text-chart-2 dark:bg-[#353534] dark:text-[#c0c1ff]">
                              <Users className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate dark:text-[#e5e2e1]">{g.displayName}</span>
                              <Badge variant="outline" className="text-xs py-0 dark:border-[#464554] dark:text-[#c7c4d7]">그룹</Badge>
                              {shared && <Badge variant="outline" className="text-xs py-0 text-green-600 border-green-600/30 dark:text-green-400">공유됨</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground dark:text-[#908fa0] truncate">
                              {g.description || g.mail || "보안 그룹"}
                            </p>
                          </div>
                          {sel && !shared && <Check className="h-4 w-4 text-primary dark:text-[#c0c1ff]" />}
                        </button>
                      )
                    })
                  ) : (
                    (results as EntraUser[]).map((u) => {
                      const sel = isSelectedId(u.id)
                      const shared = isAlreadyShared(u.id, "user")
                      return (
                        <button
                          key={u.id}
                          type="button"
                          disabled={shared}
                          onClick={() => !shared && toggleUser(u)}
                          className={cn(
                            "w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left",
                            shared
                              ? "opacity-50 cursor-not-allowed"
                              : sel
                              ? "bg-primary/10 border border-primary/30 dark:bg-[#2a2a2a] dark:border-[#c0c1ff]/40"
                              : "hover:bg-secondary dark:hover:bg-[#2a2a2a]"
                          )}
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/20 text-primary dark:bg-[#353534] dark:text-[#c0c1ff]">
                              {getInitials(u.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate dark:text-[#e5e2e1]">{u.displayName}</span>
                              {shared && <Badge variant="outline" className="text-xs py-0 text-green-600 border-green-600/30 dark:text-green-400">공유됨</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground dark:text-[#908fa0] truncate">
                              {u.email}{u.department ? ` · ${u.department}` : ""}
                            </p>
                          </div>
                          {sel && !shared && <Check className="h-4 w-4 text-primary dark:text-[#c0c1ff]" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Right: Already shared */}
          <div className="space-y-4 bg-secondary/20 dark:bg-[#0e0e0e] px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-[#908fa0] border-b border-border dark:border-[#464554] pb-3">
              공유 대상 ({sharedUserIds.filter((id) => !removedIds.has(id)).length + sharedGroupIds.filter((id) => !removedIds.has(id)).length + selected.length})
            </p>
            <div className="border rounded-lg bg-secondary/20 dark:bg-[#131313] dark:border-[#464554]">
              <ScrollArea className="h-[360px]">
                {sharedUserIds.length === 0 && sharedGroupIds.length === 0 && selected.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/40 dark:text-[#908fa0]/40 mb-2" />
                    <p className="text-sm text-muted-foreground dark:text-[#908fa0]">
                      공유된 그룹/사용자가 없습니다
                    </p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {selected.filter((s) => s.type === "group").map((entity) => (
                        <div key={entity.id} className="flex items-center gap-2 p-2 rounded-lg border dark:border-[#464554] dark:bg-[#1c1b1b]">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="text-xs dark:bg-[#353534] dark:text-[#c0c1ff]">
                              <Users className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate dark:text-[#e5e2e1]">{entity.name}</p>
                            <Select
                              value={sharedRoles[entity.id] ?? "user"}
                              onValueChange={(v) => setSharedRoles((prev) => ({ ...prev, [entity.id]: v as "user" | "admin" }))}
                            >
                              <SelectTrigger className="h-6 text-xs mt-0.5 px-2 border-none dark:bg-[#0e0e0e] dark:border-none dark:text-[#e5e2e1] focus:ring-0 focus:ring-offset-0 shadow-none">
                                <div className="flex items-center gap-1">
                                  <Shield className="h-3 w-3" />
                                  <SelectValue />
                                </div>
                              </SelectTrigger>
                              <SelectContent className="dark:bg-[#1c1b1b] dark:border-[#464554]">
                                <SelectItem value="user" className="text-xs dark:text-[#60a5fa] dark:focus:bg-[#2a2a2a]">사용자</SelectItem>
                                <SelectItem value="admin" className="text-xs dark:text-[#c0c1ff] dark:focus:bg-[#2a2a2a]">관리자</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSelected(entity.id)}
                            className="shrink-0 text-muted-foreground hover:text-destructive dark:text-[#908fa0] dark:hover:text-red-400 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    {selected.filter((s) => s.type === "user").map((entity) => (
                        <div key={entity.id} className="flex items-center gap-2 p-2 rounded-lg border dark:border-[#464554] dark:bg-[#1c1b1b]">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="text-xs bg-primary/20 text-primary dark:bg-[#2a2a2a] dark:text-[#c0c1ff]">
                              {entity.name.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate dark:text-[#e5e2e1]">{entity.name}</p>
                            <Select
                              value={sharedRoles[entity.id] ?? "user"}
                              onValueChange={(v) => setSharedRoles((prev) => ({ ...prev, [entity.id]: v as "user" | "admin" }))}
                            >
                              <SelectTrigger className="h-6 text-xs mt-0.5 px-2 border-none dark:bg-[#0e0e0e] dark:border-none dark:text-[#e5e2e1] focus:ring-0 focus:ring-offset-0 shadow-none">
                                <div className="flex items-center gap-1">
                                  <Shield className="h-3 w-3" />
                                  <SelectValue />
                                </div>
                              </SelectTrigger>
                              <SelectContent className="dark:bg-[#1c1b1b] dark:border-[#464554]">
                                <SelectItem value="user" className="text-xs dark:text-[#60a5fa] dark:focus:bg-[#2a2a2a]">사용자</SelectItem>
                                <SelectItem value="admin" className="text-xs dark:text-[#c0c1ff] dark:focus:bg-[#2a2a2a]">관리자</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSelected(entity.id)}
                            className="shrink-0 text-muted-foreground hover:text-destructive dark:text-[#908fa0] dark:hover:text-red-400 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    {sharedGroupIds.map((id) => {
                      const isRemoved = removedIds.has(id)
                      if (isRemoved) return null
                      return (
                        <div key={id} className="flex items-center gap-2 p-2 rounded-lg border dark:border-[#464554] dark:bg-[#1c1b1b]">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="text-xs dark:bg-[#353534] dark:text-[#c0c1ff]">
                              <Users className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate dark:text-[#e5e2e1]">{getGroupName(id)}</p>
                            <Select
                              value={sharedRoles[id] ?? "user"}
                              onValueChange={(v) => setSharedRoles((prev) => ({ ...prev, [id]: v as "user" | "admin" }))}
                            >
                              <SelectTrigger className="h-6 text-xs mt-0.5 px-2 border-none dark:bg-[#0e0e0e] dark:border-none dark:text-[#e5e2e1] focus:ring-0 focus:ring-offset-0 shadow-none">
                                <div className="flex items-center gap-1">
                                  <Shield className="h-3 w-3" />
                                  <SelectValue />
                                </div>
                              </SelectTrigger>
                              <SelectContent className="dark:bg-[#1c1b1b] dark:border-[#464554]">
                                <SelectItem value="user" className="text-xs dark:text-[#60a5fa] dark:focus:bg-[#2a2a2a]">사용자</SelectItem>
                                <SelectItem value="admin" className="text-xs dark:text-[#c0c1ff] dark:focus:bg-[#2a2a2a]">관리자</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeShared(id)}
                            className="shrink-0 text-muted-foreground hover:text-destructive dark:text-[#908fa0] dark:hover:text-red-400 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                    {sharedUserIds.map((id) => {
                      const isRemoved = removedIds.has(id)
                      if (isRemoved) return null
                      return (
                        <div key={id} className="flex items-center gap-2 p-2 rounded-lg border dark:border-[#464554] dark:bg-[#1c1b1b]">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="text-xs bg-primary/20 text-primary dark:bg-[#2a2a2a] dark:text-[#c0c1ff]">
                              {(nameCache[id] || getUserName(id)).slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate dark:text-[#e5e2e1]">{getUserName(id)}</p>
                            <Select
                              value={sharedRoles[id] ?? "user"}
                              onValueChange={(v) => setSharedRoles((prev) => ({ ...prev, [id]: v as "user" | "admin" }))}
                            >
                              <SelectTrigger className="h-6 text-xs mt-0.5 px-2 border-none dark:bg-[#0e0e0e] dark:border-none dark:text-[#e5e2e1] focus:ring-0 focus:ring-offset-0 shadow-none">
                                <div className="flex items-center gap-1">
                                  <Shield className="h-3 w-3" />
                                  <SelectValue />
                                </div>
                              </SelectTrigger>
                              <SelectContent className="dark:bg-[#1c1b1b] dark:border-[#464554]">
                                <SelectItem value="user" className="text-xs dark:text-[#60a5fa] dark:focus:bg-[#2a2a2a]">사용자</SelectItem>
                                <SelectItem value="admin" className="text-xs dark:text-[#c0c1ff] dark:focus:bg-[#2a2a2a]">관리자</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeShared(id)}
                            className="shrink-0 text-muted-foreground hover:text-destructive dark:text-[#908fa0] dark:hover:text-red-400 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 px-6 pb-5 border-t dark:border-t-[#464554] bg-secondary/20 dark:bg-[#0e0e0e]">
          <Button
            variant="outline"
            onClick={handleClose}
            className="dark:bg-transparent dark:border-[#464554] dark:text-[#c7c4d7] dark:hover:bg-[#2a2a2a]"
          >
            취소
          </Button>
          <Button
            onClick={handleShare}
            disabled={(selected.length === 0 && removedIds.size === 0) || isSharing}
            className="border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 dark:border-[#6366F1] dark:bg-[#6366F1] dark:hover:opacity-90"
          >
            {isSharing ? (
              "처리 중..."
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                저장 ({selected.length + removedIds.size})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
