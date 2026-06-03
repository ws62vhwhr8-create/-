"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Solution, Customer, Milestone, User, Group } from './types'
import { addDays, subDays, isBefore, isAfter, startOfDay } from 'date-fns'

interface AppState {
  solutions: Solution[]
  customers: Customer[]
  users: User[]
  groups: Group[]
  currentUserId?: string
  currentEntraId?: string
  
  // Solution actions
  addSolution: (solution: Omit<Solution, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateSolution: (id: string, solution: Partial<Solution>) => void
  deleteSolution: (id: string) => void
  
  // Customer actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'milestones' | 'status' | 'solutionName'> & { useCustomSchedule?: boolean; adjustedStageDurations?: Record<string, number>; totalProjectDays?: number; projectEndDate?: Date }) => string | undefined
  // Field renamed: contractStartDate -> salesStartDate, ownerEmail -> ownerName
  updateCustomer: (id: string, customer: Partial<Customer>) => void
  deleteCustomer: (id: string) => void
  updateMilestoneStatus: (customerId: string, milestoneId: string, status: Milestone['status']) => void
  updateMilestone: (customerId: string, milestoneId: string, updates: Partial<Milestone>) => void
  shareCustomer: (customerId: string, userIds: string[], groupIds: string[]) => void
  // User/Group actions
  addUser: (user: Omit<User, 'id'>) => void
  updateUser: (id: string, updates: Partial<User>) => void
  deleteUser: (id: string) => void
  addGroup: (group: Omit<Group, 'id'>) => void
  setCurrentUserId: (id?: string) => void
  setCurrentEntraId: (id?: string) => void
}

const generateId = () => Math.random().toString(36).substring(2, 15)

// Sample data for demonstration
const sampleSolutions: Solution[] = [
  {
    id: '1',
    name: 'DADAM',
    description: '데이터 자산 관리 플랫폼',
    stages: [
      { 
        id: '1-1', 
        name: '요구사항 분석', 
        durationDays: 14, 
        role: '영업 담당자', 
        notifyDaysBefore: 3,
        parentStageId: null,
        level: 0,
        children: [
          {
            id: '1-1-1',
            name: '클라이언트 요구사항 수집',
            durationDays: 7,
            role: '영업 담당자',
            notifyDaysBefore: 2,
            parentStageId: '1-1',
            level: 1,
            children: []
          }
        ]
      },
      { 
        id: '1-2', 
        name: '기술 검토', 
        durationDays: 21, 
        role: '기술 컨설턴트', 
        notifyDaysBefore: 5,
        parentStageId: null,
        level: 0,
        children: []
      },
      { 
        id: '1-3', 
        name: 'POC 진행', 
        durationDays: 30, 
        role: '솔루션 아키텍트', 
        notifyDaysBefore: 7,
        parentStageId: null,
        level: 0,
        children: []
      },
      { 
        id: '1-4', 
        name: '계약 협상', 
        durationDays: 14, 
        role: '영업 담당자', 
        notifyDaysBefore: 3,
        parentStageId: null,
        level: 0,
        children: []
      },
      { 
        id: '1-5', 
        name: '구축 착수', 
        durationDays: 7, 
        role: '프로젝트 매니저', 
        notifyDaysBefore: 2,
        parentStageId: null,
        level: 0,
        children: []
      },
    ],
    userIds: [],
    groupIds: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    name: 'DARUDA',
    description: '데이터 분석 및 리포팅 솔루션',
    stages: [
      { 
        id: '2-1', 
        name: '현황 분석', 
        durationDays: 7, 
        role: '데이터 분석가', 
        notifyDaysBefore: 2,
        parentStageId: null,
        level: 0,
        children: []
      },
      { 
        id: '2-2', 
        name: '분석 계획 수립', 
        durationDays: 14, 
        role: '데이터 분석가', 
        notifyDaysBefore: 3,
        parentStageId: null,
        level: 0,
        children: []
      },
      { 
        id: '2-3', 
        name: '테스트 환경 구축', 
        durationDays: 21, 
        role: '데브옵스 엔지니어', 
        notifyDaysBefore: 5,
        parentStageId: null,
        level: 0,
        children: []
      },
      { 
        id: '2-4', 
        name: '데이터 연동', 
        durationDays: 14, 
        role: '데이터 엔지니어', 
        notifyDaysBefore: 3,
        parentStageId: null,
        level: 0,
        children: []
      },
      { 
        id: '2-5', 
        name: '운영 전환', 
        durationDays: 7, 
        role: '프로젝트 매니저', 
        notifyDaysBefore: 2,
        parentStageId: null,
        level: 0,
        children: []
      },
    ],
    userIds: [],
    groupIds: [],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '3',
    name: 'DABI',
    description: '비즈니스 인텔리전스 솔루션',
    stages: [
      { 
        id: '3-1', 
        name: '데이터 요구사항 정의', 
        durationDays: 10, 
        role: '데이터 분석가', 
        notifyDaysBefore: 2,
        parentStageId: null,
        level: 0,
        children: []
      },
      { 
        id: '3-2', 
        name: '아키텍처 설계', 
        durationDays: 14, 
        role: '데이터 아키텍트', 
        notifyDaysBefore: 3,
        parentStageId: null,
        level: 0,
        children: []
      },
      { 
        id: '3-3', 
        name: '플랫폼 구축', 
        durationDays: 28, 
        role: '데이터 엔지니어', 
        notifyDaysBefore: 5,
        parentStageId: null,
        level: 0,
        children: []
      },
      { 
        id: '3-4', 
        name: '대시보드 개발', 
        durationDays: 14, 
        role: 'BI 개발자', 
        notifyDaysBefore: 3,
        parentStageId: null,
        level: 0,
        children: []
      },
    ],
    userIds: [],
    groupIds: [],
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: '4',
    name: 'DIA',
    description: '데이터 인텔리전스 분석 솔루션',
    stages: [
      { 
        id: '4-1', 
        name: '요구사항 분석', 
        durationDays: 7, 
        role: '영업 담당자', 
        notifyDaysBefore: 2,
        parentStageId: null,
        level: 0,
        children: []
      },
      { 
        id: '4-2', 
        name: '시스템 설계', 
        durationDays: 14, 
        role: '솔루션 아키텍트', 
        notifyDaysBefore: 3,
        parentStageId: null,
        level: 0,
        children: []
      },
      { 
        id: '4-3', 
        name: '개발 및 테스트', 
        durationDays: 21, 
        role: '개발자', 
        notifyDaysBefore: 5,
        parentStageId: null,
        level: 0,
        children: []
      },
      { 
        id: '4-4', 
        name: '검수 및 배포', 
        durationDays: 7, 
        role: '프로젝트 매니저', 
        notifyDaysBefore: 2,
        parentStageId: null,
        level: 0,
        children: []
      },
    ],
    userIds: [],
    groupIds: [],
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-02-15'),
  },
]

const sampleGroups: Group[] = [
  { id: 'g1', name: '인재개발팀' },
  { id: 'g2', name: 'IT기획팀' },
]

const sampleUsers: User[] = [
  { id: 'u1', displayName: '김영업', email: 'kim@example.com', role: 'user', groupIds: ['g1'] },
  { id: 'u2', displayName: '박매니저', email: 'park@example.com', role: 'user', groupIds: ['g2'] },
  { id: 'admin', displayName: '시스템 관리자', email: 'admin@example.com', role: 'admin', groupIds: [] },
]

function getAllStagesFlattened(stages: any[]): any[] {
  const result: any[] = []
  const traverse = (stageList: any[]) => {
    stageList.forEach(stage => {
      result.push(stage)
      if (stage.children && stage.children.length > 0) {
        traverse(stage.children)
      }
    })
  }
  traverse(stages)
  return result
}

function generateMilestones(solution: Solution, contractStartDate: Date, adjustedStageDurations?: Record<string, number>): Milestone[] {
  let cumulativeDays = 0
  const today = startOfDay(new Date())
  const allStages = getAllStagesFlattened(solution.stages)
  
  return allStages.map((stage) => {
    const stageDuration = adjustedStageDurations?.[stage.id] || stage.durationDays
    cumulativeDays += stageDuration
    const dueDate = addDays(contractStartDate, cumulativeDays)
    const notifyDate = subDays(dueDate, stage.notifyDaysBefore)
    
    let status: Milestone['status'] = 'pending'
    if (isBefore(dueDate, today)) {
      status = 'overdue'
    } else if (isBefore(notifyDate, today)) {
      status = 'in-progress'
    }
    
    return {
      id: generateId(),
      stageId: stage.id,
      stageName: stage.name,
      stageLevel: stage.level ?? 0,
      dueDate,
      role: stage.role,
      notifyDate,
      status,
    }
  })
}

function calculateCustomerStatus(milestones: Milestone[]): Customer['status'] {
  const hasOverdue = milestones.some(m => m.status === 'overdue')
  const allCompleted = milestones.every(m => m.status === 'completed')
  
  if (allCompleted) return 'completed'
  if (hasOverdue) return 'at-risk'
  return 'active'
}

const sampleCustomers: Customer[] = [
  {
    id: 'c1',
    companyName: '삼성전자',
    solutionId: '1',
    solutionName: 'DADAM',
    salesStartDate: new Date('2024-03-01'),
    ownerName: '김영업',
    milestones: generateMilestones(sampleSolutions[0], new Date('2024-03-01')),
    createdAt: new Date('2024-03-01'),
    status: 'active',
    sharedUserIds: ['u1'],
    sharedGroupIds: ['g1'],
  },
  {
    id: 'c2',
    companyName: 'LG전자',
    solutionId: '2',
    solutionName: 'DARUDA',
    salesStartDate: new Date('2024-02-15'),
    ownerName: '박매니저',
    milestones: generateMilestones(sampleSolutions[1], new Date('2024-02-15')),
    createdAt: new Date('2024-02-15'),
    status: 'at-risk',
    sharedUserIds: ['u2'],
    sharedGroupIds: ['g2'],
  },
  {
    id: 'c3',
    companyName: '현대자동차',
    solutionId: '3',
    solutionName: 'DABI',
    salesStartDate: new Date('2024-04-01'),
    ownerName: '이대리',
    milestones: generateMilestones(sampleSolutions[2], new Date('2024-04-01')),
    createdAt: new Date('2024-04-01'),
    status: 'active',
    sharedUserIds: [],
    sharedGroupIds: [],
  },
  {
    id: 'c4',
    companyName: 'SK하이닉스',
    solutionId: '4',
    solutionName: 'DIA',
    salesStartDate: new Date('2024-01-15'),
    ownerName: '최과장',
    milestones: generateMilestones(sampleSolutions[3], new Date('2024-01-15')).map((m, i) => 
      i < 3 ? { ...m, status: 'completed' as const } : m
    ),
    createdAt: new Date('2024-01-15'),
    status: 'active',
    sharedUserIds: [],
    sharedGroupIds: [],
  },
]

// Recalculate status for sample customers
sampleCustomers.forEach(c => {
  c.status = calculateCustomerStatus(c.milestones)
})

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      solutions: sampleSolutions,
      customers: sampleCustomers,
      users: sampleUsers,
      groups: sampleGroups,
      currentUserId: sampleUsers[0].id,
      
