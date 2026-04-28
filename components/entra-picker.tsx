"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Search, Users, User as UserIcon, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'

export interface PickerUser {
  id: string
  displayName: string
  email?: string
  groupIds?: string[]
}

const directoryUsers: PickerUser[] = [
  { id: 'dir-u1', displayName: '김영업', email: 'kim@example.com', groupIds: ['g1'] },
  { id: 'dir-u2', displayName: '박매니저', email: 'park@example.com', groupIds: ['g2'] },
  { id: 'dir-u3', displayName: '이대리', email: 'lee@example.com', groupIds: ['g1'] },
  { id: 'dir-u4', displayName: '정민준', email: 'jung@example.com', groupIds: ['g2'] },
  { id: 'dir-u5', displayName: '최수현', email: 'choi@example.com', groupIds: ['g1'] },
  { id: 'dir-u6', displayName: '강서연', email: 'kang@example.com', groupIds: ['g1'] },
  { id: 'dir-u7', displayName: '윤도현', email: 'yoon@example.com', groupIds: ['g2'] },
]

interface EntraPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialUserIds?: string[]
  initialGroupIds?: string[]
  onConfirm: (selectedUsers: PickerUser[], groupIds: string[]) => void
}

export default function EntraPicker({ open, onOpenChange, initialUserIds = [], initialGroupIds = [], onConfirm }: EntraPickerProps) {
  const users = useAppStore(state => state.users)
  const groups = useAppStore(state => state.groups)

  const mergedDirectoryUsers = [
    ...directoryUsers,
    ...users
      .filter((u) => !directoryUsers.some((du) => (du.email && u.email && du.email === u.email) || du.displayName === u.displayName))
      .map((u): PickerUser => ({
        id: `store-${u.id}`,
        displayName: u.displayName,
        email: u.email,
        groupIds: u.groupIds,
      })),
  ]

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(initialUserIds)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(initialGroupIds)
  const [query, setQuery] = useState('')
  const [listMode, setListMode] = useState<'group' | 'user'>('group')

  const toggleUser = (id: string) => {
    setSelectedUserIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }
  const toggleGroup = (id: string) => {
    setSelectedGroupIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  const filteredUsers = mergedDirectoryUsers.filter((u) => {
    const normalized = query.toLowerCase()
    return (
      u.displayName.toLowerCase().includes(normalized) ||
      (u.email ?? '').toLowerCase().includes(normalized)
    )
  })
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(query.toLowerCase()))

  const removeSelection = (type: 'user' | 'group', id: string) => {
    if (type === 'user') {
      setSelectedUserIds(s => s.filter(x => x !== id))
      return
    }

    setSelectedGroupIds(s => s.filter(x => x !== id))
  }

  const getInitials = (name: string) => name.slice(0, 2)

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedUserIds(initialUserIds)
      setSelectedGroupIds(initialGroupIds)
      setQuery('')
      setListMode('group')
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] dark:bg-[#1c1b1b] dark:border-[#464554] max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="dark:border-b dark:border-[#464554] px-6 py-5">
          <DialogTitle className="dark:text-[#e5e2e1]">사용자 추가</DialogTitle>
          <DialogDescription className="dark:text-[#c7c4d7]">사용자 또는 그룹을 검색하고 선택하세요.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-0 min-h-[460px]">
          <div className="space-y-4 border-r dark:border-r-[#464554] px-4 py-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-[#908fa0] dark:group-focus-within:text-[#c0c1ff] transition-colors" />
              <Input
                placeholder="이름, 이메일 또는 그룹명으로 검색..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 bg-secondary dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]"
              />
            </div>

            <div className="flex gap-2 border-b dark:border-b-[#464554] pb-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={listMode === 'group' ? 'border-primary text-primary bg-primary/5 dark:border-[#464554] dark:bg-[#2a2a2a] dark:text-[#c0c1ff]' : 'border-transparent dark:text-[#908fa0] dark:hover:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]'}
                onClick={() => setListMode('group')}
              >
                그룹
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={listMode === 'user' ? 'border-primary text-primary bg-primary/5 dark:border-[#464554] dark:bg-[#2a2a2a] dark:text-[#c0c1ff]' : 'border-transparent dark:text-[#908fa0] dark:hover:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]'}
                onClick={() => setListMode('user')}
              >
                사용자
              </Button>
            </div>

            <div className="border rounded-lg bg-secondary/30 dark:bg-[#0e0e0e] dark:border-[#464554]">
              <ScrollArea className="h-[280px]">
                <div className="p-2 space-y-1">
                  {(listMode === 'group' ? filteredGroups : filteredUsers).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                      <Users className="h-8 w-8 text-muted-foreground/50 dark:text-[#908fa0]/50 mb-2" />
                      <p className="text-sm text-muted-foreground dark:text-[#908fa0]">검색 결과가 없습니다</p>
                    </div>
                  ) : listMode === 'group' ? (
                    filteredGroups.map((g) => {
                      const selected = selectedGroupIds.includes(g.id)
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGroup(g.id)}
                          className={cn(
                            'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
                            selected ? 'bg-primary/10 border border-primary/30 dark:bg-[#2a2a2a] dark:border-[#c0c1ff]/40' : 'hover:bg-secondary dark:hover:bg-[#2a2a2a]'
                          )}
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-chart-2/20 text-chart-2 dark:bg-[#353534] dark:text-[#c0c1ff]">
                              <Users className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate dark:text-[#e5e2e1]">{g.name}</span>
                              <Badge variant="outline" className="text-xs py-0 dark:border-[#464554] dark:text-[#c7c4d7]">그룹</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground dark:text-[#908fa0] truncate">그룹</p>
                          </div>
                          {selected && <Check className="h-4 w-4 text-primary dark:text-[#c0c1ff]" />}
                        </button>
                      )
                    })
                  ) : (
                    filteredUsers.map((u) => {
                      const selected = selectedUserIds.includes(u.id)
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleUser(u.id)}
                          className={cn(
                            'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
                            selected ? 'bg-primary/10 border border-primary/30 dark:bg-[#2a2a2a] dark:border-[#c0c1ff]/40' : 'hover:bg-secondary dark:hover:bg-[#2a2a2a]'
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
                            </div>
                            <p className="text-sm text-muted-foreground dark:text-[#908fa0] truncate">{u.email}</p>
                          </div>
                          {selected && <Check className="h-4 w-4 text-primary dark:text-[#c0c1ff]" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="space-y-3 bg-secondary/20 dark:bg-[#0e0e0e] px-4 py-4">
            <div className="flex items-center justify-between border-b border-border dark:border-[#464554] pb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-[#908fa0]">선택됨</p>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs dark:border-[#464554] dark:text-[#c7c4d7]">사용자 {selectedUserIds.length}명</Badge>
                <Badge variant="outline" className="text-xs dark:border-[#464554] dark:text-[#c7c4d7]">그룹 {selectedGroupIds.length}개</Badge>
              </div>
            </div>

            <div className="border rounded-lg bg-secondary/20 dark:bg-[#131313] dark:border-[#464554]">
              <ScrollArea className="h-[280px]">
                <div className="p-3 space-y-2">
                  {selectedGroupIds.map((groupId) => {
                    const group = groups.find(g => g.id === groupId)
                    if (!group) return null

                    return (
                      <Badge key={group.id} variant="secondary" className="flex w-fit items-center gap-1 py-1 px-2 dark:bg-[#2a2a2a] dark:text-[#c7c4d7]">
                        <Users className="h-3 w-3" />
                        <span>{group.name}</span>
                        <button
                          type="button"
                          onClick={() => removeSelection('group', group.id)}
                          className="ml-1 hover:bg-muted dark:hover:bg-[#353534] rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}

                  {selectedUserIds.map((userId) => {
                    const user = mergedDirectoryUsers.find((u) => u.id === userId)
                    if (!user) return null

                    return (
                      <Badge key={user.id} variant="secondary" className="flex w-fit items-center gap-1 py-1 px-2 dark:bg-[#2a2a2a] dark:text-[#c7c4d7]">
                        <UserIcon className="h-3 w-3" />
                        <span>{user.displayName}</span>
                        <button
                          type="button"
                          onClick={() => removeSelection('user', user.id)}
                          className="ml-1 hover:bg-muted dark:hover:bg-[#353534] rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}

                  {selectedUserIds.length === 0 && selectedGroupIds.length === 0 && (
                    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground dark:text-[#908fa0]">
                      선택된 대상이 없습니다.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 px-6 pb-5 border-t dark:border-t-[#464554] bg-secondary/20 dark:bg-[#0e0e0e]">
          <Button variant="outline" className="dark:bg-transparent dark:border-[#464554] dark:text-[#c7c4d7] dark:hover:bg-[#2a2a2a]" onClick={() => handleClose(false)}>취소</Button>
          <Button
            className="border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 dark:border-[#6366F1] dark:bg-[#6366F1] dark:hover:opacity-90"
            onClick={() => {
              const directlySelectedUsers = selectedUserIds
                .map((id) => mergedDirectoryUsers.find((user) => user.id === id))
                .filter((user): user is PickerUser => Boolean(user))

              const groupMemberUsers = mergedDirectoryUsers.filter((user) =>
                (user.groupIds ?? []).some((groupId) => selectedGroupIds.includes(groupId))
              )

              const selectedUsers = Array.from(
                new Map([...directlySelectedUsers, ...groupMemberUsers].map((user) => [user.id, user])).values()
              )

              onConfirm(selectedUsers, selectedGroupIds)
              handleClose(false)
            }}
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
