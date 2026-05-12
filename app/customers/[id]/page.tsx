"use client"

import { Fragment, use, useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Navigation } from "@/components/navigation"
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { format, differenceInDays, startOfDay, min, max, eachMonthOfInterval, startOfMonth, endOfMonth } from "date-fns"
import { ko } from "date-fns/locale"
import {
  ArrowLeft,
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Download,
  Edit2,
  FileText,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Folder,
  FolderOpen,
  FolderPlus,
  Info,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
  Users,
  Shield,
} from "lucide-react"
import Link from "next/link"
import * as XLSX from "xlsx"
import type { Milestone, MilestoneNote, Customer, MilestoneFile } from "@/lib/types"
import EntraPicker from "@/components/entra-picker"
import type { PickerUser } from "@/components/entra-picker"
import dynamic from 'next/dynamic'
import { canAccessCustomer, isAdminRole } from "@/lib/permissions"

const GanttChart = dynamic(() => import('@/components/gantt-chart'), {
  ssr: false,
  loading: () => (
    <Card className="bg-secondary/30 border-border dark:bg-[#171616] dark:border-[#333333]">
      <CardHeader>
        <CardTitle>간이 WBS</CardTitle>
        <CardDescription>워크플로우 단계를 WBS로 구현하여 조회 및 다운로드 할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-96 flex items-center justify-center text-muted-foreground">
          로딩 중...
        </div>
      </CardContent>
    </Card>
  )
})

const statusLabels: Record<Milestone['status'], string> = {
  pending: '대기',
  'in-progress': '진행중',
  completed: '완료',
  overdue: '지연',
}