      addSolution: (solutionData) => {
        const newSolution: Solution = {
          ...solutionData,
          id: generateId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        set((state) => ({
          solutions: [...state.solutions, newSolution],
        }))
      },
      
      updateSolution: (id, updates) => {
        set((state) => ({
          solutions: state.solutions.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s
          ),
        }))
      },
      
      deleteSolution: (id) => {
        set((state) => ({
          solutions: state.solutions.filter((s) => s.id !== id),
        }))
      },

      // Users / Groups
      addUser: (userData) => {
        const newUser: User = { id: generateId(), ...userData }
        set((state) => ({ users: [...state.users, newUser] }))
      },

      updateUser: (id, updates) => {
        set((state) => ({ users: state.users.map(u => u.id === id ? { ...u, ...updates } : u) }))
      },

      deleteUser: (id) => {
        set((state) => ({ users: state.users.filter(u => u.id !== id) }))
      },

      addGroup: (groupData) => {
        const newGroup: Group = { id: generateId(), ...groupData }
        set((state) => ({ groups: [...state.groups, newGroup] }))
      },

      setCurrentUserId: (id) => set(() => ({ currentUserId: id })),
      setCurrentEntraId: (id) => set(() => ({ currentEntraId: id })),
      
      addCustomer: (customerData) => {
        const companyName = customerData.companyName.trim()
        const ownerName = customerData.ownerName.trim()
        const ownerEmail = customerData.ownerEmail?.trim() || undefined

        if (!companyName) {
          console.error('Failed to add customer: companyName is required')
          return undefined
        }

        if (!ownerName) {
          console.error('Failed to add customer: ownerName is required')
          return undefined
        }

        const solution = get().solutions.find((s) => s.id === customerData.solutionId)
        if (!solution) {
          console.error('Failed to add customer: solution not found', {
            solutionId: customerData.solutionId,
          })
          return undefined
        }

        const salesStartDate = new Date(customerData.salesStartDate)
        if (Number.isNaN(salesStartDate.getTime())) {
          console.error('Failed to add customer: invalid salesStartDate', {
            salesStartDate: customerData.salesStartDate,
          })
          return undefined
        }
        
        const milestones = generateMilestones(
          solution, 
          salesStartDate,
          customerData.useCustomSchedule ? customerData.adjustedStageDurations : undefined
        )
        const status = calculateCustomerStatus(milestones)
        
        const newCustomer: Customer = {
          ...customerData,
          companyName,
          ownerName,
          ownerEmail,
          salesStartDate,
          id: generateId(),
          solutionName: solution.name,
          milestones,
          status,
          createdAt: new Date(),
        }
        set((state) => ({
          customers: [...state.customers, newCustomer],
        }))

        return newCustomer.id
      },
      
