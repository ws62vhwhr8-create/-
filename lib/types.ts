export interface Stage {
  id: string
  name: string
  durationDays: number
  role: string
  notifyDaysBefore: number
  parentStageId?: string | null
  level: number
  children?: Stage[]
}

export interface Solution {
  id: string
  name: string
  description: string
  stages: Stage[]
  userIds?: string[]
  groupIds?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  displayName: string
  email?: string
  role: 'user' | 'admin'
  groupIds?: string[]
}

export interface Group {
  id: string
  name: string
}

export interface MilestoneNote {
  id: string
  content: string
  createdAt: Date
  parentNoteId?: string | null
  ownerName?: string
  dueDate?: Date
  notifyDate?: Date
  status?: 'pending' | 'in-progress' | 'completed' | 'overdue'
}

export interface Milestone {
  id: string
  stageId: string
  stageName: string
  stageLevel: number
  dueDate: Date
  role: string
  notifyDate: Date
  status: 'pending' | 'in-progress' | 'completed' | 'overdue'
  notes?: MilestoneNote[]
}

export interface Customer {
  id: string
  companyName: string
  solutionId: string
  solutionName: string
  salesStartDate: Date
  ownerId?: string
  ownerName: string
  ownerEmail?: string
  milestones: Milestone[]
  createdAt: Date
  status: 'active' | 'completed' | 'at-risk'
  sharedUserIds?: string[]
  sharedGroupIds?: string[]
}

export interface MilestoneFile {
  id: string
  milestoneId: string
  noteId: string | null
  fileName: string
  fileSize: number
  fileType: string
  isFolder?: boolean
  uploadedAt: string
  uploadedBy?: string
  base64Content?: string
  contentUrl?: string
  kind: 'stage' | 'action-item'
}

export type MilestoneStatus = 'pending' | 'in-progress' | 'completed' | 'overdue'
export type CustomerStatus = 'active' | 'completed' | 'at-risk'