const statusStyles: Record<Milestone['status'], string> = {
  pending: 'bg-muted text-muted-foreground border-muted dark:bg-[#353534] dark:text-[#c7c4d7] dark:border-[#464554]',
  'in-progress': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-[#3b82f6]/10 dark:text-[#3b82f6] dark:border-[#3b82f6]/20',
  completed: 'bg-lime-100 text-lime-700 border-lime-200 dark:bg-[#22c55e]/10 dark:text-[#22c55e] dark:border-[#22c55e]/20',
  overdue: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-[#ffb4ab]/10 dark:text-[#ffb4ab] dark:border-[#ffb4ab]/20',
}

type FileLibraryTarget = {
  milestoneId: string
  noteId: string | null
  kind: 'stage' | 'action-item'
  label: string
  parentFolderId: string | null
  folderPath: string[]
}

type EditableMilestone = Omit<Milestone, 'dueDate' | 'notifyDate'> & {
  dueDate: string
  notifyDate: string
}

const StatusIcon = ({ status }: { status: Milestone['status'] }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-lime-600" />
    case 'in-progress':
      return <Clock className="h-4 w-4 text-amber-600" />
    case 'overdue':
      return <AlertTriangle className="h-4 w-4 text-rose-600" />
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />
  }
}

export default function CustomerDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    customers,
    updateCustomer,
    updateMilestoneStatus,
    updateMilestone,
    deleteCustomer,
    users,
    groups,
    solutions,
    currentUserId,
    currentEntraId,
  } = useAppStore()
  const toEditableMilestone = (milestone: Milestone): EditableMilestone => ({
    ...milestone,
    dueDate: format(milestone.dueDate, 'yyyy-MM-dd'),
    notifyDate: format(milestone.notifyDate, 'yyyy-MM-dd'),
  })

  const calculateCustomerStatus = (milestones: Milestone[]): Customer['status'] => {
    const hasOverdue = milestones.some((milestone) => milestone.status === 'overdue')
    const allCompleted = milestones.every((milestone) => milestone.status === 'completed')

    if (allCompleted) return 'completed'
    if (hasOverdue) return 'at-risk'
    return 'active'
  }
  
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true')
  const [editedStartDate, setEditedStartDate] = useState('')
  const [editedOwner, setEditedOwner] = useState('')
  const [editingMilestones, setEditingMilestones] = useState<EditableMilestone[]>([])
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState("table")
    // Collapse customer info accordion when switching to file library tab
    const [customerSummaryOpen, setCustomerSummaryOpen] = useState<string | undefined>("customer-summary")
    useEffect(() => {
      if (activeTab === "milestone-detail") {
        setCustomerSummaryOpen(undefined)
      }
    }, [activeTab])
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null)
  const [noteEditTarget, setNoteEditTarget] = useState<string | null>(null)
  const [replyTarget, setReplyTarget] = useState<{ milestoneId: string; parentNoteId: string } | null>(null)
  const [editingExistingNote, setEditingExistingNote] = useState<{ milestoneId: string; noteId: string } | null>(null)
  const [collapsedNoteChildren, setCollapsedNoteChildren] = useState<Set<string>>(new Set())
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [noteMetaDrafts, setNoteMetaDrafts] = useState<Record<string, {
    ownerName: string
    dueDate: string
    notifyDate: string
    status: Milestone['status']
  }>>({})
  const [selectedFileTarget, setSelectedFileTarget] = useState<FileLibraryTarget | null>(null)
  const [libraryByTarget, setLibraryByTarget] = useState<Record<string, MilestoneFile[]>>({})
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [fileSortOption, setFileSortOption] = useState<'uploaded-desc' | 'uploaded-asc' | 'size-desc' | 'size-asc'>('uploaded-desc')
  const [isStageFolderCollapsed, setIsStageFolderCollapsed] = useState(false)
  const [collapsedStageFolderParents, setCollapsedStageFolderParents] = useState<Set<string>>(new Set())
  const [stageFolderHeight, setStageFolderHeight] = useState(192)
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false)
  const [folderNameDraft, setFolderNameDraft] = useState('')
  const [folderTarget, setFolderTarget] = useState<FileLibraryTarget | null>(null)
  const [selectedFileForViewer, setSelectedFileForViewer] = useState<MilestoneFile | null>(null)
  const [pdfViewerPage, setPdfViewerPage] = useState(1)
  const [pdfViewerSrc, setPdfViewerSrc] = useState<string | null>(null)
  const [docxViewerPage, setDocxViewerPage] = useState(1)
  const [docxViewerTotalPages, setDocxViewerTotalPages] = useState(1)
  const [docxZoom, setDocxZoom] = useState(1)
  const [isLoadingDocxPreview, setIsLoadingDocxPreview] = useState(false)
  const [docxPreviewError, setDocxPreviewError] = useState<string | null>(null)
  const docxPreviewContainerRef = useRef<HTMLDivElement | null>(null)
  const [docxContainerMounted, setDocxContainerMounted] = useState(false)
  const docxContainerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    docxPreviewContainerRef.current = node
    setDocxContainerMounted(!!node)
  }, [])
  const [textFileContent, setTextFileContent] = useState<string | null>(null)
  const [isLoadingTextPreview, setIsLoadingTextPreview] = useState(false)
  const [textPreviewError, setTextPreviewError] = useState<string | null>(null)
  const [imageLoadError, setImageLoadError] = useState(false)
  const [dragOverMilestoneId, setDragOverMilestoneId] = useState<string | null>(null)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{
    targetKey: string
    total: number
    completed: number
    currentFileName: string
  } | null>(null)
  const milestoneExcelInputRef = useRef<HTMLInputElement | null>(null)
  const [excelImportPending, setExcelImportPending] = useState<{
    toAdd: EditableMilestone[]
    toUpdate: EditableMilestone[]
    kept: EditableMilestone[]
  } | null>(null)
  const [isExcelConfirmOpen, setIsExcelConfirmOpen] = useState(false)
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false)
  const [isDeleteMilestoneConfirmOpen, setIsDeleteMilestoneConfirmOpen] = useState(false)
  const [deleteMilestoneTargetId, setDeleteMilestoneTargetId] = useState<string | null>(null)
  const [isDeleteFileConfirmOpen, setIsDeleteFileConfirmOpen] = useState(false)
  const [deleteFileTarget, setDeleteFileTarget] = useState<{ target: FileLibraryTarget; fileId: string } | null>(null)
  const [isDeleteNoteConfirmOpen, setIsDeleteNoteConfirmOpen] = useState(false)
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<{ milestone: Milestone; noteId: string } | null>(null)
  const [isOwnerPickerOpen, setIsOwnerPickerOpen] = useState(false)
  const isMountedRef = useRef(true)
  
  const customer = customers.find(c => c.id === id)
  const currentUser = users.find((user) => user.id === currentUserId)
  const isAdmin = isAdminRole(currentUser?.role)
  const hasCustomerAccess = customer
    ? canAccessCustomer({
        customer,
        currentUser,
        currentEntraId,
        isAdmin,
      })
    : false
  const displayedMilestones = isEditing ? editingMilestones : (customer?.milestones ?? [])
  
  // Get available users based on actual shared users and groups
  const availableUsers = useMemo(() => {
    if (!customer) return users
    
    const availableUserSet = new Set<string>()
    
    // Add directly shared users
    if (customer.sharedUserIds && customer.sharedUserIds.length > 0) {
      customer.sharedUserIds.forEach(userId => {
        const user = users.find(u => u.id === userId)
        if (user) availableUserSet.add(user.id)
      })
    }
    
    // Add users from shared groups
    if (customer.sharedGroupIds && customer.sharedGroupIds.length > 0) {
      users.forEach(user => {
        if (user.groupIds?.some(groupId => customer.sharedGroupIds?.includes(groupId))) {
          availableUserSet.add(user.id)
        }
      })
    }
    
    if (availableUserSet.size === 0) {
      return users
    }

    return users.filter(u => availableUserSet.has(u.id))
  }, [customer, users])

  useEffect(() => {
    if (customer && !hasCustomerAccess) {
      router.replace('/customers')
    }
  }, [customer, hasCustomerAccess, router])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  if (customer && !hasCustomerAccess) {
    return null
  }

  // Initialize edit fields when customer loads or editing mode changes
  useEffect(() => {
    if (customer && isEditing) {
      const startDateStr = format(customer.salesStartDate, 'yyyy-MM-dd')
      setEditedStartDate(startDateStr)
      setEditedOwner(customer.ownerName)
      setEditingMilestones(customer.milestones.map(toEditableMilestone))
    }
  }, [customer, isEditing])

  useEffect(() => {
    if (!customer) return
    if (!selectedMilestoneId && customer.milestones.length > 0) {
      setSelectedMilestoneId(customer.milestones[0].id)
    }
  }, [customer, selectedMilestoneId])

  useEffect(() => {
    if (!customer || !selectedMilestoneId) return
    if (selectedFileTarget?.milestoneId === selectedMilestoneId && selectedFileTarget.noteId) return

    const milestone = customer.milestones.find((m) => m.id === selectedMilestoneId)
    if (!milestone) return

    setSelectedFileTarget({
      milestoneId: milestone.id,
      noteId: null,
      kind: 'stage',
      label: milestone.stageName,
      parentFolderId: null,
      folderPath: [],
    })
  }, [customer, selectedMilestoneId, selectedFileTarget?.milestoneId, selectedFileTarget?.noteId])

  // Load files from Cosmos DB when selected file target changes
  useEffect(() => {
    if (!selectedFileTarget) return

    const loadFiles = async () => {
      try {
        setIsLoadingFiles(true)
        const files = await fetchMilestoneFiles(selectedFileTarget)
        const key = getFileTargetKey(selectedFileTarget)
        setLibraryByTarget((prev) => ({
          ...prev,
          [key]: files,
        }))
      } catch (error) {
        const key = getFileTargetKey(selectedFileTarget)
        setLibraryByTarget((prev) => ({
          ...prev,
          [key]: [],
        }))
        console.error('Error loading files:', error)
      } finally {
        setIsLoadingFiles(false)
      }
    }

    loadFiles()
  }, [selectedFileTarget])

  const handleMilestoneExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !customer) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (rows.length === 0) return
        const today = format(new Date(), 'yyyy-MM-dd')
        const statusMap: Record<string, Milestone['status']> = {
          '대기': 'pending', '진행중': 'in-progress', '완료': 'completed', '지연': 'overdue',
        }
        const imported: EditableMilestone[] = rows.map((row) => {
          const dueDate = String(row['마감일'] || today)
          const notifyDate = String(row['알림일'] || dueDate)
          const rawStatus = String(row['상태'] || '')
          const parsedStageLevel = Number(row['단계레벨'] ?? row['레벨'] ?? row['stageLevel'] ?? 0)
          return {
            id: crypto.randomUUID(),
            stageId: crypto.randomUUID(),
            stageName: String(row['단계명'] || ''),
            stageLevel: Number.isFinite(parsedStageLevel) && parsedStageLevel >= 0
              ? Math.trunc(parsedStageLevel)
              : 0,
            role: String(row['담당자'] || ''),
            dueDate,
            notifyDate,
            status: statusMap[rawStatus] ?? 'pending',
            notes: [],
          }
        }).filter((m) => m.stageName.trim() !== '')
        if (imported.length === 0) return

        // Get current milestones in editable format for comparison
        const currentMilestones: EditableMilestone[] = isEditing
          ? editingMilestones
          : customer.milestones.map(toEditableMilestone)

        // Categorize: match by stageName (exact, trimmed)
        const toAdd: EditableMilestone[] = []
        const toUpdate: EditableMilestone[] = []
        const kept: EditableMilestone[] = []

        currentMilestones.forEach((existing) => {
          const match = imported.find((imp) => imp.stageName.trim() === existing.stageName.trim())
          if (match) {
            // Update: preserve existing id, stageId, notes to avoid data loss
            toUpdate.push({ ...match, id: existing.id, stageId: existing.stageId, notes: existing.notes })
          } else {
            kept.push(existing)
          }
        })

        imported.forEach((imp) => {
          const alreadyExists = currentMilestones.some((e) => e.stageName.trim() === imp.stageName.trim())
          if (!alreadyExists) {
            toAdd.push(imp)
          }
        })

        setExcelImportPending({ toAdd, toUpdate, kept })
        setIsExcelConfirmOpen(true)
      } catch (err) {
        console.error('Excel 파싱 오류:', err)
      } finally {
        if (milestoneExcelInputRef.current) milestoneExcelInputRef.current.value = ''
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleExcelImportConfirm = () => {
    if (!excelImportPending || !customer) return
    const { toAdd, toUpdate, kept } = excelImportPending
    const merged = [...kept, ...toUpdate, ...toAdd]
    if (!isEditing) {
      setEditedStartDate(format(customer.salesStartDate, 'yyyy-MM-dd'))
      setEditedOwner(customer.ownerName)
      setIsEditing(true)
    }
    setEditingMilestones(merged)
    setExcelImportPending(null)
    setIsExcelConfirmOpen(false)
  }

  const handleExportExcel = () => {
    if (!customer) return

    const data = customer.milestones.map((m, index) => ({
      '순서': index + 1,
      '단계명': m.stageName,
      '담당자': m.role,
      '마감일': format(m.dueDate, 'yyyy-MM-dd'),
      '알림일': format(m.notifyDate, 'yyyy-MM-dd'),
      '상태': statusLabels[m.status],
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '마일스톤')
    
    // Add customer info sheet
    const customerInfo = [
      { '항목': '고객사', '값': customer.companyName },
      { '항목': '솔루션', '값': customer.solutionName },
      { '항목': '영업 시작일', '값': format(customer.salesStartDate, 'yyyy-MM-dd') },
      { '항목': '담당자', '값': customer.ownerName },
    ]
    const ws2 = XLSX.utils.json_to_sheet(customerInfo)
    XLSX.utils.book_append_sheet(wb, ws2, '고객 정보')

    XLSX.writeFile(wb, `${customer.companyName}_로드맵.xlsx`)
  }

  const handleDelete = () => {
    deleteCustomer(id)
    router.push("/")
  }
  
  const handleSaveEdits = () => {
    if (!customer) return

    const updatedMilestones = editingMilestones.map((milestone) => ({
      ...milestone,
      dueDate: new Date(milestone.dueDate),
      notifyDate: new Date(milestone.notifyDate),
    }))
    
    updateCustomer(customer.id, {
      salesStartDate: editedStartDate ? new Date(editedStartDate) : customer.salesStartDate,
      ownerName: editedOwner,
      milestones: updatedMilestones,
      status: calculateCustomerStatus(updatedMilestones),
    })
    
    setIsEditing(false)
    // Remove edit query parameter
    router.push(`/customers/${customer.id}`)
    toast.success("변경사항이 저장되었습니다")
  }
  
  const handleCancelEdits = () => {
    if (editingMilestones.length > 0) {
      setIsCancelConfirmOpen(true)
    } else {
      setIsEditing(false)
    }
  }

  const handleCancelConfirmed = () => {
    setIsEditing(false)
    setEditingMilestones([])
    setIsCancelConfirmOpen(false)
  }

  const updateEditingMilestone = (milestoneId: string, updates: Partial<EditableMilestone>) => {
    setEditingMilestones((prev) => prev.map((milestone) => (
      milestone.id === milestoneId ? { ...milestone, ...updates } : milestone
    )))
  }

  const handleEditingMilestoneDueDateChange = (milestoneId: string, nextDueDate: string) => {
    setEditingMilestones((prev) => prev.map((milestone) => {
      if (milestone.id !== milestoneId) return milestone

      const currentDueDate = new Date(milestone.dueDate)
      const currentNotifyDate = new Date(milestone.notifyDate)
      const notifyOffsetMs = currentDueDate.getTime() - currentNotifyDate.getTime()
      const nextDueDateValue = new Date(nextDueDate)
      const nextNotifyDateValue = new Date(nextDueDateValue.getTime() - notifyOffsetMs)

      return {
        ...milestone,
        dueDate: nextDueDate,
        notifyDate: format(nextNotifyDateValue, 'yyyy-MM-dd'),
      }
    }))
  }

  const addChildMilestone = (parentMilestoneId: string) => {
    console.log('DEBUG addChildMilestone called, isEditing=', isEditing, 'parentMilestoneId=', parentMilestoneId)
    if (isEditing) {
      setEditingMilestones((prev) => {
        const parentIndex = prev.findIndex((milestone) => milestone.id === parentMilestoneId)
        if (parentIndex < 0) return prev

        const parentMilestone = prev[parentIndex]
        if ((parentMilestone.stageLevel ?? 0) >= 2) return prev

        const childMilestone: EditableMilestone = {
          ...parentMilestone,
          id: crypto.randomUUID(),
          stageId: crypto.randomUUID(),
          stageName: '',
          stageLevel: (parentMilestone.stageLevel ?? 0) + 1,
          status: 'pending',
          notes: [],
        }

        let insertIndex = parentIndex + 1
        while (insertIndex < prev.length && (prev[insertIndex].stageLevel ?? 0) > (parentMilestone.stageLevel ?? 0)) {
          insertIndex += 1
        }

        return [
          ...prev.slice(0, insertIndex),
          childMilestone,
          ...prev.slice(insertIndex),
        ]
      })
      setExpandedMilestones((prev) => new Set(prev).add(parentMilestoneId))
      return
    }

    if (!customer) { console.log('DEBUG: no customer'); return }

    const parentIndex = customer.milestones.findIndex((milestone) => milestone.id === parentMilestoneId)
    if (parentIndex < 0) { console.log('DEBUG: parentIndex < 0, parentMilestoneId=', parentMilestoneId, 'milestones=', customer.milestones.map(m => m.id)); return }

    const parentMilestone = customer.milestones[parentIndex]
    if ((parentMilestone.stageLevel ?? 0) >= 2) { console.log('DEBUG: stageLevel >= 2', parentMilestone.stageLevel); return }
    console.log('DEBUG: calling updateCustomer, parentIndex=', parentIndex, 'stageLevel=', parentMilestone.stageLevel)

    const childMilestone: Milestone = {
      ...parentMilestone,
      id: crypto.randomUUID(),
      stageId: crypto.randomUUID(),
      stageName: '새 하위 단계',
      stageLevel: (parentMilestone.stageLevel ?? 0) + 1,
      status: 'pending',
      notes: [],
    }

    let insertIndex = parentIndex + 1
    while (
      insertIndex < customer.milestones.length
      && (customer.milestones[insertIndex].stageLevel ?? 0) > (parentMilestone.stageLevel ?? 0)
    ) {
      insertIndex += 1
    }

    const nextMilestones = [
      ...customer.milestones.slice(0, insertIndex),
      childMilestone,
      ...customer.milestones.slice(insertIndex),
    ]

    updateCustomer(customer.id, {
      milestones: nextMilestones,
      status: calculateCustomerStatus(nextMilestones),
    })

    setExpandedMilestones((prev) => new Set(prev).add(parentMilestoneId))
  }

  const removeMilestoneBranch = <T extends { id: string; stageLevel: number }>(
    milestones: T[],
    milestoneId: string,
  ): { nextMilestones: T[]; removedIds: Set<string> } => {
    const targetIndex = milestones.findIndex((milestone) => milestone.id === milestoneId)
    if (targetIndex < 0) {
      return { nextMilestones: milestones, removedIds: new Set() }
    }

    const targetLevel = milestones[targetIndex].stageLevel ?? 0
    let endIndex = targetIndex + 1

    while (endIndex < milestones.length && (milestones[endIndex].stageLevel ?? 0) > targetLevel) {
      endIndex += 1
    }

    const removed = milestones.slice(targetIndex, endIndex)
    const removedIds = new Set(removed.map((milestone) => milestone.id))

    return {
      nextMilestones: [
        ...milestones.slice(0, targetIndex),
        ...milestones.slice(endIndex),
      ],
      removedIds,
    }
  }

  const handleDeleteMilestoneRow = (milestoneId: string) => {
    setDeleteMilestoneTargetId(milestoneId)
    setIsDeleteMilestoneConfirmOpen(true)
  }

  const handleDeleteMilestoneConfirmed = () => {
    const milestoneId = deleteMilestoneTargetId
    setIsDeleteMilestoneConfirmOpen(false)
    setDeleteMilestoneTargetId(null)
    if (!milestoneId) return

    if (isEditing) {
      const { nextMilestones, removedIds } = removeMilestoneBranch(editingMilestones, milestoneId)
      setEditingMilestones(nextMilestones)
      setExpandedMilestones((prev) => {
        const next = new Set(prev)
        removedIds.forEach((id) => next.delete(id))
        return next
      })
      return
    }

    if (!customer) return
    const { nextMilestones, removedIds } = removeMilestoneBranch(customer.milestones, milestoneId)

    updateCustomer(customer.id, {
      milestones: nextMilestones,
      status: calculateCustomerStatus(nextMilestones),
    })

    setExpandedMilestones((prev) => {
      const next = new Set(prev)
      removedIds.forEach((id) => next.delete(id))
      return next
    })

    if (selectedMilestoneId && removedIds.has(selectedMilestoneId)) {
      setSelectedMilestoneId(nextMilestones[0]?.id ?? null)
      setSelectedFileTarget(null)
    }
  }

  const toggleMilestoneAccordion = (milestoneId: string) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev)
      if (next.has(milestoneId)) {
        next.delete(milestoneId)
      } else {
        next.add(milestoneId)
      }
      return next
    })
  }

  const isMilestoneRowVisible = (
    milestones: Array<{ id: string; stageLevel?: number }>,
    index: number,
    expandedIds: Set<string>,
  ) => {
    const level = milestones[index].stageLevel ?? 0
    if (level === 0) return true

    let expectedAncestorLevel = level - 1
    for (let cursor = index - 1; cursor >= 0 && expectedAncestorLevel >= 0; cursor -= 1) {
      const cursorLevel = milestones[cursor].stageLevel ?? 0
      if (cursorLevel === expectedAncestorLevel) {
        if (!expandedIds.has(milestones[cursor].id)) return false
        expectedAncestorLevel -= 1
      }
    }

    return expectedAncestorLevel < 0
  }

  const openMilestoneDetail = (milestoneId: string) => {
    const milestone = customer?.milestones.find((m) => m.id === milestoneId)
    setSelectedMilestoneId(milestoneId)
    if (milestone) {
      setSelectedFileTarget({
        milestoneId,
        noteId: null,
        kind: 'stage',
        label: milestone.stageName,
        parentFolderId: null,
        folderPath: [],
      })
    }
    setActiveTab("milestone-detail")
    setExpandedMilestones((prev) => new Set(prev).add(milestoneId))
  }

  const getFileTargetKey = (target: FileLibraryTarget) => (
    [
      target.noteId ? `${target.milestoneId}::note::${target.noteId}` : `${target.milestoneId}::stage`,
      target.parentFolderId ?? 'root',
    ].join('::')
  )

  const openActionItemFileLibrary = (milestone: Milestone, note: MilestoneNote) => {
    setSelectedMilestoneId(milestone.id)
    setSelectedFileTarget({
      milestoneId: milestone.id,
      noteId: note.id,
      kind: 'action-item',
      label: note.content,
      parentFolderId: null,
      folderPath: [],
    })
    setActiveTab('milestone-detail')
    setExpandedMilestones((prev) => new Set(prev).add(milestone.id))
  }

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || ''
  }

  const isImageFile = (filename: string) => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']
    return imageExtensions.includes(getFileExtension(filename))
  }

  const isPdfFile = (filename: string) => {
    return getFileExtension(filename) === 'pdf'
  }

  const isDocxFile = (filename: string) => {
    return getFileExtension(filename) === 'docx'
  }

  const isTextFile = (filename: string) => {
    const textExtensions = ['txt', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'md', 'log']
    return textExtensions.includes(getFileExtension(filename))
  }

  const getDocxPageElements = useCallback(() => {
    const container = docxPreviewContainerRef.current
    if (!container) return [] as HTMLElement[]

    const pageSet = new Set<HTMLElement>()
    container.querySelectorAll<HTMLElement>('.docx-wrapper section.docx').forEach((el) => pageSet.add(el))
    container.querySelectorAll<HTMLElement>('.docx-wrapper .docx').forEach((el) => pageSet.add(el))

    return Array.from(pageSet)
  }, [])

  const scrollToDocxPage = useCallback((requestedPage: number) => {
    const container = docxPreviewContainerRef.current
    if (!container) return

    const pages = getDocxPageElements()
    if (pages.length === 0) return

    const clampedPage = Math.min(Math.max(requestedPage, 1), pages.length)
    setDocxViewerPage(clampedPage)

    const target = pages[clampedPage - 1]
    container.scrollTo({
      top: Math.max(target.offsetTop - 12, 0),
      behavior: 'smooth',
    })
  }, [getDocxPageElements])

  const toggleSizeSort = () => {
    setFileSortOption((prev) => (prev === 'size-desc' ? 'size-asc' : 'size-desc'))
  }

  const toggleUploadedSort = () => {
    setFileSortOption((prev) => (prev === 'uploaded-desc' ? 'uploaded-asc' : 'uploaded-desc'))
  }

  const handleViewFile = (file: MilestoneFile) => {
    if (file.isFolder) return
    setPdfViewerPage(1)
    setDocxViewerPage(1)
    setDocxViewerTotalPages(1)
    setDocxZoom(1)
    setImageLoadError(false)
    setSelectedFileForViewer(file)
  }

  useEffect(() => {
    if (!selectedFileForViewer || !isPdfFile(selectedFileForViewer.fileName)) {
      setPdfViewerSrc(null)
      return
    }

    setPdfViewerSrc(`/api/milestone-files/content?id=${encodeURIComponent(selectedFileForViewer.id)}`)
  }, [selectedFileForViewer])

  useEffect(() => {
    let isCancelled = false

    const loadDocxPreview = async () => {
      if (!selectedFileForViewer || !isDocxFile(selectedFileForViewer.fileName)) {
        setDocxPreviewError(null)
        setIsLoadingDocxPreview(false)
        if (docxPreviewContainerRef.current) {
          docxPreviewContainerRef.current.innerHTML = ''
        }
        return
      }

      setIsLoadingDocxPreview(true)
      setDocxPreviewError(null)
      if (docxPreviewContainerRef.current) {
        docxPreviewContainerRef.current.innerHTML = ''
      }

      try {
        let arrayBuffer: ArrayBuffer | null = null

        if (selectedFileForViewer.base64Content) {
          const payload = selectedFileForViewer.base64Content.includes(',')
            ? selectedFileForViewer.base64Content.split(',')[1]
            : selectedFileForViewer.base64Content

          const binary = atob(payload)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i)
          }
          arrayBuffer = bytes.buffer
        } else {
          const response = await fetch(`/api/milestone-files/content?id=${encodeURIComponent(selectedFileForViewer.id)}`)
          if (!response.ok) {
            throw new Error(`DOCX preview fetch failed: HTTP ${response.status}`)
          }
          arrayBuffer = await response.arrayBuffer()
        }

        const container = docxPreviewContainerRef.current
        if (!container) {
          return
        }
        if (isCancelled) {
          return
        }

        const { renderAsync } = await import('docx-preview')
        await renderAsync(arrayBuffer, container, undefined, {
          className: 'docx-viewer',
          inWrapper: true,
          breakPages: true,
          useBase64URL: true,
          ignoreWidth: false,
          ignoreHeight: false,
        })

        const pages = getDocxPageElements()
        const totalPages = Math.max(pages.length, 1)
        setDocxViewerTotalPages(totalPages)
        setDocxViewerPage((prev) => Math.min(Math.max(prev, 1), totalPages))
      } catch (error) {
        console.error('DOCX preview error:', error)
        if (!isCancelled) {
          setDocxPreviewError('DOCX 미리보기를 불러올 수 없습니다. 다운로드 후 확인해주세요.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingDocxPreview(false)
        }
      }
    }

    void loadDocxPreview()

    return () => {
      isCancelled = true
    }
  }, [selectedFileForViewer, docxContainerMounted, getDocxPageElements])

  useEffect(() => {
    if (!selectedFileForViewer || !isDocxFile(selectedFileForViewer.fileName)) return

    const container = docxPreviewContainerRef.current
    if (!container) return

    const wrapper = container.querySelector<HTMLElement>('.docx-wrapper')
    if (!wrapper) return

    wrapper.style.transform = `scale(${docxZoom})`
    wrapper.style.transformOrigin = 'top center'
    wrapper.style.width = `${100 / docxZoom}%`
  }, [selectedFileForViewer, docxZoom, docxContainerMounted, isLoadingDocxPreview])

  useEffect(() => {
    if (!selectedFileForViewer || !isDocxFile(selectedFileForViewer.fileName) || isLoadingDocxPreview) return

    const container = docxPreviewContainerRef.current
    if (!container) return

    const handleDocxScroll = () => {
      const pages = getDocxPageElements()
      if (pages.length === 0) return

      const currentScrollTop = container.scrollTop + 16
      let nextPage = 1
      for (let idx = 0; idx < pages.length; idx += 1) {
        if (pages[idx].offsetTop <= currentScrollTop) {
          nextPage = idx + 1
        } else {
          break
        }
      }

      setDocxViewerPage((prev) => (prev === nextPage ? prev : nextPage))
      setDocxViewerTotalPages((prev) => (prev === pages.length ? prev : pages.length))
    }

    handleDocxScroll()
    container.addEventListener('scroll', handleDocxScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleDocxScroll)
    }
  }, [selectedFileForViewer, isLoadingDocxPreview, docxContainerMounted, getDocxPageElements])

  useEffect(() => {
    let isCancelled = false

    const loadTextPreview = async () => {
      if (!selectedFileForViewer || !isTextFile(selectedFileForViewer.fileName)) {
        setTextFileContent(null)
        setTextPreviewError(null)
        setIsLoadingTextPreview(false)
        return
      }

      setIsLoadingTextPreview(true)
      setTextFileContent(null)
      setTextPreviewError(null)

      try {
        let text: string
        if (selectedFileForViewer.base64Content) {
          const payload = selectedFileForViewer.base64Content.includes(',')
            ? selectedFileForViewer.base64Content.split(',')[1]
            : selectedFileForViewer.base64Content
          text = atob(payload)
        } else {
          const response = await fetch(`/api/milestone-files/content?id=${encodeURIComponent(selectedFileForViewer.id)}`)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          text = await response.text()
        }
        if (!isCancelled) setTextFileContent(text)
      } catch (error) {
        if (!isCancelled) setTextPreviewError('텍스트 파일을 불러올 수 없습니다. 다운로드 후 확인해주세요.')
      } finally {
        if (!isCancelled) setIsLoadingTextPreview(false)
      }
    }

    void loadTextPreview()

    return () => {
      isCancelled = true
    }
  }, [selectedFileForViewer])

  const handleDownloadFile = async (file: MilestoneFile) => {
    if (file.isFolder) return

    try {
      if (file.base64Content) {
        // Convert base64 to blob
        const arr = file.base64Content.split(',')
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream'
        const bstr = atob(arr[1])
        const n = bstr.length
        const u8arr = new Uint8Array(n)
        for (let i = 0; i < n; i++) {
          u8arr[i] = bstr.charCodeAt(i)
        }
        const blob = new Blob([u8arr], { type: mime })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.fileName
        link.click()
        URL.revokeObjectURL(url)
      } else if (file.contentUrl) {
        // For files stored in blob storage
        window.open(file.contentUrl, '_blank')
      }
    } catch (error) {
      console.error('Error downloading file:', error)
      toast.error('파일 다운로드 중 오류가 발생했습니다.')
    }
  }

  const fetchMilestoneFiles = async (target: FileLibraryTarget): Promise<MilestoneFile[]> => {
    const params = new URLSearchParams({
      milestoneId: target.milestoneId,
      ...(target.noteId && { noteId: target.noteId }),
      ...(target.parentFolderId && { parentFolderId: target.parentFolderId }),
    })

    const response = await fetch(`/api/milestone-files?${params}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || `HTTP ${response.status}`

      // If session is missing/expired, keep the UI stable with an empty list.
      if (response.status === 401) {
        console.warn('파일 조회 권한이 없어 빈 목록으로 표시합니다.')
        return []
      }

      throw new Error(`파일 로드 실패: ${errorMessage}`)
    }

    return response.json()
  }

  const reloadFilesForTarget = async (target: FileLibraryTarget) => {
    const updatedFiles = await fetchMilestoneFiles(target)
    const key = getFileTargetKey(target)
    setLibraryByTarget((prev) => ({
      ...prev,
      [key]: updatedFiles,
    }))
  }

  const handleFileUpload = async (target: FileLibraryTarget, files: FileList | null) => {
    if (!files || files.length === 0) return
    
    try {
      setIsLoadingFiles(true)
      const fileList = Array.from(files)
      const targetKey = getFileTargetKey(target)
      setUploadProgress({
        targetKey,
        total: fileList.length,
        completed: 0,
        currentFileName: fileList[0]?.name ?? '',
      })
      
      for (let index = 0; index < fileList.length; index += 1) {
        const file = fileList[index]
        setUploadProgress((prev) =>
          prev
            ? {
                ...prev,
                currentFileName: file.name,
              }
            : prev
        )

        // Cosmos DB has a 2MB per-document limit. Base64 encoding inflates size by ~33%,
        // so files larger than ~1MB would exceed the limit. Route those through the
        // chunked upload API (SharePoint) which stores only a URL in Cosmos.
        const LARGE_FILE_THRESHOLD = 1 * 1024 * 1024 // 1MB

        if (file.size > LARGE_FILE_THRESHOLD) {
          // Large file: multipart upload → SharePoint → stores contentUrl in Cosmos
          const formData = new FormData()
          formData.append('file', file)
          formData.append('milestoneId', target.milestoneId)
          if (target.noteId) formData.append('noteId', target.noteId)
          formData.append('kind', target.kind)
          formData.append('parentFolderId', target.parentFolderId ?? '')
          formData.append('folderPath', JSON.stringify(target.folderPath))

          const response = await fetch('/api/milestone-files/upload', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || `HTTP ${response.status}`
            throw new Error(`파일 업로드 실패: ${errorMessage}`)
          }

          setUploadProgress((prev) =>
            prev
              ? {
                  ...prev,
                  completed: index + 1,
                }
              : prev
          )
          continue
        }

        let base64Content: string | undefined
        try {
          const reader = new FileReader()
          base64Content = await new Promise<string>((resolve, reject) => {
            const onloadHandler = () => {
              if (reader.result) {
                resolve(reader.result as string)
              } else {
                reject(new Error('FileReader result is empty'))
              }
            }
            const onerrorHandler = () => {
              reject(new Error(`FileReader error: ${reader.error?.message || 'Unknown error'}`))
            }
            reader.onload = onloadHandler
            reader.onerror = onerrorHandler
            reader.onabort = () => reject(new Error('FileReader aborted'))
            reader.readAsDataURL(file)
          })
        } catch (readerError) {
          console.error('FileReader error:', readerError)
          throw readerError
        }
        
        const uploadPayload = {
          milestoneId: target.milestoneId,
          noteId: target.noteId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          isFolder: false,
          base64Content: base64Content,
          kind: target.kind,
          parentFolderId: target.parentFolderId,
          folderPath: target.folderPath,
        }
        
        const response = await fetch('/api/milestone-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(uploadPayload),
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.error || `HTTP ${response.status}`
          throw new Error(`파일 업로드 실패: ${errorMessage}`)
        }

        setUploadProgress((prev) =>
          prev
            ? {
                ...prev,
                completed: index + 1,
              }
            : prev
        )
      }

      await reloadFilesForTarget(target)
      toast.success('파일이 성공적으로 업로드되었습니다.')
    } catch (error) {
      console.error('Error uploading file:', error)
      const errorMessage = error instanceof Error ? error.message : '파일 업로드 중 오류가 발생했습니다.'
      toast.error(errorMessage)
    } finally {
      setIsLoadingFiles(false)
      setUploadProgress(null)
    }
  }

  const handleCreateFolder = (target: FileLibraryTarget) => {
    setFolderTarget(target)
    setFolderNameDraft('')
    setIsCreateFolderDialogOpen(true)
  }

  const handleCreateFolderConfirm = async () => {
    if (!folderTarget) return

    const folderName = folderNameDraft.trim()
    if (!folderName) return

    try {
      setIsLoadingFiles(true)

      const response = await fetch('/api/milestone-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestoneId: folderTarget.milestoneId,
          noteId: folderTarget.noteId,
          fileName: folderName,
          fileSize: 0,
          fileType: 'application/x-folder',
          isFolder: true,
          kind: folderTarget.kind,
          parentFolderId: folderTarget.parentFolderId,
          folderPath: folderTarget.folderPath,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}`
        throw new Error(`폴더 생성 실패: ${errorMessage}`)
      }

      await reloadFilesForTarget(folderTarget)
      setIsCreateFolderDialogOpen(false)
      setFolderNameDraft('')
      setFolderTarget(null)
    } catch (error) {
      console.error('Error creating folder:', error)
      const errorMessage = error instanceof Error ? error.message : '폴더 생성 중 오류가 발생했습니다.'
      toast.error(errorMessage)
    } finally {
      setIsLoadingFiles(false)
    }
  }

  const handleMoveFile = async (fileId: string, sourceKey: string, targetMilestone: Milestone) => {
    try {
      setIsLoadingFiles(true)
      const response = await fetch('/api/milestone-files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fileId,
          milestoneId: targetMilestone.id,
          noteId: null,
          kind: 'stage',
          parentFolderId: null,
          folderPath: [],
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '파일 이동 실패')
      }
      // Remove from source
      setLibraryByTarget((prev) => ({
        ...prev,
        [sourceKey]: (prev[sourceKey] ?? []).filter((f) => f.id !== fileId),
      }))
      // Reload target
      const targetFileTarget: FileLibraryTarget = {
        milestoneId: targetMilestone.id,
        noteId: null,
        kind: 'stage',
        label: targetMilestone.stageName,
        parentFolderId: null,
        folderPath: [],
      }
      await reloadFilesForTarget(targetFileTarget)
    } catch (error) {
      console.error('Error moving file:', error)
      toast.error('파일 이동 중 오류가 발생했습니다.')
    } finally {
      if (isMountedRef.current) setIsLoadingFiles(false)
    }
  }

  const handleRemoveFile = async (target: FileLibraryTarget, fileId: string) => {
    setDeleteFileTarget({ target, fileId })
    setIsDeleteFileConfirmOpen(true)
  }

  const handleRemoveFileConfirmed = async () => {
    if (!deleteFileTarget) return
    const { target, fileId } = deleteFileTarget
    setIsDeleteFileConfirmOpen(false)
    setDeleteFileTarget(null)
    
    try {
      setIsLoadingFiles(true)
      const response = await fetch(`/api/milestone-files?id=${fileId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) throw new Error('Failed to delete file')
      
      const key = getFileTargetKey(target)
      if (isMountedRef.current) {
        setLibraryByTarget((prev) => ({
          ...prev,
          [key]: (prev[key] ?? []).filter((item) => item.id !== fileId),
        }))
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      toast.error('파일 삭제 중 오류가 발생했습니다.')
    } finally {
      if (isMountedRef.current) {
        setIsLoadingFiles(false)
      }
    }
  }

  const getDefaultNoteMeta = (milestone: Milestone) => ({
    ownerName: customer!.ownerName,
    dueDate: format(milestone.dueDate, 'yyyy-MM-dd'),
    notifyDate: format(milestone.notifyDate, 'yyyy-MM-dd'),
    status: milestone.status,
  })

  const ensureNoteMetaDraft = (draftKey: string, milestone: Milestone) => {
    setNoteMetaDrafts((prev) => (
      prev[draftKey]
        ? prev
        : { ...prev, [draftKey]: getDefaultNoteMeta(milestone) }
    ))
  }

  const startNoteEdit = (milestoneId: string) => {
    const milestone = customer?.milestones.find((m) => m.id === milestoneId)
    if (milestone) {
      ensureNoteMetaDraft(getDraftKey(milestoneId), milestone)
    }
    setExpandedMilestones((prev) => new Set(prev).add(milestoneId))
    setNoteEditTarget(milestoneId)
  }

  const cancelNoteEdit = (milestoneId: string) => {
    setNoteDrafts((prev) => ({ ...prev, [milestoneId]: '' }))
    setNoteMetaDrafts((prev) => {
      const next = { ...prev }
      delete next[milestoneId]
      return next
    })
    if (noteEditTarget === milestoneId) {
      setNoteEditTarget(null)
    }
  }

  const getDraftKey = (milestoneId: string, parentNoteId?: string | null) => (
    parentNoteId ? `${milestoneId}:${parentNoteId}` : milestoneId
  )

  const getEditDraftKey = (milestoneId: string, noteId: string) => `edit:${milestoneId}:${noteId}`

  const getChildren = (notes: MilestoneNote[], parentNoteId: string | null) => {
    return notes.filter((note) => (note.parentNoteId ?? null) === parentNoteId)
  }

  const openReplyEditor = (milestoneId: string, parentNoteId: string) => {
    const milestone = customer?.milestones.find((m) => m.id === milestoneId)
    if (milestone) {
      ensureNoteMetaDraft(getDraftKey(milestoneId, parentNoteId), milestone)
    }
    setReplyTarget({ milestoneId, parentNoteId })
    setExpandedMilestones((prev) => new Set(prev).add(milestoneId))
  }

  const startExistingNoteEdit = (milestoneId: string, note: MilestoneNote) => {
    const draftKey = getEditDraftKey(milestoneId, note.id)
    setExpandedMilestones((prev) => new Set(prev).add(milestoneId))
    setEditingExistingNote({ milestoneId, noteId: note.id })
    setNoteDrafts((prev) => ({ ...prev, [draftKey]: note.content }))
  }

  const cancelExistingNoteEdit = (milestoneId: string, noteId: string) => {
    const draftKey = getEditDraftKey(milestoneId, noteId)
    setNoteDrafts((prev) => ({ ...prev, [draftKey]: '' }))
    if (editingExistingNote?.milestoneId === milestoneId && editingExistingNote?.noteId === noteId) {
      setEditingExistingNote(null)
    }
  }

  const cancelReplyEdit = (milestoneId: string, parentNoteId: string) => {
    const draftKey = getDraftKey(milestoneId, parentNoteId)
    setNoteDrafts((prev) => ({ ...prev, [draftKey]: '' }))
    setNoteMetaDrafts((prev) => {
      const next = { ...prev }
      delete next[draftKey]
      return next
    })
    if (replyTarget?.milestoneId === milestoneId && replyTarget.parentNoteId === parentNoteId) {
      setReplyTarget(null)
    }
  }

  const saveMilestoneNote = (milestone: Milestone, parentNoteId?: string | null) => {
    if (!customer) return
    const draftKey = getDraftKey(milestone.id, parentNoteId)
    const content = (noteDrafts[draftKey] || '').trim()
    if (!content) return
    const metaDraft = noteMetaDrafts[draftKey] ?? getDefaultNoteMeta(milestone)

    const currentNotes = milestone.notes ?? []
    const newNote: MilestoneNote = {
      id: Math.random().toString(36).substring(2, 15),
      content,
      createdAt: new Date(),
      parentNoteId: parentNoteId ?? null,
      ownerName: metaDraft.ownerName,
      dueDate: new Date(metaDraft.dueDate),
      notifyDate: new Date(metaDraft.notifyDate),
      status: metaDraft.status,
    }

    updateMilestone(customer.id, milestone.id, {
      notes: [...currentNotes, newNote],
    })

    setNoteDrafts((prev) => ({ ...prev, [draftKey]: '' }))
    setNoteMetaDrafts((prev) => {
      const next = { ...prev }
      delete next[draftKey]
      return next
    })
    if (parentNoteId) {
      setReplyTarget(null)
    } else {
      setNoteEditTarget(null)
    }
  }

  const updateNoteMeta = (milestone: Milestone, noteId: string, updates: Partial<MilestoneNote>) => {
    if (!customer) return
    const currentNotes = milestone.notes ?? []
    updateMilestone(customer.id, milestone.id, {
      notes: currentNotes.map((note) =>
        note.id === noteId ? { ...note, ...updates } : note
      ),
    })
  }

  const saveEditedNote = (milestone: Milestone, noteId: string) => {
    if (!customer) return
    const draftKey = getEditDraftKey(milestone.id, noteId)
    const content = (noteDrafts[draftKey] || '').trim()
    if (!content) return

    const currentNotes = milestone.notes ?? []
    updateMilestone(customer.id, milestone.id, {
      notes: currentNotes.map((note) =>
        note.id === noteId ? { ...note, content } : note
      ),
    })

    setEditingExistingNote(null)
    setNoteDrafts((prev) => ({ ...prev, [draftKey]: '' }))
  }

  const getDescendantIds = (notes: MilestoneNote[], parentId: string): string[] => {
    const children = notes.filter((note) => (note.parentNoteId ?? null) === parentId)
    const directIds = children.map((child) => child.id)
    return [...directIds, ...directIds.flatMap((id) => getDescendantIds(notes, id))]
  }

  const deleteNote = (milestone: Milestone, noteId: string) => {
    if (!customer) return
    setDeleteNoteTarget({ milestone, noteId })
    setIsDeleteNoteConfirmOpen(true)
  }

  const deleteNoteConfirmed = () => {
    if (!deleteNoteTarget || !customer) return
    const { milestone, noteId } = deleteNoteTarget
    setIsDeleteNoteConfirmOpen(false)
    setDeleteNoteTarget(null)
    const currentNotes = milestone.notes ?? []
    const targetIds = new Set([noteId, ...getDescendantIds(currentNotes, noteId)])

    updateMilestone(customer.id, milestone.id, {
      notes: currentNotes.filter((note) => !targetIds.has(note.id)),
    })

    if (editingExistingNote?.milestoneId === milestone.id && targetIds.has(editingExistingNote.noteId)) {
      setEditingExistingNote(null)
    }
    if (replyTarget?.milestoneId === milestone.id && targetIds.has(replyTarget.parentNoteId)) {
      setReplyTarget(null)
    }
    setCollapsedNoteChildren((prev) => {
      const next = new Set(prev)
      targetIds.forEach((id) => next.delete(id))
      return next
    })
  }

  const toggleNoteChildrenAccordion = (noteId: string) => {
    setCollapsedNoteChildren((prev) => {
      const next = new Set(prev)
      if (next.has(noteId)) {
        next.delete(noteId)
      } else {
        next.add(noteId)
      }
      return next
    })
  }

  const renderNotesTree = (
    milestone: Milestone,
    allNotes: MilestoneNote[],
    parentNoteId: string | null,
    depth: number,
    parentLabel: string = ''
  ): React.ReactNode => {
    const childNotes = getChildren(allNotes, parentNoteId)
    if (childNotes.length === 0) return null

    return childNotes.map((note, idx) => {
      const currentLabel = parentLabel ? `${parentLabel}-${idx + 1}` : `${idx + 1}`
      const draftKey = getDraftKey(milestone.id, note.id)
      const editDraftKey = getEditDraftKey(milestone.id, note.id)
      const isReplyEditing = replyTarget?.milestoneId === milestone.id && replyTarget.parentNoteId === note.id
      const isEditingThisNote = editingExistingNote?.milestoneId === milestone.id && editingExistingNote?.noteId === note.id
      const childrenCount = getChildren(allNotes, note.id).length
      const hasChildren = childrenCount > 0
      const isCollapsed = collapsedNoteChildren.has(note.id)
      const backgroundLightness = Math.max(96 - (depth * 2), 84)

      return (
        <div key={note.id} className="space-y-2" style={{ marginLeft: `${depth * 20}px` }}>
          <div
            className="group rounded-md border border-border bg-[var(--note-bg)] p-3 dark:bg-[#1E1E1E] dark:border-[#333333]"
            style={{ ['--note-bg' as string]: `hsl(215 20% ${backgroundLightness}%)` } as React.CSSProperties}
          >
            {!isEditingThisNote ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p
                    className="text-sm whitespace-pre-wrap break-words flex cursor-pointer items-start gap-2"
                    onClick={() => openActionItemFileLibrary(milestone, note)}
                  >
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border px-1 font-mono text-xs whitespace-nowrap">
                      {currentLabel}
                    </span>
                    <span>{note.content}</span>
                  </p>
                  {hasChildren && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => toggleNoteChildrenAccordion(note.id)}
                    >
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(note.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => openReplyEditor(milestone.id, note.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startExistingNoteEdit(milestone.id, note)}>
                          수정
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteNote(milestone, note.id)}>
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">담당자</p>
                    <Select
                      value={note.ownerName ?? customer!.ownerName}
                      onValueChange={(value) => updateNoteMeta(milestone, note.id, { ownerName: value })}
                    >
                      <SelectTrigger className="h-8 text-sm dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]">
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.displayName} className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">
                            {user.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">마감일</p>
                    <Input
                      type="date"
                      value={format(note.dueDate ? new Date(note.dueDate) : milestone.dueDate, 'yyyy-MM-dd')}
                      onChange={(e) => updateNoteMeta(milestone, note.id, { dueDate: new Date(e.target.value) })}
                      className="h-8 text-sm bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">알림일</p>
                    <Input
                      type="date"
                      value={format(note.notifyDate ? new Date(note.notifyDate) : milestone.notifyDate, 'yyyy-MM-dd')}
                      onChange={(e) => updateNoteMeta(milestone, note.id, { notifyDate: new Date(e.target.value) })}
                      className="h-8 text-sm bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">상태</p>
                    <Select
                      value={note.status ?? milestone.status}
                      onValueChange={(value) => updateNoteMeta(milestone, note.id, { status: value as Milestone['status'] })}
                    >
                      <SelectTrigger className="h-8 text-sm dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]">
                        <SelectItem value="pending" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">대기</SelectItem>
                        <SelectItem value="in-progress" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">진행중</SelectItem>
                        <SelectItem value="completed" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">완료</SelectItem>
                        <SelectItem value="overdue" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">지연</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={noteDrafts[editDraftKey] || ''}
                  onChange={(e) => setNoteDrafts((prev) => ({
                    ...prev,
                    [editDraftKey]: e.target.value,
                  }))}
                  className="min-h-[88px]"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cancelExistingNoteEdit(milestone.id, note.id)}
                  >
                    취소
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => saveEditedNote(milestone, note.id)}
                    disabled={!(noteDrafts[editDraftKey] || '').trim()}
                  >
                    저장
                  </Button>
                </div>
              </div>
            )}
          </div>

          {isReplyEditing && (
            <div className="space-y-2 rounded-md border border-[#dbe3ee] bg-white/85 p-3 shadow-sm dark:bg-[#1E1E1E] dark:border-[#333333]" style={{ marginLeft: '20px' }}>
              <Textarea
                value={noteDrafts[draftKey] || ''}
                onChange={(e) => setNoteDrafts((prev) => ({
                  ...prev,
                  [draftKey]: e.target.value,
                }))}
                placeholder="답신 메모를 입력하세요."
                className="min-h-[88px]"
              />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">담당자</p>
                  <Select
                    value={noteMetaDrafts[draftKey]?.ownerName ?? customer!.ownerName}
                    onValueChange={(value) => setNoteMetaDrafts((prev) => ({
                      ...prev,
                      [draftKey]: {
                        ...(prev[draftKey] ?? getDefaultNoteMeta(milestone)),
                        ownerName: value,
                      },
                    }))}
                  >
                    <SelectTrigger className="h-8 text-sm dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]">
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.displayName} className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">
                          {user.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">마감일</p>
                  <Input
                    type="date"
                    value={noteMetaDrafts[draftKey]?.dueDate ?? format(milestone.dueDate, 'yyyy-MM-dd')}
                    onChange={(e) => setNoteMetaDrafts((prev) => ({
                      ...prev,
                      [draftKey]: {
                        ...(prev[draftKey] ?? getDefaultNoteMeta(milestone)),
                        dueDate: e.target.value,
                      },
                    }))}
                    className="h-8 text-sm bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">알림일</p>
                  <Input
                    type="date"
                    value={noteMetaDrafts[draftKey]?.notifyDate ?? format(milestone.notifyDate, 'yyyy-MM-dd')}
                    onChange={(e) => setNoteMetaDrafts((prev) => ({
                      ...prev,
                      [draftKey]: {
                        ...(prev[draftKey] ?? getDefaultNoteMeta(milestone)),
                        notifyDate: e.target.value,
                      },
                    }))}
                    className="h-8 text-sm bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">상태</p>
                  <Select
                    value={noteMetaDrafts[draftKey]?.status ?? milestone.status}
                    onValueChange={(value) => setNoteMetaDrafts((prev) => ({
                      ...prev,
                      [draftKey]: {
                        ...(prev[draftKey] ?? getDefaultNoteMeta(milestone)),
                        status: value as Milestone['status'],
                      },
                    }))}
                  >
                    <SelectTrigger className="h-8 text-sm dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]">
                      <SelectItem value="pending" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">대기</SelectItem>
                      <SelectItem value="in-progress" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">진행중</SelectItem>
                      <SelectItem value="completed" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">완료</SelectItem>
                      <SelectItem value="overdue" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">지연</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cancelReplyEdit(milestone.id, note.id)}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveMilestoneNote(milestone, note.id)}
                  disabled={!(noteDrafts[draftKey] || '').trim()}
                >
                  완료
                </Button>
              </div>
            </div>
          )}

          {!isCollapsed && renderNotesTree(milestone, allNotes, note.id, depth + 1, currentLabel)}
        </div>
      )
    })
  }

  if (!customer) {
    return (
      <>
        <Navigation />
        <SidebarInset>
          <header className="sticky top-0 z-40 border-b border-border bg-background/95">
            <div className="flex h-14 items-center gap-4 px-4">
              {/* empty header to match layout */}
            </div>
          </header>
          <main className="flex-1 px-6 py-6 lg:px-10">
            <div className="text-center py-12">
              <p className="text-muted-foreground">고객을 찾을 수 없습니다.</p>
            </div>
          </main>
        </SidebarInset>
      </>
    )
  }

  const customerStatusLabels: Record<Customer['status'], string> = {
    active: '진행중',
    completed: '완료',
    'at-risk': '위험',
  }

  const customerStatusStyles: Record<Customer['status'], string> = {
    active: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-[#ffb783]/10 dark:text-[#ffb783] dark:border-[#ffb783]/30',
    completed: 'bg-lime-100 text-lime-700 border-lime-200 dark:bg-[#22c55e]/10 dark:text-[#22c55e] dark:border-[#22c55e]/30',
    'at-risk': 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-[#ffb4ab]/10 dark:text-[#ffb4ab] dark:border-[#ffb4ab]/30',
  }

  const progress = {
    completed: customer.milestones.filter(m => m.status === 'completed').length,
    total: customer.milestones.length,
  }

  // 계층 단계 번호 생성 (1 / 1-1 / 1-1-1)
  const getStageLabel = (milestones: Array<{ stageLevel: number }>, idx: number): string => {
    const level = milestones[idx].stageLevel ?? 0
    let l0 = 0, l1 = 0, l2 = 0
    for (let i = 0; i <= idx; i++) {
      const l = milestones[i].stageLevel ?? 0
      if (l === 0) { l0++; l1 = 0; l2 = 0 }
      else if (l === 1) { l1++; l2 = 0 }
      else if (l === 2) { l2++ }
    }
    if (level === 0) return `${l0}`
    if (level === 1) return `${l0}-${l1}`
    return `${l0}-${l1}-${l2}`
  }


  // 공유 대상 상세 정보 및 역할 매핑
  // Assume roles are stored in customer.sharedUserRoles / sharedGroupRoles as { [id]: 'user' | 'admin' }, fallback to 'user' if not present
  const sharedUserItems = (customer?.sharedUserIds || [])
    .map(uid => {
      const user = users.find(u => u.id === uid)
      return user
        ? {
            id: user.id,
            displayName: user.displayName,
            type: 'user' as const,
            role: 'user' as const,
          }
        : undefined
    })
    .filter((x): x is { id: string; displayName: string; type: 'user'; role: 'user' } => !!x)
  const sharedGroupItems = (customer?.sharedGroupIds || [])
    .map(gid => {
      const group = groups.find(g => g.id === gid)
      return group
        ? {
            id: group.id,
            displayName: (group.name || '그룹'),
            type: 'group' as const,
            role: 'user' as const,
          }
        : undefined
    })
    .filter((x): x is { id: string; displayName: string; type: 'group'; role: 'user' } => !!x)
  const sharedItems = [...sharedUserItems, ...sharedGroupItems]

  return (
    <>
      <Navigation />
      <SidebarInset>
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/98 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-14 items-center gap-3 px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="h-5 w-px bg-border/70" />
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              <Link href="/customers" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">고객 관리</Link>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <span className="font-medium text-foreground truncate">{customer?.companyName ?? '고객 상세'}</span>
            </div>
          </div>
        </header>
        <main className="app-surface flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-12">
          <div className="w-full space-y-6 animate-page-in">
            <div className="rounded-2xl border border-[#dbe3ee] bg-white/88 px-4 py-5 shadow-[0_20px_48px_-36px_rgba(37,22,120,0.35)] sm:px-6 sm:py-6 dark:border-white/10 dark:bg-[#1E1E1E]/60">
              <span className="menu-kicker">Customer Detail</span>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight text-[#1e1b4b] dark:text-[#e5e2e1]">{customer.companyName}</h1>
                    <Badge variant="outline" className={customerStatusStyles[customer.status]}>
                      {customerStatusLabels[customer.status]}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm text-[#5b5785] dark:text-[#908fa0]">{customer.solutionName}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="rounded-full border border-[#d3cef0] bg-white/90 px-2.5 py-1 text-[#5b5785] dark:border-white/10 dark:bg-white/5 dark:text-[#c7c4d7]">
                      진행률 {progress.completed}/{progress.total}
                    </span>
                    <span className="rounded-full border border-[#d3cef0] bg-white/90 px-2.5 py-1 text-[#5b5785] dark:border-white/10 dark:bg-white/5 dark:text-[#c7c4d7]">
                      공유 {sharedItems.length}명/그룹
                    </span>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  {!isEditing && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="w-full border-[#d3cef0] bg-white/90 text-[#4b4678] hover:bg-[#f4f1ff] sm:w-auto">
                      <Edit2 className="mr-2 h-4 w-4" />
                      수정
                    </Button>
                  )}
                  {isEditing && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleSaveEdits} className="w-full border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 sm:w-auto">
                        <Check className="mr-2 h-4 w-4" />
                        저장
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCancelEdits} className="w-full border-[#d3cef0] bg-white/90 text-[#4b4678] hover:bg-[#f4f1ff] sm:w-auto">
                        <X className="mr-2 h-4 w-4" />
                        취소
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={handleExportExcel} className="w-full border-[#d3cef0] bg-white/90 text-[#4b4678] hover:bg-[#f4f1ff] sm:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Excel 내보내기
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full border-rose-200 bg-rose-50/85 text-rose-700 hover:bg-rose-100 hover:text-rose-700 sm:w-auto" disabled={isEditing}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        삭제
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>고객 삭제</AlertDialogTitle>
                        <AlertDialogDescription>
                          정말로 &quot;{customer.companyName}&quot;을(를) 삭제하시겠습니까?
                          모든 마일스톤 데이터가 함께 삭제됩니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          삭제
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>

            <Accordion type="single" collapsible value={customerSummaryOpen} onValueChange={setCustomerSummaryOpen} className="rounded-2xl border border-[#dbe3ee] bg-white/92 px-4 shadow-[0_20px_48px_-36px_rgba(37,22,120,0.32)] dark:border-[#333333] dark:bg-[#1E1E1E]/60">
              <AccordionItem value="customer-summary" className="border-b-0">
                <AccordionTrigger className="py-3 text-sm dark:text-[#e5e2e1]">고객 정보</AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    {/* 기존 카드들 */}
                    <Card className="bg-white border-[#dbd6f0] shadow-sm dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)] h-24 flex items-center py-0">
                      <CardContent className="h-full flex items-center gap-3 w-full px-4">
                        <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">영업 시작일</p>
                          {!isEditing ? (
                            <p className="font-medium text-sm">
                              {format(customer.salesStartDate, 'yyyy.MM.dd', { locale: ko })}
                            </p>
                          ) : (
                            <Input
                              type="date"
                              value={editedStartDate}
                              onChange={(e) => setEditedStartDate(e.target.value)}
                              className="h-8 text-sm"
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-white border-[#dbd6f0] shadow-sm dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)] h-24 flex items-center py-0">
                      <CardContent className="h-full flex items-center gap-3 w-full px-4">
                        <div className="rounded-lg bg-chart-2/10 p-2 flex-shrink-0">
                          <Building2 className="h-4 w-4 text-chart-2" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">담당자</p>
                          {!isEditing ? (
                            <p className="font-medium text-sm truncate">{customer.ownerName}</p>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-sm w-full justify-start font-normal dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]"
                              onClick={() => setIsOwnerPickerOpen(true)}
                            >
                              {editedOwner || "담당자 선택"}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-white border-[#dbd6f0] shadow-sm dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)] h-24 flex items-center py-0">
                      <CardContent className="h-full flex items-center gap-3 w-full px-4">
                        <div className="rounded-lg bg-chart-1/10 p-2 flex-shrink-0">
                          <CheckCircle2 className="h-4 w-4 text-chart-1" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">진행률</p>
                          <p className="font-medium text-sm">
                            {progress.completed}/{progress.total} 완료 ({progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100)}%)
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* 공유 대상 카드 - 사용자/그룹별 카드 UI 및 역할 드롭다운 */}
                    <Card className="bg-white border-[#dbd6f0] shadow-sm dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)] min-h-24 flex items-center py-0">
                      <CardContent className="h-full w-full px-4 py-3">
                        <p className="text-xs text-muted-foreground mb-2">공유 대상</p>
                        <div className="flex flex-wrap gap-2">
                          {sharedItems.length === 0 && (
                            <span className="text-sm text-muted-foreground">없음</span>
                          )}
                          {sharedItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 p-2 rounded-lg border dark:border-[#464554] dark:bg-[#1c1b1b] bg-white"
                              style={{ minWidth: 180 }}
                            >
                              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/20 dark:bg-[#353534]">
                                {item.type === 'group' ? (
                                  <Users className="h-4 w-4 text-primary dark:text-[#c0c1ff]" />
                                ) : (
                                  <span className="text-xs font-bold text-primary dark:text-[#c0c1ff]">{item.displayName.slice(0, 2)}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate dark:text-[#e5e2e1]">{item.displayName}</p>
                                <Badge variant="outline" className="text-xs py-0 mt-0.5 dark:border-[#464554] dark:text-[#c7c4d7]">
                                  {item.type === 'group' ? '그룹' : '사용자'}
                                </Badge>
                              </div>
                              <Select
                                value={item.role}
                                disabled
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
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-[#f3f1ff] border border-[#dbd6f0] p-1 shadow-sm dark:bg-[#1c1b1b] dark:border-[#333333]">
                <TabsTrigger value="table" className="rounded-md px-4 text-[#6360a0] transition-all data-[state=active]:bg-white data-[state=active]:text-[#1e1b4b] data-[state=active]:shadow-sm dark:text-[#c7c4d7] dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-indigo-400 dark:data-[state=active]:border-b-2 dark:data-[state=active]:border-indigo-500">마일스톤 테이블</TabsTrigger>
                <TabsTrigger value="milestone-detail" className="rounded-md px-4 text-[#6360a0] transition-all data-[state=active]:bg-white data-[state=active]:text-[#1e1b4b] data-[state=active]:shadow-sm dark:text-[#c7c4d7] dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-indigo-400 dark:data-[state=active]:border-b-2 dark:data-[state=active]:border-indigo-500">파일 라이브러리</TabsTrigger>
                <TabsTrigger value="gantt" className="rounded-md px-4 text-[#6360a0] transition-all data-[state=active]:bg-white data-[state=active]:text-[#1e1b4b] data-[state=active]:shadow-sm dark:text-[#c7c4d7] dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-indigo-400 dark:data-[state=active]:border-b-2 dark:data-[state=active]:border-indigo-500">간이 WBS</TabsTrigger>
              </TabsList>
              
              <TabsContent value="table">
                <Card className="bg-white/95 border border-[#dbd6f0] shadow-lg rounded-xl dark:bg-[#171616] dark:border-[#333333]">
                  <CardHeader className="flex flex-col sm:flex-row items-start justify-between gap-4 px-4 sm:px-6 pt-[10px] pb-2 border-b border-[#ece8fa] dark:border-[#333333]">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-lg font-bold tracking-tight text-[#1e1b4b] dark:text-[#e5e2e1]">마일스톤 목록</CardTitle>
                      <CardDescription className="text-xs text-[#6360a0] dark:text-[#908fa0] mt-1">각 단계의 진행 상태를 관리합니다.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="self-start border-[#dbd6f0] bg-[#f3f1ff] text-[#1e1b4b] hover:bg-[#e9e6fa] dark:bg-[#23213a] dark:border-[#333333] dark:text-[#e5e2e1]" onClick={() => milestoneExcelInputRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" />
                      Excel 가져오기
                    </Button>
                    <input
                      ref={milestoneExcelInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleMilestoneExcelUpload}
                    />
                  </CardHeader>
                  <CardContent>
                    {/* 모바일 카드 목록 (md 미만) */}
                    <div className="md:hidden space-y-2">
                      {displayedMilestones.map((milestone, index) => {
                        const isVisible = isMilestoneRowVisible(displayedMilestones, index, expandedMilestones)
                        if (!isVisible) return null
                        return (
                          <div
                            key={milestone.id}
                            className="rounded-lg border border-[#dbd6f0] bg-[#f3f1ff] p-3 space-y-2 dark:bg-[#23213a] dark:border-[#333333]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="outline" className="font-mono text-xs whitespace-nowrap">{getStageLabel(displayedMilestones, index)}</Badge>
                              <Badge className={`text-xs border ${statusStyles[milestone.status]}`}>{statusLabels[milestone.status]}</Badge>
                            </div>
                            <p className="font-medium text-sm" style={{ paddingLeft: `${(milestone.stageLevel ?? 0) * 12}px` }}>{milestone.stageName}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span>담당자: {milestone.role}</span>
                              <span>마감일: {format(milestone.dueDate, 'yyyy.MM.dd', { locale: ko })}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* 데스크탑 테이블 (md 이상) */}
                    <div className="hidden md:block rounded-lg border border-[#dbd6f0] bg-[#f3f1ff] overflow-hidden dark:border-[#333333] dark:bg-[#23213a]">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[#ece8fa] hover:bg-[#ece8fa] dark:bg-[#23213a] dark:hover:bg-[#23213a]">
                            <TableHead className="w-16 text-muted-foreground dark:text-[#908fa0] dark:uppercase dark:tracking-wider">단계</TableHead>
                            <TableHead className="text-muted-foreground dark:text-[#908fa0] dark:uppercase dark:tracking-wider">단계명</TableHead>
                            <TableHead className="text-muted-foreground dark:text-[#908fa0] dark:uppercase dark:tracking-wider">담당자</TableHead>
                            <TableHead className="text-muted-foreground dark:text-[#908fa0] dark:uppercase dark:tracking-wider">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1 cursor-default">
                                      마감일
                                      <Info className="h-3.5 w-3.5 text-muted-foreground/70" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <p>마감일 1일 전에 Outlook으로 리마인드해드립니다.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableHead>
                            <TableHead className="text-muted-foreground dark:text-[#908fa0] dark:uppercase dark:tracking-wider w-32">상태</TableHead>
                            <TableHead className="text-muted-foreground dark:text-[#908fa0] w-14 text-right">액션 아이템</TableHead>
                            <TableHead className="text-muted-foreground dark:text-[#908fa0] w-14 text-right"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedMilestones.map((milestone, index) => {
                            const isVisible = isMilestoneRowVisible(displayedMilestones, index, expandedMilestones)
                            if (!isVisible) return null

                            const sourceMilestone = customer.milestones.find((item) => item.id === milestone.id)

                            return (
                            <Fragment key={milestone.id}>
                            <TableRow className="bg-white/95 hover:bg-[#ece8fa] dark:bg-[#23213a] dark:hover:bg-[#323232] h-14">
                              <TableCell className="py-3">
                                <Badge variant="outline" className="font-mono text-xs whitespace-nowrap">{getStageLabel(displayedMilestones, index)}</Badge>
                              </TableCell>
                              <TableCell className="font-medium py-3">
                                <div
                                  className="flex items-center gap-2"
                                  style={{ paddingLeft: `${(milestone.stageLevel ?? 0) * 16}px` }}
                                >
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => toggleMilestoneAccordion(milestone.id)}
                                  >
                                    {expandedMilestones.has(milestone.id) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <StatusIcon status={milestone.status} />
                                  {!isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        className="truncate text-left hover:underline"
                                        onClick={() => openMilestoneDetail(milestone.id)}
                                      >
                                        {milestone.stageName}
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <Input
                                        value={milestone.stageName}
                                        onChange={(e) => updateEditingMilestone(milestone.id, { stageName: e.target.value })}
                                        className="h-8 text-sm flex-1"
                                      />
                                      {(milestone.stageLevel ?? 0) < 2 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 shrink-0"
                                          onClick={() => addChildMilestone(milestone.id)}
                                          title="하위 단계 추가"
                                        >
                                          <Plus className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground py-3 truncate">
                                {!isEditing ? (
                                  milestone.role
                                ) : (
                                  <Select 
                                    value={milestone.role}
                                    onValueChange={(value) => updateEditingMilestone(milestone.id, { role: value })}
                                  >
                                    <SelectTrigger className="h-8 text-sm dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]">
                                      {availableUsers.map(user => (
                                        <SelectItem key={user.id} value={user.displayName} className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">
                                          {user.displayName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground py-3 whitespace-nowrap">
                                {!isEditing ? (
                                  format(milestone.dueDate, 'yyyy.MM.dd', { locale: ko })
                                ) : (
                                  <Input
                                    type="date"
                                    value={(milestone as EditableMilestone).dueDate}
                                    onChange={(e) => handleEditingMilestoneDueDateChange(milestone.id, e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                )}
                              </TableCell>
                              <TableCell className="py-3">
                                <Select
                                  value={milestone.status}
                                  disabled={!isEditing}
                                  onValueChange={(value) => {
                                    updateEditingMilestone(milestone.id, { status: value as Milestone['status'] })
                                  }}
                                >

                                  <SelectTrigger className="h-9 bg-secondary border-border text-sm dark:bg-[#1E1E1E] dark:border-[#464554]/50 dark:text-[#e5e2e1]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="dark:bg-[#1E1E1E] dark:border-[#333333] dark:bg-[#1E1E1E]/60 dark:border-white/15 dark:backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]">
                                    <SelectItem value="pending" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">대기</SelectItem>
                                    <SelectItem value="in-progress" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">진행중</SelectItem>
                                    <SelectItem value="completed" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">완료</SelectItem>
                                    <SelectItem value="overdue" className="dark:border-b-0 dark:text-[#c7c4d7] dark:focus:text-[#e5e2e1] dark:focus:bg-[#2A2A2A]">지연</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-3 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => startNoteEdit(milestone.id)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TableCell>
                              <TableCell className="py-3 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteMilestoneRow(milestone.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                            {expandedMilestones.has(milestone.id) && (
                              <TableRow className="bg-[#f3f1ff] dark:bg-[#23213a]">
                                <TableCell colSpan={8} className="py-4">
                                  <div className="space-y-3">
                                    <div className="space-y-2">
                                      {(sourceMilestone?.notes ?? []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground">등록된 액션 아이템이 없습니다.</p>
                                      ) : (
                                        <div className="space-y-2">
                                          {sourceMilestone && renderNotesTree(sourceMilestone, sourceMilestone.notes ?? [], null, 0)}
                                        </div>
                                      )}
                                    </div>

                                    {sourceMilestone && noteEditTarget === milestone.id && (
                                      <div className="space-y-2 rounded-md border border-[#dbd6f0] bg-white/95 p-3 dark:bg-[#23213a] dark:border-[#333333]">
                                        <Textarea
                                          value={noteDrafts[getDraftKey(milestone.id)] || ''}
                                          onChange={(e) => setNoteDrafts((prev) => ({
                                            ...prev,
                                            [getDraftKey(milestone.id)]: e.target.value,
                                          }))}
                                          placeholder="주요 사항, 이슈, 의사결정을 입력하세요."
                                          className="min-h-[96px]"
                                        />
                                        <div className="flex justify-end gap-2">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => cancelNoteEdit(milestone.id)}
                                          >
                                            취소
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => saveMilestoneNote(sourceMilestone)}
                                            disabled={!(noteDrafts[getDraftKey(milestone.id)] || '').trim()}
                                          >
                                            완료
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                            </Fragment>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="milestone-detail">
                {/* 단계(폴더) 영역 복원 */}
                <div className="mb-4">
                  <Card className="bg-white/95 border border-[#dbd6f0] shadow-lg rounded-xl dark:bg-[#171616] dark:border-[#333333]">
                    <CardHeader className="flex flex-row items-start justify-between gap-4 px-6 pt-[10px] pb-2 border-b border-[#ece8fa] dark:border-[#333333]">
                      <div className="flex flex-col gap-1">
                        <CardTitle className="text-lg font-bold tracking-tight text-[#1e1b4b] dark:text-[#e5e2e1]">단계 (폴더)</CardTitle>
                        <CardDescription className="text-xs text-[#6360a0] dark:text-[#908fa0] mt-1">단계별 폴더를 한눈에 관리하고 파일을 드래그하여 이동할 수 있습니다.</CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setIsStageFolderCollapsed((prev) => !prev)}
                      >
                        {isStageFolderCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CardHeader>
                    {!isStageFolderCollapsed && (
                      <CardContent className="pt-2 pb-2 px-6">
                        <div className="group/folder relative">
                          <div
                            className="space-y-2 overflow-y-auto pr-1"
                            style={{ height: stageFolderHeight }}
                          >
                            {customer.milestones.map((milestone, index) => {
                              const level = milestone.stageLevel ?? 0
                              // 부모가 접혀 있으면 이 항목을 숨김
                              const isHidden = customer.milestones.some((m, i) => {
                                if (i >= index) return false
                                const ml = m.stageLevel ?? 0
                                if (ml >= level) return false
                                if (collapsedStageFolderParents.has(m.id)) {
                                  for (let j = i + 1; j < index; j++) {
                                    if ((customer.milestones[j].stageLevel ?? 0) <= ml) return false
                                  }
                                  return true
                                }
                                return false
                              })
                              if (isHidden) return null
                              const hasChildren = index + 1 < customer.milestones.length &&
                                (customer.milestones[index + 1].stageLevel ?? 0) > level
                              const isParentCollapsed = collapsedStageFolderParents.has(milestone.id)
                              return (
                                <div key={milestone.id} className="flex items-center gap-1">
                                  {hasChildren ? (
                                    <button
                                      type="button"
                                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-[#ece8fa] dark:hover:bg-[#23213a]"
                                      onClick={() => setCollapsedStageFolderParents((prev) => {
                                        const next = new Set(prev)
                                        if (next.has(milestone.id)) next.delete(milestone.id)
                                        else next.add(milestone.id)
                                        return next
                                      })}
                                    >
                                      {isParentCollapsed
                                        ? <ChevronRight className="h-3 w-3" />
                                        : <ChevronDown className="h-3 w-3" />}
                                    </button>
                                  ) : (
                                    <span className="h-5 w-5 shrink-0" />
                                  )}
                                  <button
                                    type="button"
                                    className={`min-w-0 flex-1 rounded-md border border-[#dbd6f0] bg-[#f3f1ff] px-3 py-2 text-left text-sm hover:bg-[#e9e6fa] dark:bg-[#23213a] dark:border-[#333333] dark:hover:bg-[#323232] transition-colors${milestone.id === selectedMilestoneId ? ' border-primary/50 dark:bg-[#323232]' : ''}${dragOverMilestoneId === milestone.id ? ' ring-2 ring-primary/50 bg-primary/5 dark:bg-primary/10' : ''}`}
                                    style={{ paddingLeft: `${12 + (level * 16)}px` }}
                                    onClick={() => {
                                      setSelectedMilestoneId(milestone.id)
                                      setSelectedFileTarget({
                                        milestoneId: milestone.id,
                                        noteId: null,
                                        kind: 'stage',
                                        label: milestone.stageName,
                                      })
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault()
                                      e.dataTransfer.dropEffect = 'move'
                                      setDragOverMilestoneId(milestone.id)
                                    }}
                                    onDragLeave={(e) => {
                                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                        setDragOverMilestoneId(null)
                                      }
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault()
                                      setDragOverMilestoneId(null)
                                      const fileId = e.dataTransfer.getData('fileId')
                                      const sourceKey = e.dataTransfer.getData('sourceKey')
                                      if (fileId && sourceKey) {
                                        void handleMoveFile(fileId, sourceKey, milestone)
                                      }
                                    }}
                                  >
                                    <span className="mr-2 inline-flex rounded border border-[#dbd6f0] bg-[#ece8fa] px-1 font-mono text-[11px] dark:bg-[#23213a] dark:border-[#333333]">{getStageLabel(customer.milestones, index)}</span>
                                    <span className="inline-flex items-center gap-2 align-middle">
                                      {milestone.id === selectedMilestoneId
                                        ? <FolderOpen className={`h-4 w-4 ${level === 0 ? 'text-amber-500 dark:text-amber-400' : 'text-amber-400/80 dark:text-amber-400/70'}`} />
                                        : <Folder className={`h-4 w-4 ${level === 0 ? 'text-amber-500 dark:text-amber-400' : 'text-amber-400/80 dark:text-amber-400/70'}`} />}
                                      <span className="truncate">{milestone.stageName}</span>
                                    </span>
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                          <div
                            className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize opacity-0 transition-opacity group-hover/folder:opacity-100 flex items-center justify-center"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              const startY = e.clientY
                              const startH = stageFolderHeight
                              const onMove = (ev: MouseEvent) => {
                                const next = Math.max(64, startH + ev.clientY - startY)
                                setStageFolderHeight(next)
                              }
                              const onUp = () => {
                                window.removeEventListener('mousemove', onMove)
                                window.removeEventListener('mouseup', onUp)
                              }
                              window.addEventListener('mousemove', onMove)
                              window.addEventListener('mouseup', onUp)
                            }}
                          >
                            <div className="h-1 w-10 rounded-full bg-[#dbd6f0] dark:bg-[#333333]" />
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </div>
                {/* Teams-style File Library UI redesign start */}
                <Card className="bg-white/95 border border-[#dbd6f0] shadow-lg rounded-xl dark:bg-[#171616] dark:border-[#333333]">
                  <CardHeader className="flex flex-row items-start justify-between gap-4 px-6 pt-[10px] pb-2 border-b border-[#ece8fa] dark:border-[#333333]">
                    <div className="flex flex-col gap-1">
                      {/* Robust Breadcrumb for 단계(폴더) navigation */}
                      {selectedMilestoneId && customer && (() => {
                        // Find the 단계(폴더) path for the selected milestone robustly
                        const milestones = customer.milestones;
                        const idx = milestones.findIndex(m => m.id === selectedMilestoneId);
                        if (idx === -1) return null;
                        const path: { id: string, name: string, level: number }[] = [];
                        let curIdx = idx;
                        let curLevel = milestones[curIdx].stageLevel ?? 0;
                        // Walk up the milestone list to build the path
                        while (curIdx >= 0) {
                          const m = milestones[curIdx];
                          if ((m.stageLevel ?? 0) === curLevel) {
                            path.unshift({ id: m.id, name: m.stageName, level: curLevel });
                            curLevel--;
                          }
                          curIdx--;
                        }
                        // If path is empty, fallback to just the selected milestone
                        if (path.length === 0 && milestones[idx]) {
                          path.push({ id: milestones[idx].id, name: milestones[idx].stageName, level: milestones[idx].stageLevel ?? 0 });
                        }
                        const selectedMilestone = milestones[idx]
                        const folderTrail =
                          selectedFileTarget &&
                          selectedFileTarget.milestoneId === selectedMilestone.id &&
                          selectedFileTarget.kind === 'stage'
                            ? selectedFileTarget.folderPath
                            : []

                        return (
                          <nav className="flex flex-wrap items-center gap-1 text-xs text-[#6360a0] dark:text-[#908fa0] mb-1 select-none">
                            {path.map((p, i) => (
                              <Fragment key={p.id}>
                                {i > 0 && <ChevronRight className="inline h-3.5 w-3.5 mx-0.5 text-[#b3b0d7] dark:text-[#908fa0]/60" />}
                                <button
                                  type="button"
                                  className={`hover:underline hover:text-indigo-600 dark:hover:text-indigo-300 ${i === path.length - 1 ? 'font-semibold text-[#1e1b4b] dark:text-[#e5e2e1] cursor-default' : 'cursor-pointer'}`}
                                  disabled={i === path.length - 1}
                                  onClick={() => {
                                    setSelectedMilestoneId(p.id);
                                    setSelectedFileTarget({ milestoneId: p.id, noteId: null, kind: 'stage', label: p.name, parentFolderId: null, folderPath: [] });
                                  }}
                                >
                                  {p.name}
                                </button>
                              </Fragment>
                            ))}
                            {folderTrail.map((folderName, folderIndex) => (
                              <Fragment key={`${folderName}-${folderIndex}`}>
                                <ChevronRight className="inline h-3.5 w-3.5 mx-0.5 text-[#b3b0d7] dark:text-[#908fa0]/60" />
                                <button
                                  type="button"
                                  className={`hover:underline hover:text-indigo-600 dark:hover:text-indigo-300 ${folderIndex === folderTrail.length - 1 ? 'font-semibold text-[#1e1b4b] dark:text-[#e5e2e1] cursor-default' : 'cursor-pointer'}`}
                                  disabled={folderIndex === folderTrail.length - 1}
                                  onClick={() => {
                                    if (!selectedFileTarget || selectedFileTarget.kind !== 'stage') return
                                    const nextFolderPath = folderTrail.slice(0, folderIndex + 1)
                                    const rootTarget: FileLibraryTarget = {
                                      milestoneId: selectedMilestone.id,
                                      noteId: null,
                                      kind: 'stage',
                                      label: selectedMilestone.stageName,
                                      parentFolderId: null,
                                      folderPath: [],
                                    }
                                    const nextParentFolder = nextFolderPath.reduce<MilestoneFile | undefined>((parent, segmentName, idx) => {
                                      const lookupTarget: FileLibraryTarget = {
                                        ...rootTarget,
                                        parentFolderId: parent?.id ?? null,
                                        folderPath: nextFolderPath.slice(0, idx),
                                      }
                                      const filesAtLevel = libraryByTarget[getFileTargetKey(lookupTarget)] ?? []
                                      return filesAtLevel.find((item) => item.isFolder && item.fileName === segmentName)
                                    }, undefined)

                                    setSelectedFileTarget({
                                      ...rootTarget,
                                      label: folderName,
                                      parentFolderId: nextParentFolder?.id ?? null,
                                      folderPath: nextFolderPath,
                                    })
                                  }}
                                >
                                  {folderName}
                                </button>
                              </Fragment>
                            ))}
                          </nav>
                        );
                      })()}
                      <CardTitle className="text-lg font-bold tracking-tight text-[#1e1b4b] dark:text-[#e5e2e1]">파일 라이브러리</CardTitle>
                      <CardDescription className="text-xs text-[#6360a0] dark:text-[#908fa0] mt-1">폴더/파일을 한눈에 관리하고 업로드할 수 있습니다.</CardDescription>
                    </div>
                    <div className="flex w-full sm:w-auto flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 flex-1 sm:flex-none min-w-[120px] px-4 text-sm font-medium border-[#dbd6f0] bg-[#f3f1ff] hover:bg-[#e9e6fa] dark:bg-[#23213a] dark:border-[#333333] dark:text-[#e5e2e1]"
                        onClick={() => {
                          if (!selectedMilestoneId) return;
                          const milestone = customer.milestones.find(m => m.id === selectedMilestoneId);
                          if (!milestone) return;
                          const target = selectedFileTarget && selectedFileTarget.milestoneId === milestone.id
                            ? selectedFileTarget
                            : { milestoneId: milestone.id, noteId: null, kind: 'stage' as const, label: milestone.stageName, parentFolderId: null, folderPath: [] }
                          handleCreateFolder(target);
                        }}
                        disabled={isLoadingFiles || !selectedMilestoneId}
                      >
                        <FolderPlus className="h-4 w-4 mr-2" /> 새 폴더
                      </Button>
                      <label htmlFor={`file-upload-teams-style`} className="h-9 flex-1 sm:flex-none min-w-[120px] px-4 flex items-center justify-center gap-2 rounded-md border border-[#dbd6f0] bg-[#f3f1ff] text-sm font-medium cursor-pointer hover:bg-[#e9e6fa] dark:bg-[#23213a] dark:border-[#333333] dark:text-[#e5e2e1]">
                        <Upload className="h-4 w-4" /> 파일 업로드
                        <input
                          id={`file-upload-teams-style`}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (!selectedMilestoneId || isLoadingFiles) return;
                            const milestone = customer.milestones.find(m => m.id === selectedMilestoneId);
                            if (!milestone) return;
                            const target = selectedFileTarget && selectedFileTarget.milestoneId === milestone.id
                              ? selectedFileTarget
                              : { milestoneId: milestone.id, noteId: null, kind: 'stage' as const, label: milestone.stageName, parentFolderId: null, folderPath: [] }
                            handleFileUpload(target, e.target.files);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6 pb-6 pt-4">
                    {(() => {
                      const selectedMilestone = customer.milestones.find((m) => m.id === selectedMilestoneId)
                      if (!selectedMilestone) {
                        return (
                          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                            <div className="rounded-full bg-[#f3f1ff] p-5 dark:bg-[#23213a]">
                              <FolderOpen className="h-10 w-10 text-[#b3b0d7] dark:text-[#908fa0]" />
                            </div>
                            <p className="text-base font-semibold text-[#5b5785] dark:text-[#908fa0]">마일스톤 단계를 선택하면 파일을 관리할 수 있습니다.</p>
                            <p className="text-xs text-[#b3b0d7] dark:text-[#908fa0]/60">상단 마일스톤 테이블에서 단계를 클릭해주세요.</p>
                          </div>
                        )
                      }

                      const currentTarget = (
                        selectedFileTarget && selectedFileTarget.milestoneId === selectedMilestone.id
                          ? selectedFileTarget
                          : {
                              milestoneId: selectedMilestone.id,
                              noteId: null,
                              kind: 'stage' as const,
                              label: selectedMilestone.stageName,
                              parentFolderId: null,
                              folderPath: [],
                            }
                      )
                      const targetKey = getFileTargetKey(currentTarget)
                      const files = libraryByTarget[targetKey] ?? []
                      const normalizedSearchQuery = fileSearchQuery.trim().toLowerCase()
                      const searchedFiles = normalizedSearchQuery
                        ? files.filter((file) => file.fileName.toLowerCase().includes(normalizedSearchQuery))
                        : files
                      const filteredFiles = [...searchedFiles].sort((a, b) => {
                        if (a.isFolder && !b.isFolder) return -1
                        if (!a.isFolder && b.isFolder) return 1
                        if (fileSortOption === 'size-desc') return b.fileSize - a.fileSize
                        if (fileSortOption === 'size-asc') return a.fileSize - b.fileSize
                        const aTime = new Date(a.uploadedAt).getTime()
                        const bTime = new Date(b.uploadedAt).getTime()
                        if (fileSortOption === 'uploaded-asc') return aTime - bTime
                        return bTime - aTime
                      })
                      const isUploadingCurrentTarget = uploadProgress?.targetKey === targetKey
                      const uploadPercent = isUploadingCurrentTarget && uploadProgress && uploadProgress.total > 0
                        ? Math.round((uploadProgress.completed / uploadProgress.total) * 100)
                        : 0

                      return (
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                type="text"
                                value={fileSearchQuery}
                                onChange={(e) => setFileSearchQuery(e.target.value)}
                                placeholder="파일명 검색"
                                className="h-9 w-full sm:w-56 border-[#dbd6f0] bg-[#f3f1ff] text-sm focus:ring-2 focus:ring-indigo-200 dark:bg-[#23213a] dark:border-[#333333] dark:text-[#e5e2e1]"
                              />

                            </div>
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <Badge variant="outline" className="text-xs px-2 py-1 bg-[#ece8fa] border-[#dbd6f0] text-[#6360a0] dark:bg-[#23213a] dark:border-[#333333] dark:text-[#e5e2e1]">
                                {currentTarget.kind === 'stage' ? '단계' : '액션아이템'}
                              </Badge>
                              <span className="text-sm font-medium text-[#1e1b4b] dark:text-[#e5e2e1] max-w-full truncate">{currentTarget.label}</span>
                              <Badge variant="secondary" className="text-xs tabular-nums bg-[#ece8fa] text-[#6360a0] dark:bg-[#23213a] dark:text-[#e5e2e1]">{files.length}개</Badge>
                            </div>
                          </div>

                          {isUploadingCurrentTarget && uploadProgress && (
                            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex flex-col gap-2">
                              <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                                <div className="flex items-center gap-2 text-primary">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span className="font-medium">파일 업로드 진행 중</span>
                                </div>
                                <span className="text-muted-foreground">{uploadPercent}%</span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
                                <div
                                  className="h-full rounded-full bg-primary transition-all duration-300"
                                  style={{ width: `${uploadPercent}%` }}
                                />
                              </div>
                              <p className="truncate text-xs text-muted-foreground">
                                현재 파일: {uploadProgress.currentFileName}
                              </p>
                            </div>
                          )}

                          <div className="rounded-lg border border-[#dbd6f0] bg-[#f3f1ff] p-0 overflow-hidden dark:bg-[#23213a] dark:border-[#333333]">
                            {filteredFiles.length === 0 ? (
                              <div className="flex h-32 items-center justify-center text-base text-[#b3b0d7] dark:text-[#908fa0]">
                                {files.length === 0 ? '업로드된 파일이 없습니다.' : '검색 결과가 없습니다.'}
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-[760px] w-full divide-y divide-[#ece8fa] dark:divide-[#333333]">
                                  <thead className="bg-[#ece8fa] dark:bg-[#23213a]">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[#6360a0] dark:text-[#e5e2e1]">파일명</th>
                                      <th className="px-4 py-2 text-center text-xs font-semibold text-[#6360a0] dark:text-[#e5e2e1]">
                                        <div className="flex items-center justify-center gap-1">
                                          <span>크기</span>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <button type="button" className="inline-flex items-center justify-center rounded hover:bg-[#dbd6f0] dark:hover:bg-[#333333] p-0.5 transition-colors">
                                                <ChevronDown className="h-3 w-3" />
                                              </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="center" className="min-w-[100px] bg-white opacity-100 dark:bg-white">
                                              <DropdownMenuItem
                                                onClick={() => setFileSortOption('size-asc')}
                                                className={fileSortOption === 'size-asc' ? 'font-semibold text-indigo-600 dark:text-indigo-400' : ''}
                                              >
                                                작은 순
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() => setFileSortOption('size-desc')}
                                                className={fileSortOption === 'size-desc' ? 'font-semibold text-indigo-600 dark:text-indigo-400' : ''}
                                              >
                                                큰 순
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      </th>
                                      <th className="px-4 py-2 text-center text-xs font-semibold text-[#6360a0] dark:text-[#e5e2e1]">
                                        <div className="flex items-center justify-center gap-1">
                                          <span>업로드 일시</span>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <button type="button" className="inline-flex items-center justify-center rounded hover:bg-[#dbd6f0] dark:hover:bg-[#333333] p-0.5 transition-colors">
                                                <ChevronDown className="h-3 w-3" />
                                              </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="center" className="min-w-[110px] bg-white opacity-100 dark:bg-white">
                                              <DropdownMenuItem
                                                onClick={() => setFileSortOption('uploaded-asc')}
                                                className={fileSortOption === 'uploaded-asc' ? 'font-semibold text-indigo-600 dark:text-indigo-400' : ''}
                                              >
                                                오래된 순
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() => setFileSortOption('uploaded-desc')}
                                                className={fileSortOption === 'uploaded-desc' ? 'font-semibold text-indigo-600 dark:text-indigo-400' : ''}
                                              >
                                                최신순
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      </th>
                                      <th className="px-4 py-2 text-center text-xs font-semibold text-[#6360a0] dark:text-[#e5e2e1]">작업</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white/95 dark:bg-[#23213a]">
                                    {filteredFiles.map((file) => (
                                      <tr
                                        key={file.id}
                                        draggable={!file.isFolder}
                                        onDragStart={(e) => {
                                          if (!file.isFolder) {
                                            e.dataTransfer.setData('fileId', file.id)
                                            e.dataTransfer.setData('sourceKey', targetKey)
                                            e.dataTransfer.effectAllowed = 'move'
                                          }
                                        }}
                                        className={!file.isFolder ? 'cursor-grab active:cursor-grabbing group hover:bg-[#ece8fa] dark:hover:bg-[#23213a]/80 transition-colors' : 'group hover:bg-[#ece8fa] dark:hover:bg-[#23213a]/80 transition-colors'}
                                      >
                                        <td className="px-4 py-2 whitespace-nowrap">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (file.isFolder) {
                                                setSelectedFileTarget({
                                                  ...currentTarget,
                                                  label: file.fileName,
                                                  parentFolderId: file.id,
                                                  folderPath: [...currentTarget.folderPath, file.fileName],
                                                })
                                                return
                                              }
                                              handleViewFile(file)
                                            }}
                                            className={file.isFolder ? 'flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors max-w-[320px]' : 'flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors max-w-[320px]'}
                                          >
                                            {file.isFolder ? (
                                              <Folder className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                                            ) : (
                                              <FileText className="h-4 w-4 text-[#b3b0d7] dark:text-[#908fa0] group-hover:text-indigo-600" />
                                            )}
                                            <span className={file.isFolder ? 'truncate' : 'truncate hover:underline'}>{file.fileName}</span>
                                          </button>
                                        </td>
                                        <td className="px-4 py-2 text-center text-sm text-[#6360a0] dark:text-[#e5e2e1] whitespace-nowrap">{file.isFolder ? '-' : formatFileSize(file.fileSize)}</td>
                                        <td className="px-4 py-2 text-center text-sm text-[#6360a0] dark:text-[#e5e2e1] whitespace-nowrap">{format(new Date(file.uploadedAt), 'yyyy.MM.dd HH:mm', { locale: ko })}</td>
                                        <td className="px-4 py-2 text-center whitespace-nowrap">
                                          <div className="flex justify-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => handleDownloadFile(file)}
                                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#dbd6f0] bg-[#f3f1ff] hover:bg-[#e9e6fa] dark:bg-[#23213a] dark:border-[#333333] dark:text-[#e5e2e1]"
                                              disabled={isLoadingFiles || Boolean(file.isFolder)}
                                            >
                                              <Download className="h-4 w-4" />
                                            </button>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="icon"
                                              className="h-8 w-8 border-[#dbd6f0] bg-[#f3f1ff] hover:bg-[#e9e6fa] dark:bg-[#23213a] dark:border-[#333333] dark:text-[#e5e2e1]"
                                              onClick={() => handleRemoveFile(currentTarget, file.id)}
                                              disabled={isLoadingFiles}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>
                {/* Teams-style File Library UI redesign end */}
              </TabsContent>
              
              <TabsContent value="gantt">
                <Card className="bg-white/95 border border-[#dbd6f0] shadow-lg rounded-xl dark:bg-[#171616] dark:border-[#333333]">
                  <CardHeader className="flex flex-row items-start justify-between gap-4 px-6 pt-[10px] pb-2 border-b border-[#ece8fa] dark:border-[#333333]">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-lg font-bold tracking-tight text-[#1e1b4b] dark:text-[#e5e2e1]">간이 WBS</CardTitle>
                      <CardDescription className="text-xs text-[#6360a0] dark:text-[#908fa0] mt-1">워크플로우 단계를 WBS로 구현하여 조회 및 다운로드 할 수 있습니다.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="min-h-96 flex items-center">
                      <div className="w-full">
                        <GanttChart customer={customer} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </SidebarInset>

      {/* File Viewer Dialog */}
      <Dialog open={isCreateFolderDialogOpen} onOpenChange={setIsCreateFolderDialogOpen}>
        <DialogContent className="max-w-md dark:bg-[#1c1b1b] dark:border-[#464554]">
          <DialogHeader className="dark:border-b dark:border-[#464554] pb-4">
            <DialogTitle className="dark:text-[#e5e2e1]">폴더 생성</DialogTitle>
            <DialogDescription className="dark:text-[#c7c4d7]">
              새 폴더 이름을 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <Label htmlFor="folder-name" className="dark:text-[#e5e2e1]">폴더명</Label>
            <Input
              id="folder-name"
              value={folderNameDraft}
              onChange={(e) => setFolderNameDraft(e.target.value)}
              placeholder="폴더명을 입력하세요"
              className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:placeholder:text-[#908fa0]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && folderNameDraft.trim()) {
                  void handleCreateFolderConfirm()
                }
              }}
            />
          </div>
          <DialogFooter className="dark:border-t dark:border-t-[#464554] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateFolderDialogOpen(false)}
              className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateFolderConfirm()}
              disabled={!folderNameDraft.trim() || isLoadingFiles}
            >
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedFileForViewer}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedFileForViewer(null)
            setPdfViewerPage(1)
          }
        }}
      >
        <DialogContent
            className="h-[84vh] max-h-[92vh] w-[96vw] max-w-[120rem] overflow-hidden resize rounded-2xl border border-[#dbe3ee] bg-white/95 shadow-[0_28px_70px_-40px_rgba(37,22,120,0.45)] dark:bg-[#1c1b1b] dark:border-[#464554]"
          style={{ resize: 'both' }}
        >
            <DialogHeader className="border-b border-[#e7e2f5] pb-3 dark:border-b dark:border-[#464554]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-base font-semibold text-[#1e1b4b] dark:text-[#e5e2e1]">
                    {selectedFileForViewer?.fileName}
                  </DialogTitle>
                  <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs dark:text-[#c7c4d7]">
                    {selectedFileForViewer && `크기: ${formatFileSize(selectedFileForViewer.fileSize)}`}
                    {selectedFileForViewer && (
                      <span className="inline-flex items-center rounded-full border border-[#d3cef0] bg-white px-2 py-0.5 text-[#5b5785] dark:border-white/15 dark:bg-white/5 dark:text-[#c7c4d7]">
                        .{getFileExtension(selectedFileForViewer.fileName)}
                      </span>
                    )}
                  </DialogDescription>
                </div>

              </div>
          </DialogHeader>
            <div className="mt-3 flex h-[calc(100%-5rem)] min-h-0 flex-col">
            {selectedFileForViewer && (
              <>
                {isImageFile(selectedFileForViewer.fileName) ? (
                    <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[#ddd6f2] bg-[#f8f6ff] p-3 dark:bg-[#0e0e0e] dark:border-[#464554]">
                    {imageLoadError ? (
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <FileText className="h-12 w-12" />
                        <p className="text-sm">이미지를 불러올 수 없습니다.</p>
                        <p className="text-xs opacity-60">파일을 다운로드하여 확인해주세요.</p>
                      </div>
                    ) : (
                      <img
                        src={selectedFileForViewer.base64Content
                          ? selectedFileForViewer.base64Content
                          : `/api/milestone-files/content?id=${encodeURIComponent(selectedFileForViewer.id)}`}
                        alt={selectedFileForViewer.fileName}
                        className="h-full w-full rounded-md object-contain"
                        onError={() => setImageLoadError(true)}
                      />
                    )}
                  </div>
                ) : isPdfFile(selectedFileForViewer.fileName) ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-[#ddd6f2] bg-[#f8f6ff] p-2 dark:border-[#464554] dark:bg-[#0e0e0e]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"
                        onClick={() => setPdfViewerPage((prev) => Math.max(1, prev - 1))}
                        disabled={pdfViewerPage <= 1}
                      >
                        이전 페이지
                      </Button>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground dark:text-[#908fa0]">페이지</span>
                        <Input
                          type="number"
                          min={1}
                          value={pdfViewerPage}
                          onChange={(e) => {
                            const value = Number.parseInt(e.target.value, 10)
                            setPdfViewerPage(Number.isFinite(value) && value > 0 ? value : 1)
                          }}
                          className="h-8 w-20 dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1]"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"
                        onClick={() => setPdfViewerPage((prev) => prev + 1)}
                      >
                        다음 페이지
                      </Button>
                    </div>
                    {pdfViewerSrc ? (
                      <iframe
                        src={`${pdfViewerSrc.split('#')[0]}#page=${pdfViewerPage}&toolbar=1&navpanes=1`}
                        className="min-h-0 flex-1 w-full rounded-xl border border-[#ddd6f2] bg-white dark:border-[#464554]"
                        title={selectedFileForViewer.fileName}
                      />
                    ) : (
                      <div className="bg-muted/50 p-4 rounded-lg dark:bg-[#0e0e0e] dark:border dark:border-[#464554]">
                        <p className="text-sm text-muted-foreground dark:text-[#908fa0]">PDF 미리보기 소스를 찾을 수 없습니다.</p>
                      </div>
                    )}
                  </div>
                ) : isDocxFile(selectedFileForViewer.fileName) ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-[#ddd6f2] bg-[#f8f6ff] p-2 dark:border-[#464554] dark:bg-[#0e0e0e]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"
                        onClick={() => scrollToDocxPage(docxViewerPage - 1)}
                        disabled={docxViewerPage <= 1}
                      >
                        이전 페이지
                      </Button>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground dark:text-[#908fa0]">페이지</span>
                        <Input
                          type="number"
                          min={1}
                          max={docxViewerTotalPages}
                          value={docxViewerPage}
                          onChange={(e) => {
                            const value = Number.parseInt(e.target.value, 10)
                            setDocxViewerPage(Number.isFinite(value) && value > 0 ? value : 1)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              scrollToDocxPage(docxViewerPage)
                            }
                          }}
                          className="h-8 w-20 dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1]"
                        />
                        <span className="text-muted-foreground dark:text-[#908fa0]">/ {docxViewerTotalPages}</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"
                        onClick={() => scrollToDocxPage(docxViewerPage + 1)}
                        disabled={docxViewerPage >= docxViewerTotalPages}
                      >
                        다음 페이지
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"
                        onClick={() => setDocxZoom((prev) => Math.max(0.6, Number((prev - 0.1).toFixed(2))))}
                      >
                        축소
                      </Button>
                      <span className="w-14 text-center text-sm text-muted-foreground dark:text-[#908fa0]">
                        {Math.round(docxZoom * 100)}%
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"
                        onClick={() => setDocxZoom((prev) => Math.min(2, Number((prev + 0.1).toFixed(2))))}
                      >
                        확대
                      </Button>
                    </div>

                    <div className="relative min-h-0 flex-1 overflow-auto rounded-xl border border-[#ddd6f2] bg-white p-4 dark:bg-[#0e0e0e] dark:border-[#464554]">
                      <div ref={docxContainerCallbackRef} className="min-h-full" />
                      {isLoadingDocxPreview && (
                        <div className="absolute inset-0 flex items-start p-4 pointer-events-none">
                          <p className="text-sm text-muted-foreground dark:text-[#908fa0]">DOCX 미리보기를 불러오는 중입니다...</p>
                        </div>
                      )}
                      {!isLoadingDocxPreview && docxPreviewError && (
                        <div className="absolute inset-0 flex items-start p-4 pointer-events-none">
                          <p className="text-sm text-muted-foreground dark:text-[#908fa0]">{docxPreviewError}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : isTextFile(selectedFileForViewer.fileName) ? (
                  <div className="relative min-h-0 flex-1 overflow-auto rounded-xl border border-[#ddd6f2] bg-[#fbfaff] p-4 dark:bg-[#0e0e0e] dark:border dark:border-[#464554]">
                    {isLoadingTextPreview && (
                      <p className="text-sm text-muted-foreground dark:text-[#908fa0]">파일 내용을 불러오는 중입니다...</p>
                    )}
                    {!isLoadingTextPreview && textPreviewError && (
                      <p className="text-sm text-muted-foreground dark:text-[#908fa0]">{textPreviewError}</p>
                    )}
                    {!isLoadingTextPreview && textFileContent !== null && (
                      <pre className="font-mono text-[13px] leading-6 whitespace-pre-wrap break-words text-[#2d2a45] dark:text-[#c7c4d7]">{textFileContent}</pre>
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-[#ddd6f2] bg-[#fbfaff] p-8 dark:bg-[#0e0e0e] dark:border dark:border-[#464554]">
                    <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground dark:text-[#c7c4d7]">
                      이 파일 형식은 미리보기를 지원하지 않습니다.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 dark:text-[#908fa0]">
                      파일 형식: .{getFileExtension(selectedFileForViewer.fileName)}
                    </p>
                  </div>
                )}
                <div className="mt-3 flex justify-end border-t border-[#e7e2f5] pt-3 dark:border-[#464554]">
                  <a
                    href={selectedFileForViewer.base64Content
                      ? selectedFileForViewer.base64Content
                      : `/api/milestone-files/content?id=${encodeURIComponent(selectedFileForViewer.id)}`}
                    download={selectedFileForViewer.fileName}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent px-3 py-2 text-sm font-medium dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    다운로드
                  </a>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Excel Import Confirmation Dialog */}
      <Dialog open={isExcelConfirmOpen} onOpenChange={(open) => { if (!open) { setIsExcelConfirmOpen(false); setExcelImportPending(null) } }}>
        <DialogContent className="max-w-md dark:bg-[#1c1b1b] dark:border-[#464554]">
          <DialogHeader className="dark:border-b dark:border-[#464554] pb-4">
            <DialogTitle className="dark:text-[#e5e2e1]">Excel 가져오기 확인</DialogTitle>
            <DialogDescription className="dark:text-[#c7c4d7]">
              아래 변경 사항을 적용하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {excelImportPending && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground dark:text-[#908fa0]">유지 (변경 없음)</span>
                  <span className="font-medium dark:text-[#e5e2e1]">{excelImportPending.kept.length}개</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground dark:text-[#908fa0]">수정 (기존 단계 업데이트)</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{excelImportPending.toUpdate.length}개</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground dark:text-[#908fa0]">추가 (새 단계)</span>
                  <span className="font-medium text-lime-600 dark:text-lime-400">{excelImportPending.toAdd.length}개</span>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="dark:border-t dark:border-t-[#464554] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setIsExcelConfirmOpen(false); setExcelImportPending(null) }}
              className="dark:bg-[#0e0e0e] dark:border-[#464554] dark:text-[#e5e2e1] dark:hover:bg-[#2a2a2a]"
            >
              취소
            </Button>
            <Button type="button" onClick={handleExcelImportConfirm}>
              적용
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* M-3: Cancel editing confirmation */}
      <AlertDialog open={isCancelConfirmOpen} onOpenChange={setIsCancelConfirmOpen}>
        <AlertDialogContent className="bg-white dark:bg-[#1c1b1b] dark:border-[#464554]">
          <AlertDialogHeader>
            <AlertDialogTitle>저장하지 않은 변경사항이 있습니다</AlertDialogTitle>
            <AlertDialogDescription>
              취소하면 변경한 내용이 모두 사라집니다. 정말 취소하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsCancelConfirmOpen(false)}>계속 편집</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirmed}>변경사항 폐기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* L-1: Delete milestone confirmation */}
      <AlertDialog open={isDeleteMilestoneConfirmOpen} onOpenChange={setIsDeleteMilestoneConfirmOpen}>
        <AlertDialogContent className="bg-white dark:bg-[#1c1b1b] dark:border-[#464554]">
          <AlertDialogHeader>
            <AlertDialogTitle>단계 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 단계를 삭제하시겠습니까? 하위 단계도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteMilestoneConfirmed}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* L-1: Delete file confirmation */}
      <AlertDialog open={isDeleteFileConfirmOpen} onOpenChange={setIsDeleteFileConfirmOpen}>
        <AlertDialogContent className="bg-white dark:bg-[#1c1b1b] dark:border-[#464554]">
          <AlertDialogHeader>
            <AlertDialogTitle>파일 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 파일을 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteFileTarget(null)}>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleRemoveFileConfirmed()}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* L-1: Delete action item confirmation */}
      <AlertDialog open={isDeleteNoteConfirmOpen} onOpenChange={setIsDeleteNoteConfirmOpen}>
        <AlertDialogContent className="bg-white dark:bg-[#1c1b1b] dark:border-[#464554]">
          <AlertDialogHeader>
            <AlertDialogTitle>액션 아이템 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 액션 아이템을 삭제하시겠습니까? 하위 항목도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteNoteTarget(null)}>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteNoteConfirmed}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 담당자 선택 피커 */}
      <EntraPicker
        open={isOwnerPickerOpen}
        onOpenChange={setIsOwnerPickerOpen}
        initialUserIds={(() => {
          const found = availableUsers.find(u => u.displayName === editedOwner)
          return found ? [found.id] : []
        })()}
        onConfirm={(selectedUsers: PickerUser[]) => {
          if (selectedUsers.length > 0) {
            setEditedOwner(selectedUsers[0].displayName)
          }
          setIsOwnerPickerOpen(false)
        }}
      />
    </>
  )
}