      updateCustomer: (id, updates) => {
        set((state) => {
          const hasTarget = state.customers.some((c) => c.id === id)
          if (!hasTarget) {
            console.error('Failed to update customer: customer not found', { id })
            return state
          }

          const normalizedUpdates: Partial<Customer> = { ...updates }

          if (typeof updates.companyName === 'string') {
            const companyName = updates.companyName.trim()
            if (!companyName) {
              console.error('Failed to update customer: companyName cannot be empty', { id })
              delete normalizedUpdates.companyName
            } else {
              normalizedUpdates.companyName = companyName
            }
          }

          if (typeof updates.ownerName === 'string') {
            const ownerName = updates.ownerName.trim()
            if (!ownerName) {
              console.error('Failed to update customer: ownerName cannot be empty', { id })
              delete normalizedUpdates.ownerName
            } else {
              normalizedUpdates.ownerName = ownerName
            }
          }

          if (typeof updates.ownerEmail === 'string') {
            normalizedUpdates.ownerEmail = updates.ownerEmail.trim() || undefined
          }

          if (updates.salesStartDate !== undefined) {
            const salesStartDate = new Date(updates.salesStartDate)
            if (Number.isNaN(salesStartDate.getTime())) {
              console.error('Failed to update customer: invalid salesStartDate', {
                id,
                salesStartDate: updates.salesStartDate,
              })
              delete normalizedUpdates.salesStartDate
            } else {
              normalizedUpdates.salesStartDate = salesStartDate
            }
          }

          return {
            customers: state.customers.map((c) =>
              c.id === id ? { ...c, ...normalizedUpdates } : c
            ),
          }
        })
      },
      
