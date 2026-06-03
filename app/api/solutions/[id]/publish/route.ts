import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isAdminRole } from '@/lib/permissions'
import { logAccessDenied, logAuditAction } from '@/lib/audit'

const prisma = new PrismaClient()

/**
 * POST /api/solutions/[id]/publish
 * 솔루션 템플릿 버전을 1 증가시킨다.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = isAdminRole(session.user?.role as string)
  if (!isAdmin) {
    const { id } = await params
    logAccessDenied({
      userId: session.user?.email,
      resourceType: 'solution',
      resourceId: id,
      action: 'publish',
      reason: 'Only admin can publish template version',
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params

    const solution = await prisma.solution.findUnique({ where: { id } })
    if (!solution) {
      return NextResponse.json({ error: 'Solution not found' }, { status: 404 })
    }

    const updated = await prisma.solution.update({
      where: { id },
      data: {
        templateVersion: solution.templateVersion + 1,
        lastPublishedAt: new Date(),
      },
    })

    logAuditAction({
      action: 'MILESTONE_EDIT',
      severity: 'info',
      success: true,
      userId: session.user?.email,
      resourceType: 'solution',
      resourceId: id,
      details: {
        publishedTemplateVersion: updated.templateVersion,
      },
    })

    return NextResponse.json({
      id: updated.id,
      templateVersion: updated.templateVersion,
      updatedAt: updated.updatedAt,
      lastPublishedAt: updated.lastPublishedAt,
    })
  } catch (error) {
    console.error('POST /api/solutions/[id]/publish error:', error)

    const message = error instanceof Error ? error.message : ''
    if (message.includes("Can't reach database server")) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to publish template version' },
      { status: 500 }
    )
  }
}
