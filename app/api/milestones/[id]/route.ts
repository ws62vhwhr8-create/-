import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'
import { isAdminRole } from '@/lib/permissions'
import { logAuditAction, logAccessDenied } from '@/lib/audit'

const prisma = new PrismaClient()

/**
 * GET /api/milestones/[id]
 * 특정 마일스톤 상세 조회
 * 권한: 해당 고객에 접근 가능한 사용자
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: {
        customer: true,
        notes: true,
      },
    })

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    // 권한 체크
    const isAdmin = isAdminRole(session.user?.role as string)
    const isOwner = milestone.customer.ownerEmail === session.user?.email

    if (!isAdmin && !isOwner) {
      logAccessDenied({
        userId: session.user?.email,
        resourceType: 'milestone',
        resourceId: id,
        action: 'view',
        reason: 'No access to this milestone',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(milestone)
  } catch (error) {
    console.error('GET /api/milestones/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch milestone' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/milestones/[id]
 * 마일스톤 수정
 * 권한: 해당 고객의 소유/공유 사용자
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: { customer: true },
    })

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    // 권한 체크
    const isAdmin = isAdminRole(session.user?.role as string)
    const isOwner = milestone.customer.ownerEmail === session.user?.email

    if (!isAdmin && !isOwner) {
      logAccessDenied({
        userId: session.user?.email,
        resourceType: 'milestone',
        resourceId: id,
        action: 'edit',
        reason: 'No access to edit this milestone',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 수정 가능한 필드만 업데이트
    const updatedMilestone = await prisma.milestone.update({
      where: { id },
      data: {
        stageName: body.stageName ?? milestone.stageName,
        stageLevel: body.stageLevel ?? milestone.stageLevel,
        dueDate: body.dueDate ? new Date(body.dueDate) : milestone.dueDate,
        notifyDate: body.notifyDate ? new Date(body.notifyDate) : milestone.notifyDate,
        role: body.role ?? milestone.role,
        status: body.status ?? milestone.status,
        useCustomSchedule: body.useCustomSchedule ?? milestone.useCustomSchedule,
        adjustedStageDurations: body.adjustedStageDurations ?? milestone.adjustedStageDurations,
      },
    })

    logAuditAction({
      action: 'MILESTONE_EDIT',
      severity: 'info',
      success: true,
      userId: session.user?.email,
      resourceType: 'milestone',
      resourceId: id,
      details: { fields: Object.keys(body) },
    })

    return NextResponse.json(updatedMilestone)
  } catch (error) {
    console.error('PATCH /api/milestones/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update milestone' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/milestones/[id]
 * 마일스톤 삭제
 * 권한: 해당 고객의 소유/공유 사용자
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: { customer: true },
    })

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    // 권한 체크
    const isAdmin = isAdminRole(session.user?.role as string)
    const isOwner = milestone.customer.ownerEmail === session.user?.email

    if (!isAdmin && !isOwner) {
      logAccessDenied({
        userId: session.user?.email,
        resourceType: 'milestone',
        resourceId: id,
        action: 'delete',
        reason: 'No access to delete this milestone',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 마일스톤과 관련된 모든 노트 삭제 (CASCADE)
    await prisma.milestone.delete({
      where: { id },
    })

    logAuditAction({
      action: 'MILESTONE_DELETE',
      severity: 'warning',
      success: true,
      userId: session.user?.email,
      resourceType: 'milestone',
      resourceId: id,
      details: { stageName: milestone.stageName },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/milestones/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to delete milestone' },
      { status: 500 }
    )
  }
}
