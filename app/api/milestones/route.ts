import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'
import { isAdminRole } from '@/lib/permissions'
import { logAuditAction, logAccessDenied } from '@/lib/audit'

const prisma = new PrismaClient()

/**
 * GET /api/milestones?customerId={id}
 * 특정 고객의 마일스톤 목록 조회
 * 권한: 고객에 접근 가능한 사용자
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      )
    }

    // 고객 존재 여부 확인
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // 권한 체크: 현재는 간단하게 구현, 추후 store 기반으로 확인
    const isAdmin = isAdminRole(session.user?.role as string)
    const isOwner = customer.ownerEmail === session.user?.email

    if (!isAdmin && !isOwner) {
      logAccessDenied({
        userId: session.user?.email,
        resourceType: 'customer',
        resourceId: customerId,
        action: 'view',
        reason: 'No access to this customer',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 마일스톤 조회
    const milestones = await prisma.milestone.findMany({
      where: { customerId },
      include: {
        notes: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    // 응답 형식 변환
    const response = milestones.map((m) => ({
      id: m.id,
      stageId: m.stageId,
      stageName: m.stageName,
      stageLevel: m.stageLevel,
      dueDate: m.dueDate,
      notifyDate: m.notifyDate,
      role: m.role,
      status: m.status,
      notes: m.notes || [],
      useCustomSchedule: m.useCustomSchedule,
      adjustedStageDurations: m.adjustedStageDurations,
    }))

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET /api/milestones error:', error)

    const message = error instanceof Error ? error.message : ''
    if (message.includes("Can't reach database server")) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch milestones' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/milestones
 * 신규 마일스톤 생성
 * 권한: 해당 고객 소유/공유 사용자
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      customerId,
      stageId,
      stageName,
      stageLevel,
      dueDate,
      notifyDate,
      role,
      status,
      useCustomSchedule,
      adjustedStageDurations,
    } = body

    // 필수 필드 검증
    if (!customerId || !stageId || !stageName || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 고객 존재 여부 및 권한 확인
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const isAdmin = isAdminRole(session.user?.role as string)
    const isOwner = customer.ownerEmail === session.user?.email

    if (!isAdmin && !isOwner) {
      logAccessDenied({
        userId: session.user?.email,
        resourceType: 'customer',
        resourceId: customerId,
        action: 'edit',
        reason: 'No access to create milestone for this customer',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 신규 마일스톤 생성
    const newMilestone = await prisma.milestone.create({
      data: {
        customerId,
        stageId,
        stageName,
        stageLevel: stageLevel || 0,
        dueDate: new Date(dueDate),
        notifyDate: new Date(notifyDate),
        role: role || '담당자',
        status: status || 'pending',
        useCustomSchedule,
        adjustedStageDurations,
      },
    })

    logAuditAction({
      action: 'MILESTONE_EDIT', // 실제로는 생성
      severity: 'info',
      success: true,
      userId: session.user?.email,
      resourceType: 'milestone',
      resourceId: newMilestone.id,
      details: { customerId, stageName },
    })

    return NextResponse.json(newMilestone, { status: 201 })
  } catch (error) {
    console.error('POST /api/milestones error:', error)
    return NextResponse.json(
      { error: 'Failed to create milestone' },
      { status: 500 }
    )
  }
}
