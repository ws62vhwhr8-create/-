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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, X, Users, User, Check, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

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

// Mock Entra ID data
const mockEntraUsers: EntraUser[] = [
  { id: 'u1', name: '김철수', email: 'cs.kim@company.com', department: '영업1팀', type: 'user' },
  { id: 'u2', name: '이영희', email: 'yh.lee@company.com', department: '영업2팀', type: 'user' },
  { id: 'u3', name: '박지민', email: 'jm.park@company.com', department: '기술지원팀', type: 'user' },
  { id: 'u4', name: '최수현', email: 'sh.choi@company.com', department: '마케팅팀', type: 'user' },
  { id: 'u5', name: '정민준', email: 'mj.jung@company.com', department: '영업1팀', type: 'user' },
  { id: 'u6', name: '강서연', email: 'sy.kang@company.com', department: '기술지원팀', type: 'user' },
  { id: 'u7', name: '윤도현', email: 'dh.yoon@company.com', department: '영업3팀', type: 'user' },
  { id: 'u8', name: '임하은', email: 'he.lim@company.com', department: '경영지원팀', type: 'user' },
  { id: 'u9', name: '한지우', email: 'jw.han@company.com', department: '영업2팀', type: 'user' },
  { id: 'u10', name: '오세진', email: 'sj.oh@company.com', department: '기술지원팀', type: 'user' },
]

const mockEntraGroups: EntraGroup[] = [
  { id: 'g1', name: '영업1팀', memberCount: 8, type: 'group' },
  { id: 'g2', name: '영업2팀', memberCount: 6, type: 'group' },
  { id: 'g3', name: '영업3팀', memberCount: 5, type: 'group' },
  { id: 'g4', name: '기술지원팀', memberCount: 12, type: 'group' },
  { id: 'g5', name: '마케팅팀', memberCount: 7, type: 'group' },
  { id: 'g6', name: '경영지원팀', memberCount: 4, type: 'group' },
  { id: 'g7', name: '전사 영업', memberCount: 19, type: 'group' },
  { id: 'g8', name: '임원진', memberCount: 5, type: 'group' },
]

interface EntraUserSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (entity: EntraEntity, role: 'admin' | 'user') => void
}

export function EntraUserSelectDialog({ 
  open, 
  onOpenChange, 
  onConfirm 
}: EntraUserSelectDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEntity, setSelectedEntity] = useState<EntraEntity | null>(null)
  const [selectedRole, setSelectedRole] = useState<'admin' | 'user'>('user')
  const [step, setStep] = useState<'select' | 'role'>('select')

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    
    const query = searchQuery.toLowerCase()
    
    const matchedUsers = mockEntraUsers.filter(
      user => 
        user.name.toLowerCase().includes(query) || 
        user.email.toLowerCase().includes(query) ||
        user.department.toLowerCase().includes(query)
    )
    
    const matchedGroups = mockEntraGroups.filter(
      group => group.name.toLowerCase().includes(query)
    )
    
    return [...matchedGroups, ...matchedUsers] as EntraEntity[]
  }, [searchQuery])

  const handleEntitySelect = (entity: EntraEntity) => {
    setSelectedEntity(entity)
    setStep('role')
  }

  const handleConfirm = () => {
    if (!selectedEntity) return
    onConfirm(selectedEntity, selectedRole)
    handleClose()
  }

  const handleClose = () => {
    setSearchQuery("")
    setSelectedEntity(null)
    setSelectedRole('user')
    setStep('select')
    onOpenChange(false)
  }

  const getInitials = (name: string) => {
    return name.slice(0, 2)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? '사용자 또는 그룹 선택' : '역할 선택'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' 
              ? 'Entra ID에서 사용자 또는 그룹을 선택하세요. 이름, 이메일 또는 조직명으로 검색할 수 있습니다.'
              : `선택된 ${selectedEntity?.type === 'group' ? '그룹' : '사용자'} "${selectedEntity?.name}"의 역할을 선택하세요.`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="이름, 이메일 또는 그룹명으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary"
                autoFocus
              />
            </div>

            {/* Search Results */}
            <div className="border rounded-lg bg-secondary/30">
              <ScrollArea className="h-[300px]">
                {searchQuery.trim() === "" ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <Search className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      사용자 이름, 이메일 또는 그룹명을 입력하세요
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
                        onClick={() => handleEntitySelect(entity)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left hover:bg-secondary"
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
                              ? `${entity.email} · ${entity.department}`
                              : `${entity.memberCount}명의 멤버`
                            }
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                취소
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Selected Entity Display */}
            <div className="border rounded-lg p-4 bg-secondary/30">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={cn(
                    "text-xs",
                    selectedEntity?.type === 'group' 
                      ? "bg-chart-2/20 text-chart-2" 
                      : "bg-primary/20 text-primary"
                  )}>
                    {selectedEntity?.type === 'group' ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      getInitials(selectedEntity?.name || '')
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedEntity?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedEntity?.type === 'user' 
                      ? selectedEntity.email
                      : `${selectedEntity?.memberCount}명의 멤버`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <Label htmlFor="role">역할 선택</Label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as 'admin' | 'user')}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      사용자 (User 메뉴만 접근)
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      관리자 (User, Admin 메뉴 접근)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedRole === 'user' 
                  ? '사용자는 고객 관리 메뉴에만 접근할 수 있습니다.'
                  : '관리자는 모든 메뉴와 사용자 관리 기능에 접근할 수 있습니다.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setStep('select')}
              >
                뒤로
              </Button>
              <Button onClick={handleConfirm}>
                추가
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
