"use client"

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Search, X, Users, User as UserIcon, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User, Group } from '@/lib/types'

interface OwnerEntity {
  id: string
  name: string
  email?: string
  type: 'user' | 'group'
}

interface OwnerPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: User[]
  groups: Group[]
  selectedOwner: string
  onConfirm: (owners: OwnerEntity[]) => void
}

export function OwnerPicker({ 
  open, 
  onOpenChange, 
  users,
  groups,
  selectedOwner,
  onConfirm 
}: OwnerPickerProps) {
  const [query, setQuery] = useState('')
  const [selectedEntities, setSelectedEntities] = useState<OwnerEntity[]>([])
  const [listMode, setListMode] = useState<'group' | 'user'>('group')

  // Convert users and groups to searchable format
  const allSearchUsers = useMemo(() => 
    users.map(u => ({
      id: u.id,
      name: u.displayName,
      email: u.email,
      type: 'user' as const
    })), [users]
  )

  const allSearchGroups = useMemo(() => 
    groups.map(g => ({
      id: g.id,
      name: g.name,
      type: 'group' as const
    })), [groups]
  )

  // Search both users and groups
  const searchResults = useMemo(() => {
    const query_lower = query.toLowerCase()
    
    const matchedUsers = allSearchUsers.filter(u => 
      u.name.toLowerCase().includes(query_lower) || 
      u.email?.toLowerCase().includes(query_lower)
    )
    
    const matchedGroups = allSearchGroups.filter(g => 
      g.name.toLowerCase().includes(query_lower)
    )
    
    return (listMode === 'group' ? matchedGroups : matchedUsers) as OwnerEntity[]
  }, [query, listMode, allSearchUsers, allSearchGroups])

  const isSelected = (entity: OwnerEntity) => {
    return selectedEntities.some(e => e.id === entity.id)
  }

  const toggleSelection = (entity: OwnerEntity) => {
    if (isSelected(entity)) {
      setSelectedEntities(prev => prev.filter(e => e.id !== entity.id))
    } else {
      setSelectedEntities(prev => [...prev, entity])
    }
  }

  const removeSelection = (entityId: string) => {
    setSelectedEntities(prev => prev.filter(e => e.id !== entityId))
  }

  const handleConfirm = () => {
    onConfirm(selectedEntities)
    setSelectedEntities([])
    setQuery('')
    setListMode('group')
    onOpenChange(false)
  }

  const handleClose = () => {
    setSelectedEntities([])
    setQuery('')
    setListMode('group')
    onOpenChange(false)
  }

  const getInitials = (name: string) => {
    return name.slice(0, 2)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] dark:bg-[#1c1b1b] dark:border-[#464554]">
        <DialogHeader className="dark:border-b dark:border-[#464554]">
          <DialogTitle className="dark:text-[#e5e2e1]">담당자 선택</DialogTitle>
          <DialogDescription className="dark:text-[#c7c4d7]">
            프로젝트 담당자로 설정할 사용자 또는 그룹을 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Left Column - Search and Selection */}
          <div className="space-y-4 border-r dark:border-r-[#464554] pr-4">
            {/* Search Input */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-[#908fa0] dark:group-focus-within:text-[#c0c1ff] transition-colors" />
              <Input
                placeholder="이름 또는 이메일로 검색..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 bg-secondary dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]"
              />
            </div>

            <div className="flex gap-2 border-b dark:border-b-[#464554]">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={listMode === 'group' ? 'border-primary text-primary bg-primary/5 dark:border-b-2 dark:border-b-[#c0c1ff] dark:border-transparent dark:bg-transparent dark:text-[#c0c1ff]' : 'border-transparent dark:border-transparent dark:text-[#908fa0] dark:hover:text-[#e5e2e1]'}
                onClick={() => setListMode('group')}
              >
                그룹
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={listMode === 'user' ? 'border-primary text-primary bg-primary/5 dark:border-b-2 dark:border-b-[#c0c1ff] dark:border-transparent dark:bg-transparent dark:text-[#c0c1ff]' : 'border-transparent dark:border-transparent dark:text-[#908fa0] dark:hover:text-[#e5e2e1]'}
                onClick={() => setListMode('user')}
              >
                사용자
              </Button>
            </div>

            {/* Selected Entities */}
            {selectedEntities.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground dark:text-[#908fa0]">선택됨 ({selectedEntities.length})</p>
                <div className="flex flex-wrap gap-2">
                  {selectedEntities.map((entity) => (
                    <Badge
                      key={entity.id}
                      variant="secondary"
                      className="flex items-center gap-1 py-1 px-2 dark:bg-[#2a2a2a] dark:text-[#c7c4d7]"
                    >
                      {entity.type === 'group' ? (
                        <Users className="h-3 w-3" />
                      ) : (
                        <UserIcon className="h-3 w-3" />
                      )}
                      <span>{entity.name}</span>
                      <button
                        onClick={() => removeSelection(entity.id)}
                        className="ml-1 hover:bg-muted dark:hover:bg-[#353534] rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            <div className="border rounded-lg bg-secondary/30 dark:bg-[#0e0e0e] dark:border-[#464554]">
              <ScrollArea className="h-[200px]">
                {searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/50 dark:text-[#908fa0]/50 mb-2" />
                    <p className="text-sm text-muted-foreground dark:text-[#908fa0]">
                      검색 결과가 없습니다
                    </p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {searchResults.map((entity) => (
                      <button
                        key={entity.id}
                        onClick={() => toggleSelection(entity)}
                        className={cn(
                          "w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left",
                          isSelected(entity)
                            ? "bg-primary/10 border border-primary/30 dark:bg-[#2a2a2a] dark:border-[#c0c1ff]"
                            : "hover:bg-secondary dark:hover:bg-[#2a2a2a]"
                        )}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn(
                            "text-xs dark:bg-[#353534]",
                            entity.type === 'group' 
                              ? "bg-chart-2/20 text-chart-2 dark:text-[#c0c1ff]" 
                              : "bg-primary/20 text-primary dark:text-[#c0c1ff]"
                          )}>
                            {entity.type === 'group' ? (
                              <Users className="h-4 w-4" />
                            ) : (
                              getInitials(entity.name)
                            )}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate text-sm dark:text-[#e5e2e1]">{entity.name}</span>
                            {entity.type === 'group' && (
                              <Badge variant="outline" className="text-xs py-0 dark:border-[#464554] dark:text-[#c7c4d7]">
                                그룹
                              </Badge>
                            )}
                          </div>
                          {entity.type === 'user' && entity.email && (
                            <p className="text-xs text-muted-foreground truncate dark:text-[#908fa0]">
                              {entity.email}
                            </p>
                          )}
                        </div>
                        
                        {isSelected(entity) && (
                          <Check className="h-4 w-4 text-primary dark:text-[#c0c1ff] flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Right Column - Preview */}
          <div className="space-y-4 pl-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 dark:bg-[#0e0e0e] dark:border-[#464554]">
              <p className="text-xs text-muted-foreground dark:text-[#908fa0] mb-3">선택된 담당자</p>
              {selectedEntities.length === 0 ? (
                <p className="text-sm text-muted-foreground dark:text-[#908fa0]">선택된 담당자가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {selectedEntities.map((entity) => (
                    <div key={entity.id} className="flex items-center gap-2 p-2 bg-secondary/50 dark:bg-[#2a2a2a] rounded">
                      {entity.type === 'group' ? (
                        <Users className="h-4 w-4 text-muted-foreground dark:text-[#908fa0]" />
                      ) : (
                        <UserIcon className="h-4 w-4 text-muted-foreground dark:text-[#908fa0]" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm dark:text-[#e5e2e1]">{entity.name}</p>
                        {entity.type === 'user' && entity.email && (
                          <p className="text-xs text-muted-foreground truncate dark:text-[#908fa0]">{entity.email}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="dark:border-t dark:border-t-[#464554] pt-6">
          <Button variant="outline" onClick={handleClose} className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]">취소</Button>
          <Button onClick={handleConfirm} disabled={selectedEntities.length === 0} className="dark:bg-primary dark:text-white dark:hover:bg-primary/90">확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
