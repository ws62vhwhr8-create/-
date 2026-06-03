import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'
import { isAdminRole } from '@/lib/permissions'
import { logAuditAction, logAccessDenied } from '@/lib/audit'

const prisma = new PrismaClient()

/**
 * PATCH /api/milestone-notes/[id]
 * 노트 수정
 * 권한: 해당 마일스톤의 고객 소유/공유 사용자
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

    const note = await prisma.milestoneNote.findUnique({
      where: { id },
      include: {
        milestone: {
          include: { customer: true },
        },
      },
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // 권한 체크
    const isAdmin = isAdminRole(session.user?.role as string)
    const isOwner = note.milestone.customer.ownerEmail === session.user?.email

    if (!isAdmin && !isOwner) {
      logAccessDenied({
        userId: session.user?.email,
        resourceType: 'milestone',
        resourceId: note.milestoneId,
        action: 'edit',
        reason: 'No access to edit this note',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 수정 가능한 필드만 업데이트
    const updatedNote = await prisma.milestoneNote.update({
      where: { id },
      data: {
        content: body.content ?? note.content,
        ownerName: body.ownerName ?? note.ownerName,
        dueDate: body.dueDate ? new Date(body.dueDate) : note.dueDate,
        notifyDate: body.notifyDate ? new Date(body.notifyDate) : note.notifyDate,
        status: body.status ?? note.status,
      },
    })

    logAuditAction({
      action: 'NOTES_EDIT',
      severity: 'info',
      success: true,
      userId: session.user?.email,
      resourceType: 'milestone',
      resourceId: note.milestoneId,
      details: { noteId: id, fields: Object.keys(body) },
    })

    return NextResponse.json(updatedNote)
  } catch (error) {
    console.error('PATCH /api/milestone-notes/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/milestone-notes/[id]
 * 노트 삭제
 * 권한: 해당 마일스톤의 고객 소유/공유 사용자
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

    const note = await prisma.milestoneNote.findUnique({
      where: { id },
      include: {
        milestone: {
          include: { customer: true },
        },
      },
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // 권한 체크
    const isAdmin = isAdminRole(session.user?.role as string)
    const isOwner = note.milestone.customer.ownerEmail === session.user?.email

    if (!isAdmin && !isOwner) {
      logAccessDenied({
        userId: session.user?.email,
        resourceType: 'milestone',
        resourceId: note.milestoneId,
        action: 'delete',
        reason: 'No access to delete this note',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 노트와 관련된 모든 자식 노트 삭제 (CASCADE)
    await prisma.milestoneNote.delete({
      where: { id },
    })

    logAuditAction({
      action: 'NOTES_DELETE',
      severity: 'warning',
      success: true,
      userId: session.user?.email,
      resourceType: 'milestone',
      resourceId: note.milestoneId,
      details: { noteId: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/milestone-notes/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    )
  }
}
