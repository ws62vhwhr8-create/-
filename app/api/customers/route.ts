import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { Prisma, PrismaClient } from '@prisma/client'
import { canAccessCustomer, isAdminRole } from '@/lib/permissions'
import { logAuditAction, logAccessDenied } from '@/lib/audit'
import type { Customer, User } from '@/lib/types'

const prisma = new PrismaClient()

function mapPrismaErrorToResponse(error: unknown, defaultMessage: string) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json(
      {
        error: '데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
        code: 'DB_UNAVAILABLE',
      },
      { status: 503 }
    )
  }

  return NextResponse.json({ error: defaultMessage }, { status: 500 })
}

/**
 * GET /api/customers
 * 현재 사용자가 접근 가능한 고객 목록 조회
 * 관리자: 모든 고객 조회
 * 일반 사용자: 본인이 소유하거나 공유받은 고객만 조회
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const currentUserEmail = session.user?.email || ""
    const isAdmin = isAdminRole(session.user?.role as string)

    // 관리자면 모든 고객 조회, 아니면 소유/공유 고객만 조회
    const customers = isAdmin
      ? await prisma.customer.findMany({
          include: {
            user: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : await prisma.customer.findMany({
          where: {
            OR: [
              { user: { email: currentUserEmail } }, // 소유한 고객
              // TODO: sharedUserIds, sharedGroupIds 필터 추가 (DB 스키마 추가 필요)
            ],
          },
          include: {
            user: true,
          },
          orderBy: { createdAt: 'desc' },
        })

    // 응답 형식: Zustand store와 호환되는 Customer 타입으로 변환
    const response = customers.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      solutionId: c.solutionId,
      solutionName: c.solutionName,
      solutionTemplateVersion: c.solutionTemplateVersion,
      salesStartDate: c.salesStartDate,
      ownerId: c.userId,
      ownerName: c.ownerName,
      ownerEmail: c.ownerEmail,
      milestones: [], // TODO: 마일스톤은 별도 API로 조회
      createdAt: c.createdAt,
      status: c.status,
      sharedUserIds: [], // TODO: DB에서 로드
      sharedGroupIds: [], // TODO: DB에서 로드
      useCustomSchedule: c.useCustomSchedule,
      adjustedStageDurations: c.adjustedStageDurations,
      totalProjectDays: c.totalProjectDays,
      projectEndDate: c.projectEndDate,
    }))

    logAuditAction({
      action: 'CUSTOMER_CREATE', // TODO: 더 정확한 action 명 필요
      severity: 'info',
      success: true,
      userId: session.user?.email,
      details: { count: response.length },
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET /api/customers error:', error)
    return mapPrismaErrorToResponse(error, 'Failed to fetch customers')
  }
}

/**
 * POST /api/customers
 * 신규 고객 생성
 * 권한: 인증된 모든 사용자 (기본적으로 생성자가 소유자)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      companyName,
      solutionId,
      solutionName,
      salesStartDate,
      ownerName,
      ownerEmail,
      ownerId,
      solutionTemplateVersion,
      useCustomSchedule,
      adjustedStageDurations,
      totalProjectDays,
      projectEndDate,
      allowDuplicate,
    } = body

    // 필수 필드 검증
    if (!companyName || !solutionId || !solutionName || !salesStartDate || !ownerName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const normalizedCompanyName = String(companyName).trim()
    const normalizedOwnerName = String(ownerName).trim()
    const parsedSalesStartDate = new Date(salesStartDate)

    if (!normalizedCompanyName || !normalizedOwnerName || Number.isNaN(parsedSalesStartDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid field values' },
        { status: 400 }
      )
    }

    if (!allowDuplicate) {
      const duplicateCount = await prisma.customer.count({
        where: {
          companyName: {
            equals: normalizedCompanyName,
            mode: 'insensitive',
          },
        },
      })

      if (duplicateCount > 0) {
        return NextResponse.json(
          {
            error: '동일한 고객사명이 이미 존재합니다. 계속 등록할까요?',
            code: 'DUPLICATE_COMPANY',
            duplicateCount,
          },
          { status: 409 }
        )
      }
    }

    // 신규 고객 생성
    const newCustomer = await prisma.customer.create({
      data: {
        companyName: normalizedCompanyName,
        solutionId,
        solutionName,
        solutionTemplateVersion: solutionTemplateVersion ?? 1,
        salesStartDate: parsedSalesStartDate,
        ownerName: normalizedOwnerName,
        ownerEmail: ownerEmail || session.user?.email,
        userId: ownerId || undefined,
        status: 'active',
        useCustomSchedule,
        adjustedStageDurations,
        totalProjectDays,
        projectEndDate: projectEndDate ? new Date(projectEndDate) : null,
      },
    })

    logAuditAction({
      action: 'CUSTOMER_CREATE',
      severity: 'info',
      success: true,
      userId: session.user?.email,
      resourceType: 'customer',
      resourceId: newCustomer.id,
      details: { companyName: newCustomer.companyName },
    })

    return NextResponse.json(newCustomer, { status: 201 })
  } catch (error) {
    console.error('POST /api/customers error:', error)
    logAuditAction({
      action: 'CUSTOMER_CREATE',
      severity: 'error',
      success: false,
      userId: session.user?.email,
      reason: error instanceof Error ? error.message : 'Unknown error',
    })
    return mapPrismaErrorToResponse(error, 'Failed to create customer')
  }
}
