"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Mail } from 'lucide-react'
import type { User } from '@/lib/types'

interface OwnerPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: User[]
  selectedOwner: string
  onConfirm: (ownerName: string) => void
}

export function OwnerPicker({ 
  open, 
  onOpenChange, 
  users, 
  selectedOwner,
  onConfirm 
}: OwnerPickerProps) {
  const [query, setQuery] = useState('')
  const [tempSelected, setTempSelected] = useState(selectedOwner)

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(query.toLowerCase()) ||
    u.email.toLowerCase().includes(query.toLowerCase())
  )

  const handleConfirm = () => {
    onConfirm(tempSelected)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>담당자 선택</DialogTitle>
          <DialogDescription>프로젝트 담당자를 선택하세요.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="이름 또는 이메일로 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="border rounded-lg">
            <ScrollArea className="h-72">
              <div className="space-y-1 p-2">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>해당하는 담당자가 없습니다.</p>
                  </div>
                ) : (
                  filteredUsers.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={tempSelected === user.displayName}
                        onCheckedChange={() => setTempSelected(user.displayName)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{user.displayName}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </div>
                      {tempSelected === user.displayName && (
                        <Badge variant="default" className="ml-auto flex-shrink-0">선택</Badge>
                      )}
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {tempSelected && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">선택된 담당자</p>
              <p className="font-medium text-sm">{tempSelected}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleConfirm} disabled={!tempSelected}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
