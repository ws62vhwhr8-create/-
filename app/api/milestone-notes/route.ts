import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'
import { isAdminRole } from '@/lib/permissions'
import { logAuditAction, logAccessDenied } from '@/lib/audit'

const prisma = new PrismaClient()

/**
 * GET /api/milestone-notes?milestoneId={id}&parentNoteId={id}
 * 특정 마일스톤의 노트 목록 조회
 * 권한: 해당 고객에 접근 가능한 사용자
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const milestoneId = searchParams.get('milestoneId')
    const parentNoteId = searchParams.get('parentNoteId')

    if (!milestoneId) {
      return NextResponse.json(
        { error: 'milestoneId is required' },
        { status: 400 }
      )
    }

    // 마일스톤 존재 여부 및 권한 확인
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { customer: true },
    })

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    const isAdmin = isAdminRole(session.user?.role as string)
    const isOwner = milestone.customer.ownerEmail === session.user?.email

    if (!isAdmin && !isOwner) {
      logAccessDenied({
        userId: session.user?.email,
        resourceType: 'milestone',
        resourceId: milestoneId,
        action: 'view',
        reason: 'No access to this milestone',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 노트 조회
    const notes = await prisma.milestoneNote.findMany({
      where: {
        milestoneId,
        parentNoteId: parentNoteId || null,
      },
      include: {
        childNotes: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('GET /api/milestone-notes error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/milestone-notes
 * 신규 노트 생성
 * 권한: 해당 마일스톤의 고객 소유/공유 사용자
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      milestoneId,
      content,
      parentNoteId,
      ownerName,
      dueDate,
      notifyDate,
      status,
    } = body

    // 필수 필드 검증
    if (!milestoneId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 마일스톤 존재 여부 및 권한 확인
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { customer: true },
    })

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    const isAdmin = isAdminRole(session.user?.role as string)
    const isOwner = milestone.customer.ownerEmail === session.user?.email

    if (!isAdmin && !isOwner) {
      logAccessDenied({
        userId: session.user?.email,
        resourceType: 'milestone',
        resourceId: milestoneId,
        action: 'edit',
        reason: 'No access to create note for this milestone',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 신규 노트 생성
    const newNote = await prisma.milestoneNote.create({
      data: {
        milestoneId,
        content,
        parentNoteId: parentNoteId || null,
        ownerName: ownerName || session.user?.name || 'Unknown',
        dueDate: dueDate ? new Date(dueDate) : null,
        notifyDate: notifyDate ? new Date(notifyDate) : null,
        status: status || 'pending',
      },
    })

    logAuditAction({
      action: 'NOTES_ADD',
      severity: 'info',
      success: true,
      userId: session.user?.email,
      resourceType: 'milestone',
      resourceId: milestoneId,
      details: { noteId: newNote.id },
    })

    return NextResponse.json(newNote, { status: 201 })
  } catch (error) {
    console.error('POST /api/milestone-notes error:', error)
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    )
  }
}