      deleteCustomer: (id) => {
        set((state) => ({
          customers: state.customers.filter((c) => c.id !== id),
        }))
      },
      
      updateMilestoneStatus: (customerId, milestoneId, status) => {
        set((state) => ({
          customers: state.customers.map((c) => {
            if (c.id !== customerId) return c
            const updatedMilestones = c.milestones.map((m) =>
              m.id === milestoneId ? { ...m, status } : m
            )
            return {
              ...c,
              milestones: updatedMilestones,
              status: calculateCustomerStatus(updatedMilestones),
            }
          }),
        }))
      },
      
      updateMilestone: (customerId, milestoneId, updates) => {
        set((state) => ({
          customers: state.customers.map((c) => {
            if (c.id !== customerId) return c
            const updatedMilestones = c.milestones.map((m) =>
              m.id === milestoneId ? { ...m, ...updates } : m
            )
            return {
              ...c,
              milestones: updatedMilestones,
              status: calculateCustomerStatus(updatedMilestones),
            }
          }),
        }))
      },
      
      shareCustomer: (customerId, userIds, groupIds) => {
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === customerId 
              ? { ...c, sharedUserIds: userIds, sharedGroupIds: groupIds }
              : c
          ),
        }))
      },
    }),
    {
      name: 'sales-roadmap-storage',
      partialize: (state) => ({
        solutions: state.solutions.map(s => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        })),
        customers: state.customers.map(c => ({
          ...c,
          salesStartDate: c.salesStartDate.toISOString(),
          createdAt: c.createdAt.toISOString(),
          milestones: c.milestones.map(m => ({
            ...m,
            dueDate: m.dueDate.toISOString(),
            notifyDate: m.notifyDate.toISOString(),
            notes: (m.notes ?? []).map(note => ({
              ...note,
              createdAt: note.createdAt.toISOString(),
              dueDate: note.dueDate ? note.dueDate.toISOString() : undefined,
              notifyDate: note.notifyDate ? note.notifyDate.toISOString() : undefined,
            })),
          })),
        })),
        users: state.users,
        groups: state.groups,
        currentUserId: state.currentUserId,
        currentEntraId: state.currentEntraId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.customers = state.customers.map((c: any) => ({
            ...c,
            salesStartDate: new Date(c.salesStartDate),
            createdAt: new Date(c.createdAt),
            milestones: c.milestones.map((m: any) => ({
              ...m,
              dueDate: new Date(m.dueDate),
              notifyDate: new Date(m.notifyDate),
              notes: (m.notes ?? []).map((note: any) => ({
                ...note,
                createdAt: new Date(note.createdAt),
                dueDate: note.dueDate ? new Date(note.dueDate) : undefined,
                notifyDate: note.notifyDate ? new Date(note.notifyDate) : undefined,
              })),
            })),
          }))
          state.solutions = state.solutions.map((s: any) => ({
            ...s,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
          }))
          // users/groups preserved as-is
        }
      },
    }
  )
)
