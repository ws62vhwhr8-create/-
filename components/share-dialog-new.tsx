"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, X, Users, User as UserIcon, Check, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import type { User, Group } from "@/lib/types"

interface EntraUser {
  id: string
  name: string
  email: string
  department: string
  type: 'user'
}

interface EntraGroup {
  id: string
  name: string
  memberCount: number
  type: 'group'
}

type EntraEntity = EntraUser | EntraGroup

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerName: string
  sharedUserIds?: string[]
  sharedGroupIds?: string[]
  storeUsers?: User[]
  storeGroups?: Group[]
  onShare: (entities: EntraEntity[]) => void
}

// Convert store User to EntraUser
const userToEntraUser = (user: User): EntraUser => ({
  id: user.id,
  name: user.displayName,
  email: user.email || '',
  department: 'Department',
  type: 'user'
})

// Convert store Group to EntraGroup
const groupToEntraGroup = (group: Group): EntraGroup => ({
  id: group.id,
  name: group.name,
  memberCount: 0,
  type: 'group'
})

export function ShareDialog({ 
  open, 
  onOpenChange, 
  customerName, 
  sharedUserIds = [], 
  sharedGroupIds = [], 
  storeUsers = [],
  storeGroups = [],
  onShare 
}: ShareDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEntities, setSelectedEntities] = useState<EntraEntity[]>([])
  const [isSharing, setIsSharing] = useState(false)
  const [listMode, setListMode] = useState<'group' | 'user'>('group')

  // Convert store data to searchable format
  const allSearchUsers = useMemo(() => storeUsers.map(userToEntraUser), [storeUsers])
  const allSearchGroups = useMemo(() => storeGroups.map(groupToEntraGroup), [storeGroups])

  // Get already shared entities
  const sharedEntities = useMemo(() => {
    const shared: EntraEntity[] = []
    
    // Add shared users
    sharedUserIds.forEach(userId => {
      const user = allSearchUsers.find(u => u.id === userId)
      if (user) shared.push(user)
    })
    
    // Add shared groups
    sharedGroupIds.forEach(groupId => {
      const group = allSearchGroups.find(g => g.id === groupId)
      if (group) shared.push(group)
    })
    
    return shared
  }, [sharedUserIds, sharedGroupIds, allSearchUsers, allSearchGroups])

  // Search both users and groups by name or email
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    
    const query = searchQuery.toLowerCase()
    
    const matchedUsers = allSearchUsers.filter(
      user => 
        user.name.toLowerCase().includes(query) || 
        user.email.toLowerCase().includes(query)
    )
    
    const matchedGroups = allSearchGroups.filter(
      group => group.name.toLowerCase().includes(query)
    )
    
    return (listMode === 'group' ? matchedGroups : matchedUsers) as EntraEntity[]
  }, [searchQuery, listMode, allSearchUsers, allSearchGroups])

  const isSelected = (entity: EntraEntity) => {
    return selectedEntities.some(e => e.id === entity.id)
  }

  const toggleSelection = (entity: EntraEntity) => {
    if (isSelected(entity)) {
      setSelectedEntities(prev => prev.filter(e => e.id !== entity.id))
    } else {
      setSelectedEntities(prev => [...prev, entity])
    }
  }

  const removeSelection = (entityId: string) => {
    setSelectedEntities(prev => prev.filter(e => e.id !== entityId))
  }

  const handleShare = async () => {
    if (selectedEntities.length === 0) return
    
    setIsSharing(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSharing(false)
    
    onShare(selectedEntities)
    setSelectedEntities([])
    setSearchQuery("")
    onOpenChange(false)
  }

  const handleClose = () => {
    setSelectedEntities([])
    setSearchQuery("")
    setListMode('group')
    onOpenChange(false)
  }

  const getInitials = (name: string) => {
    return name.slice(0, 2)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>고객 정보 공유</DialogTitle>
          <DialogDescription>
            &quot;{customerName}&quot; 정보를 공유할 사용자 또는 그룹을 검색하세요.
            <br />
            <span className="text-xs text-muted-foreground">
              조직 사용자 및 그룹 - 이름 또는 이메일로 검색
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Left Column - Search and Selection */}
          <div className="space-y-4 border-r pr-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="이름, 이메일 또는 그룹명으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={listMode === 'group' ? 'border-primary text-primary bg-primary/5' : 'border-transparent'}
                onClick={() => setListMode('group')}
              >
                그룹
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={listMode === 'user' ? 'border-primary text-primary bg-primary/5' : 'border-transparent'}
                onClick={() => setListMode('user')}
              >
                사용자
              </Button>
            </div>

            {/* Selected Entities */}
            {selectedEntities.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">선택됨 ({selectedEntities.length})</p>
                <div className="flex flex-wrap gap-2">
                  {selectedEntities.map((entity) => (
                    <Badge
                      key={entity.id}
                      variant="secondary"
                      className="flex items-center gap-1 py-1 px-2"
                    >
                      {entity.type === 'group' ? (
                        <Users className="h-3 w-3" />
                      ) : (
                        <UserIcon className="h-3 w-3" />
                      )}
                      <span>{entity.name}</span>
                      <button
                        onClick={() => removeSelection(entity.id)}
                        className="ml-1 hover:bg-muted rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            <div className="border rounded-lg bg-secondary/30">
              <ScrollArea className="h-[280px]">
                {searchQuery.trim() === "" ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <Search className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {listMode === 'group' ? '그룹명을 입력하세요' : '사용자 이름 또는 이메일을 입력하세요'}
                    </p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
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
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-secondary"
                        )}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className={cn(
                            "text-xs",
                            entity.type === 'group' 
                              ? "bg-chart-2/20 text-chart-2" 
                              : "bg-primary/20 text-primary"
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
                            <span className="font-medium truncate">{entity.name}</span>
                            {entity.type === 'group' && (
                              <Badge variant="outline" className="text-xs py-0">
                                그룹
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {entity.type === 'user' 
                              ? entity.email
                              : `${entity.memberCount}명의 멤버`
                            }
                          </p>
                        </div>
                        
                        {isSelected(entity) && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Right Column - Already Shared */}
          <div className="space-y-4 pl-4">
            <p className="text-sm font-medium text-muted-foreground">공유 대상 조회</p>
            <div className="border rounded-lg bg-secondary/30">
              <ScrollArea className="h-[400px]">
                {sharedEntities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      공유된 그룹/사용자가 없습니다
                    </p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {sharedEntities.map((entity) => (
                      <div
                        key={entity.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className={cn(
                            "text-xs",
                            entity.type === 'group' 
                              ? "bg-chart-2/20 text-chart-2" 
                              : "bg-primary/20 text-primary"
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
                            <span className="font-medium truncate">{entity.name}</span>
                            {entity.type === 'group' && (
                              <Badge variant="outline" className="text-xs py-0">
                                그룹
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {entity.type === 'user' 
                              ? entity.email
                              : `${entity.memberCount}명의 멤버`
                            }
                          </p>
                        </div>
                        
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button 
            onClick={handleShare} 
            disabled={selectedEntities.length === 0 || isSharing}
          >
            {isSharing ? (
              <>처리 중...</>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                공유 ({selectedEntities.length})
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
