"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Mail, Shield, Search } from "lucide-react"
import { EntraUserSelectDialog } from '@/components/entra-user-select-dialog'
import type { SelectedItem } from '@/components/entra-user-select-dialog'
import { useAppStore } from '@/lib/store'

export default function UsersPage() {
  const { users, groups, customers, addUser, updateUser, deleteUser, addGroup } = useAppStore()
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [assignedQuery, setAssignedQuery] = useState("")
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'user' | 'owner'>('all')

  // 사용자 표기 정규화: 중복 성/이름 패턴과 불필요 공백 제거
  const getCleanName = (name: string) => {
    if (!name) return ""

    const trimmed = name.replace(/\s+/g, ' ').trim()
    if (!trimmed) return ""

    const parts = trimmed.split(' ');

    if (parts.length === 1) {
      return trimmed
    }

    if (parts.length === 2) {
      const [first, second] = parts

      // 예: "김 김영업" -> "김영업", "Park Park" -> "Park"
      if (second.startsWith(first) || first === second) {
        return second
      }

      return `${first}${second}`
    }

    const [first, ...rest] = parts
    const mergedRest = rest.join('')

    if (mergedRest.startsWith(first)) {
      return mergedRest
    }

    return parts.join('')
  }

  const handleAdd = (items: SelectedItem[]) => {
    items.forEach((item) => {
      if (item.type === "group") {
        const { group } = item
        // 이미 등록된 그룹이면 스킵
        const exists = groups.find((g) => g.id === group.id || g.name === group.displayName)
        if (!exists) {
          addGroup({ name: group.displayName })
        }
        return
      }

      // type === "user"
      const { user, role } = item
      const existingUser = users.find(
        (u) =>
          (user.email && u.email && user.email === u.email) ||
          u.displayName === user.displayName
      )

      if (existingUser) {
        updateUser(existingUser.id, { role })
        return
      }

      const displayName = getCleanName(user.displayName)
      addUser({
        displayName,
        email: user.email || `${displayName}@dexconsulting.net`,
        role,
        groupIds: [],
      })
    })

    setIsPickerOpen(false)
  }

  const handleDelete = (id: string) => {
    deleteUser(id)
  }

  const ownerNames = new Set(customers.map((customer) => customer.ownerName))

  const filteredUsers = users.filter((user) => {
    const cleanName = getCleanName(user.displayName)
    const assignedGroupNames = (user.groupIds ?? [])
      .map((groupId) => groups.find((group) => group.id === groupId)?.name ?? '')
      .join(' ')
    const query = assignedQuery.trim().toLowerCase()
    const matchesQuery =
      query.length === 0 ||
      cleanName.toLowerCase().includes(query) ||
      (user.email ?? '').toLowerCase().includes(query) ||
      assignedGroupNames.toLowerCase().includes(query)

    const isOwner = ownerNames.has(cleanName) || ownerNames.has(user.displayName)
    const matchesType =
      userTypeFilter === 'all' ||
      (userTypeFilter === 'owner' ? isOwner : !isOwner)

    return matchesQuery && matchesType
  })

  return (
    <div className="flex min-h-screen w-full"> 
      <Navigation />
      <SidebarInset className="flex flex-col flex-1 w-full min-w-0">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center gap-4 px-4">
            <SidebarTrigger />
          </div>
        </header>

        {/* 수정된 부분: justify-center를 제거하여 왼쪽 정렬 및 전체 확장이 가능하도록 변경 */}
        <main className="flex-1 w-full overflow-y-auto bg-[#F8FAFC] dark:bg-[#131313]">
          {/* 수정된 부분: max-w-[1400px]를 제거하여 우측으로 끝까지 늘어나도록 변경 */}
          <div className="w-full px-6 py-8 lg:px-12 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold font-sans text-[#1b1b23] dark:text-[#e5e2e1]">사용자 관리</h1>
                <p className="text-[#64748B] dark:text-[#908fa0]">시스템 사용자 및 권한 관리 (Entra Mock)</p>
              </div>
              <div>
                <Button onClick={() => setIsPickerOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> 사용자 추가
                </Button>
              </div>
            </div>

            <div className="w-full rounded-lg border border-[#E2E8F0] bg-white shadow-sm dark:border-[#333333] dark:border-white/15 dark:bg-[#1E1E1E] dark:bg-[#1E1E1E]/60 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]">
              <div className="flex flex-col gap-3 border-b border-[#E2E8F0] px-8 py-4 dark:border-[#333333] sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B] dark:text-[#908fa0]" />
                  <Input
                    value={assignedQuery}
                    onChange={(e) => setAssignedQuery(e.target.value)}
                    placeholder="할당된 사용자 / 그룹 검색..."
                    className="pl-9 bg-white border-[#E2E8F0] dark:bg-[#1E1E1E] dark:border-[#464554]/50"
                  />
                </div>
                <Select value={userTypeFilter} onValueChange={(value) => setUserTypeFilter(value as 'all' | 'user' | 'owner')}>
                  <SelectTrigger className="w-full sm:w-44 dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]">
                    <SelectItem value="all" className="dark:border-b-0 dark:text-[#908fa0] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">전체</SelectItem>
                    <SelectItem value="user" className="dark:border-b-0 dark:text-[#60a5fa] dark:focus:text-[#60a5fa] dark:focus:bg-[#2A2A2A]">사용자</SelectItem>
                    <SelectItem value="owner" className="dark:border-b-0 dark:text-[#c0c1ff] dark:focus:text-[#c0c1ff] dark:focus:bg-[#2A2A2A]">담당자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-hidden rounded-b-lg border-t border-border dark:border-[#333333]">
                <table className="w-full border-collapse">
                  <thead className="border-b border-[#E2E8F0] bg-secondary/50 dark:border-[#333333] dark:bg-[#0e0e0e]">
                    <tr className="bg-secondary/50 hover:bg-secondary/50 dark:bg-[#0e0e0e] dark:hover:bg-[#0e0e0e]">
                      <th className="w-[30%] px-8 py-4 text-left text-sm font-bold text-[#64748B] dark:text-[#908fa0] dark:uppercase dark:tracking-wider">이름</th>
                      <th className="w-[40%] px-8 py-4 text-left text-sm font-bold text-[#64748B] dark:text-[#908fa0] dark:uppercase dark:tracking-wider">이메일</th>
                      <th className="w-[20%] px-8 py-4 text-left text-sm font-bold text-[#64748B] dark:text-[#908fa0] dark:uppercase dark:tracking-wider">역할</th>
                      <th className="w-[10%] px-8 py-4 text-center text-sm font-bold text-[#64748B] dark:text-[#908fa0]">작업</th>
                    </tr>
                  </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    // 렌더링 직전에 이름을 한 번 더 정제
                    const cleanName = getCleanName(user.displayName);

                    return (
                      <tr key={user.id} className="border-b border-[#E2E8F0] transition-colors hover:bg-secondary/30 dark:border-[#333333] dark:hover:bg-[#323232]">
                        <td className="py-5 px-8">
                          <span className="font-bold text-base text-slate-900 dark:text-[#e5e2e1]">{cleanName}</span>
                        </td>
                        <td className="py-5 px-8 text-[#64748B] dark:text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 flex-shrink-0 opacity-70" />
                            <span className="text-sm">{user.email}</span>
                          </div>
                        </td>
                        <td className="py-5 px-8">
                          <Select value={user.role} onValueChange={(value) => updateUser(user.id, { role: value as 'admin' | 'user' })}>
                            <SelectTrigger className="w-32 h-9 dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                <span className={`text-sm ${user.role === 'admin' ? 'dark:text-[#c0c1ff]' : 'dark:text-[#60a5fa]'}`}>
                                  {user.role === 'admin' ? '관리자' : '사용자'}
                                </span>
                              </div>
                            </SelectTrigger>
                            <SelectContent className="dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]">
                              <SelectItem value="user" className="dark:border-b-0 dark:text-[#60a5fa] dark:focus:text-[#60a5fa] dark:focus:bg-[#2A2A2A]">사용자</SelectItem>
                              <SelectItem value="admin" className="dark:border-b-0 dark:text-[#c0c1ff] dark:focus:text-[#c0c1ff] dark:focus:bg-[#2A2A2A]">관리자</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-5 px-8 text-center">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>사용자 삭제</AlertDialogTitle>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(user.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                        검색 조건에 맞는 할당된 사용자 / 그룹이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>

        <EntraUserSelectDialog
          open={isPickerOpen}
          onOpenChange={setIsPickerOpen}
          onConfirm={handleAdd}
        />
      </SidebarInset>
    </div>
  )
}