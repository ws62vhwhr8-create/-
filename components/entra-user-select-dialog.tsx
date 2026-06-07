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
import { Search, X, Users, User as UserIcon, Check, Shield, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface EntraUser {
  id: string
  displayName: string
  email: string
  jobTitle: string
  department: string
}

export interface EntraGroup {
  id: string
  displayName: string
  mail: string
  description: string
}

export interface SelectedUserItem {
  type: "user"
  user: EntraUser
  role: "admin" | "user"
}

export interface SelectedGroupItem {
  type: "group"
  group: EntraGroup
  role: "admin" | "user"
}

export type SelectedItem = SelectedUserItem | SelectedGroupItem

interface EntraUserSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (items: SelectedItem[]) => void
  initialItems?: SelectedItem[]
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function EntraUserSelectDialog({
  open,
  onOpenChange,
  onConfirm,
  initialItems = [],
}: EntraUserSelectDialogProps) {
  const [tab, setTab] = useState<"group" | "user">("group")
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedQuery = useDebounce(searchQuery, 350)
  const [userResults, setUserResults] = useState<EntraUser[]>([])
  const [groupResults, setGroupResults] = useState<EntraGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedItem[]>([])

  useEffect(() => {
    if (open) {
      setSelected(initialItems)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (q: string, mode: "group" | "user") => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const endpoint = mode === "user"
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

  const isSelectedUser = (id: string) =>
    selected.some((s) => s.type === "user" && s.user.id === id)
  const isSelectedGroup = (id: string) =>
    selected.some((s) => s.type === "group" && s.group.id === id)

  const toggleUser = (user: EntraUser) => {
    if (isSelectedUser(user.id)) {
      setSelected((s) => s.filter((x) => !(x.type === "user" && x.user.id === user.id)))
    } else {
      setSelected((s) => [...s, { type: "user", user, role: "user" }])
    }
  }

  const addAllVisibleUsers = () => {
    const usersToAdd = userResults.filter((user) => !isSelectedUser(user.id))
    if (usersToAdd.length === 0) return
    setSelected((prev) => [...prev, ...usersToAdd.map((user) => ({ type: "user" as const, user, role: "user" as const }))])
  }

  const toggleGroup = (group: EntraGroup) => {
    if (isSelectedGroup(group.id)) {
      setSelected((s) => s.filter((x) => !(x.type === "group" && x.group.id === group.id)))
    } else {
      setSelected((s) => [...s, { type: "group", group, role: "user" }])
    }
  }

  const updateGroupRole = (groupId: string, role: "admin" | "user") => {
    setSelected((s) =>
      s.map((x) => (x.type === "group" && x.group.id === groupId ? { ...x, role } : x))
    )
  }

  const updateRole = (userId: string, role: "admin" | "user") => {
    setSelected((s) =>
      s.map((x) => (x.type === "user" && x.user.id === userId ? { ...x, role } : x))
    )
  }

  const removeSelected = (item: SelectedItem) => {
    if (item.type === "user") {
      setSelected((s) => s.filter((x) => !(x.type === "user" && x.user.id === item.user.id)))
    } else {
      setSelected((s) => s.filter((x) => !(x.type === "group" && x.group.id === item.group.id)))
    }
  }

  const handleConfirm = () => {
    if (selected.length === 0) return
    onConfirm(selected)
    handleClose()
  }

  const handleClose = () => {
    setSearchQuery("")
    setUserResults([])
    setGroupResults([])
    setSelected([])
    setError(null)
    onOpenChange(false)
  }

  const handleTabChange = (newTab: "group" | "user") => {
    setTab(newTab)
    setSearchQuery("")
  }

  const getInitials = (name: string) => name.slice(0, 2)

  const selectedUsers = selected.filter((s): s is SelectedUserItem => s.type === "user")
  const selectedGroups = selected.filter((s): s is SelectedGroupItem => s.type === "group")

  const results = tab === "user" ? userResults : groupResults

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] dark:bg-[#1c1b1b] dark:border-[#464554] max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="border-b dark:border-[#464554] px-6 py-5">
          <DialogTitle className="dark:text-[#e5e2e1]">사용자 추가</DialogTitle>
          <DialogDescription className="dark:text-[#c7c4d7]">
            DEX Consulting Entra ID에서 사용자 또는 그룹을 검색하고 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-0 min-h-[460px]">
          {/* Left: Search + Tabs + List */}
          <div className="space-y-4 border-r dark:border-r-[#464554] px-4 py-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-[#908fa0] dark:group-focus-within:text-[#c0c1ff] transition-colors" />
              <Input
                placeholder={tab === "group" ? "그룹명으로 검색..." : "이름, 이메일로 검색..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]"
                autoFocus
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b dark:border-b-[#464554] pb-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleTabChange("group")}
                className={tab === "group"
                  ? "border-primary text-primary bg-primary/5 dark:border-[#464554] dark:bg-[#2a2a2a] dark:text-[#c0c1ff]"
                  : "border-transparent dark:text-[#908fa0] dark:hover:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"}
              >
                그룹
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleTabChange("user")}
                className={tab === "user"
                  ? "border-primary text-primary bg-primary/5 dark:border-[#464554] dark:bg-[#2a2a2a] dark:text-[#c0c1ff]"
                  : "border-transparent dark:text-[#908fa0] dark:hover:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"}
              >
                사용자
              </Button>
              {tab === "user" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={addAllVisibleUsers}
                  disabled={loading || userResults.length === 0}
                  className="ml-auto text-xs dark:text-[#c7c4d7] dark:hover:bg-[#2a2a2a]"
                >
                  모든 사용자 추가
                </Button>
              ) : null}
            </div>

            <div className="border rounded-lg bg-secondary/30 dark:bg-[#0e0e0e] dark:border-[#464554]">
              <ScrollArea className="h-[280px]">
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
                      <Users className="h-8 w-8 text-muted-foreground/50 dark:text-[#908fa0]/50 mb-2" />
                      <p className="text-sm text-muted-foreground dark:text-[#908fa0]">
                        {searchQuery.trim() ? "검색 결과가 없습니다" : "검색어를 입력하세요"}
                      </p>
                    </div>
                  ) : tab === "group" ? (
                    (results as EntraGroup[]).map((g) => {
                      const sel = isSelectedGroup(g.id)
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGroup(g)}
                          className={cn(
                            "w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left",
                            sel
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
                            </div>
                            <p className="text-sm text-muted-foreground dark:text-[#908fa0] truncate">
                              {g.description || g.mail || "보안 그룹"}
                            </p>
                          </div>
                          {sel && <Check className="h-4 w-4 text-primary dark:text-[#c0c1ff]" />}
                        </button>
                      )
                    })
                  ) : (
                    (results as EntraUser[]).map((u) => {
                      const sel = isSelectedUser(u.id)
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleUser(u)}
                          className={cn(
                            "w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left",
                            sel
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
                            <span className="font-medium truncate dark:text-[#e5e2e1] block">{u.displayName}</span>
                            <p className="text-sm text-muted-foreground dark:text-[#908fa0] truncate">
                              {u.email}{u.department ? ` · ${u.department}` : ""}
                            </p>
                          </div>
                          {sel && <Check className="h-4 w-4 text-primary dark:text-[#c0c1ff]" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Right: Selected Panel */}
          <div className="space-y-3 bg-secondary/20 dark:bg-[#0e0e0e] px-4 py-4">
            <div className="flex items-center justify-between border-b border-border dark:border-[#464554] pb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-[#908fa0]">선택됨</p>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs dark:border-[#464554] dark:text-[#c7c4d7]">
                  사용자 {selectedUsers.length}명
                </Badge>
                <Badge variant="outline" className="text-xs dark:border-[#464554] dark:text-[#c7c4d7]">
                  그룹 {selectedGroups.length}개
                </Badge>
              </div>
            </div>

            <div className="border rounded-lg bg-secondary/20 dark:bg-[#131313] dark:border-[#464554]">
              <ScrollArea className="h-[280px]">
                <div className="p-3 space-y-2">
                  {/* Selected Groups */}
                  {selectedGroups.map(({ group, role }) => (
                    <div
                      key={group.id}
                      className="flex items-center gap-2 p-2 rounded-lg border dark:border-[#464554] dark:bg-[#1c1b1b]"
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-xs dark:bg-[#353534] dark:text-[#c0c1ff]">
                          <Users className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate dark:text-[#e5e2e1]">{group.displayName}</p>
                        <Select
                          value={role}
                          onValueChange={(v) => updateGroupRole(group.id, v as "admin" | "user")}
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
                        onClick={() => removeSelected({ type: "group", group, role })}
                        className="shrink-0 text-muted-foreground hover:text-destructive dark:text-[#908fa0] dark:hover:text-red-400 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  {/* Selected Users */}
                  {selectedUsers.map(({ user, role }) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 p-2 rounded-lg border dark:border-[#464554] dark:bg-[#1c1b1b]"
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-xs bg-primary/20 text-primary dark:bg-[#2a2a2a] dark:text-[#c0c1ff]">
                          {getInitials(user.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate dark:text-[#e5e2e1]">{user.displayName}</p>
                        <Select
                          value={role}
                          onValueChange={(v) => updateRole(user.id, v as "admin" | "user")}
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
                        onClick={() => removeSelected({ type: "user", user, role })}
                        className="shrink-0 text-muted-foreground hover:text-destructive dark:text-[#908fa0] dark:hover:text-red-400 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  {selected.length === 0 && (
                    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground dark:text-[#908fa0]">
                      선택된 대상이 없습니다.
                    </div>
                  )}
                </div>
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
            disabled={selected.length === 0}
            onClick={handleConfirm}
            className="border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 dark:border-[#6366F1] dark:bg-[#6366F1] dark:hover:opacity-90"
          >
            {selected.length > 0
              ? `${selected.length}개 추가`
              : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
