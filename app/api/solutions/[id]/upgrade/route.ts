import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isAdminRole } from '@/lib/permissions'
import { logAccessDenied, logAuditAction } from '@/lib/audit'

type TemplateStage = {
  id: string
  name: string
  role?: string
  durationDays?: number
  notifyDaysBefore?: number
  level?: number
  children?: TemplateStage[]
}

const prisma = new PrismaClient()

const flattenStages = (stages: TemplateStage[]): TemplateStage[] => {
  return stages.flatMap((stage) => [
    stage,
    ...flattenStages(stage.children ?? []),
  ])
}

/**
 * POST /api/solutions/[id]/upgrade
 * body: { customerId: string, apply?: boolean }
 * - apply=false(default): 변경 미리보기
 * - apply=true: 누락 단계 추가 + 기존 단계 메타 동기화
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: solutionId } = await params
    const body = await request.json()
    const customerId = body.customerId as string | undefined
    const apply = Boolean(body.apply)

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        milestones: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (customer.solutionId !== solutionId) {
      return NextResponse.json(
        { error: 'Customer does not belong to this solution' },
        { status: 400 }
      )
    }

    const solution = await prisma.solution.findUnique({
      where: { id: solutionId },
    })

    if (!solution) {
      return NextResponse.json({ error: 'Solution not found' }, { status: 404 })
    }

    const isAdmin = isAdminRole(session.user?.role as string)
    const isOwner = customer.ownerEmail === session.user?.email
    if (!isAdmin && !isOwner) {
      logAccessDenied({
        userId: session.user?.email,
        resourceType: 'solution',
        resourceId: solutionId,
        action: 'upgrade',
        reason: 'Only customer owner or admin can upgrade workflow template',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const parsedStages = Array.isArray(solution.stages)
      ? (solution.stages as unknown as TemplateStage[])
      : []
    const templateStages = flattenStages(parsedStages)

    const currentStageIdSet = new Set(customer.milestones.map((milestone) => milestone.stageId))
    const templateStageIdSet = new Set(templateStages.map((stage) => stage.id))

    const toAdd = templateStages.filter((stage) => !currentStageIdSet.has(stage.id))
    const stale = customer.milestones.filter((milestone) => !templateStageIdSet.has(milestone.stageId))

    if (!apply) {
      return NextResponse.json({
        customerId,
        solutionId,
        currentTemplateVersion: customer.solutionTemplateVersion ?? 1,
        latestTemplateVersion: solution.templateVersion,
        summary: {
          addCount: toAdd.length,
          staleCount: stale.length,
        },
        toAdd: toAdd.map((stage) => ({
          stageId: stage.id,
          stageName: stage.name,
          role: stage.role ?? '담당자',
          stageLevel: stage.level ?? 0,
        })),
        stale: stale.map((milestone) => ({
          id: milestone.id,
          stageId: milestone.stageId,
          stageName: milestone.stageName,
        })),
      })
    }

    const existingByStageId = new Map(customer.milestones.map((milestone) => [milestone.stageId, milestone]))

    await prisma.$transaction(async (tx) => {
      let dayCursor = 0
      const salesStartDate = customer.salesStartDate

      for (const stage of templateStages) {
        const durationDays = Number.isFinite(stage.durationDays) ? Number(stage.durationDays) : 0
        dayCursor += Math.max(durationDays, 0)

        const dueDate = new Date(salesStartDate)
        dueDate.setDate(dueDate.getDate() + dayCursor)

        const notifyDaysBefore = Number.isFinite(stage.notifyDaysBefore) ? Number(stage.notifyDaysBefore) : 0
        const notifyDate = new Date(dueDate)
        notifyDate.setDate(notifyDate.getDate() - Math.max(notifyDaysBefore, 0))

        const existing = existingByStageId.get(stage.id)
        if (existing) {
          await tx.milestone.update({
            where: { id: existing.id },
            data: {
              stageName: stage.name,
              stageLevel: stage.level ?? existing.stageLevel,
              role: stage.role ?? existing.role,
            },
          })
          continue
        }

        await tx.milestone.create({
          data: {
            customerId: customer.id,
            stageId: stage.id,
            stageName: stage.name,
            stageLevel: stage.level ?? 0,
            role: stage.role ?? '담당자',
            dueDate,
            notifyDate,
            status: 'pending',
          },
        })
      }

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          solutionTemplateVersion: solution.templateVersion,
        },
      })
    })

    logAuditAction({
      action: 'MILESTONE_EDIT',
      severity: 'info',
      success: true,
      userId: session.user?.email,
      resourceType: 'solution',
      resourceId: solutionId,
      details: {
        customerId,
        fromVersion: customer.solutionTemplateVersion ?? 1,
        toVersion: solution.templateVersion,
        addCount: toAdd.length,
        staleCount: stale.length,
      },
    })

    return NextResponse.json({
      success: true,
      customerId,
      solutionId,
      fromVersion: customer.solutionTemplateVersion ?? 1,
      toVersion: solution.templateVersion,
      addCount: toAdd.length,
      staleCount: stale.length,
    })
  } catch (error) {
    console.error('POST /api/solutions/[id]/upgrade error:', error)
    return NextResponse.json(
      { error: 'Failed to upgrade customer workflow' },
      { status: 500 }
    )
  }
}
