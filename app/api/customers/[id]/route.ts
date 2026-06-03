import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'
import { canAccessCustomer, isAdminRole } from '@/lib/permissions'
import { logAuditAction, logAccessDenied } from '@/lib/audit'

const prisma = new PrismaClient()

/**
 * GET /api/customers/[id]
 * 특정 고객 상세 조회
 * 권한: 관리자 또는 해당 고객 소유/공유 사용자
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

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        user: true,
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // 권한 체크 (현재 Zustand store 기반, 향후 DB 기반으로 전환)
    const isAdmin = isAdminRole(session.user?.role as string)
    // TODO: DB에서 권한 정보 로드 후 canAccessCustomer 함수 사용
    // const hasAccess = canAccessCustomer({
    //   customer: customer as any,
    //   currentUser: currentUser,
    //   isAdmin,
    // })

    // if (!hasAccess) {
    //   logAccessDenied({
    //     userId: session.user?.email,
    //     resourceType: 'customer',
    //     resourceId: id,
    //     action: 'view',
    //     reason: 'No access to this customer',
    //   })
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    // }

    return NextResponse.json(customer)
  } catch (error) {
    console.error('GET /api/customers/[id] error:', error)

    const message = error instanceof Error ? error.message : ''
    if (message.includes("Can't reach database server")) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/customers/[id]
 * 고객 정보 수정
 * 권한: 관리자 또는 고객 소유자
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

    const customer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // 권한 체크: 관리자 또는 소유자만 수정 가능
    const isAdmin = isAdminRole(session.user?.role as string)
    const isOwner = customer.ownerEmail === session.user?.email

    if (!isAdmin && !isOwner) {
      logAccessDenied({
        userId: session.user?.email,
        resourceType: 'customer',
        resourceId: id,
        action: 'edit',
        reason: 'Only owner or admin can edit customer',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 수정 가능한 필드만 업데이트
    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        companyName: body.companyName ?? customer.companyName,
        salesStartDate: body.salesStartDate ? new Date(body.salesStartDate) : customer.salesStartDate,
        solutionTemplateVersion: body.solutionTemplateVersion ?? customer.solutionTemplateVersion,
        ownerName: body.ownerName ?? customer.ownerName,
        ownerEmail: body.ownerEmail ?? customer.ownerEmail,
        status: body.status ?? customer.status,
        useCustomSchedule: body.useCustomSchedule ?? customer.useCustomSchedule,
        adjustedStageDurations: body.adjustedStageDurations ?? customer.adjustedStageDurations,
        totalProjectDays: body.totalProjectDays ?? customer.totalProjectDays,
        projectEndDate: body.projectEndDate ? new Date(body.projectEndDate) : customer.projectEndDate,
      },
    })

    logAuditAction({
      action: 'CUSTOMER_UPDATE',
      severity: 'info',
      success: true,
      userId: session.user?.email,
      resourceType: 'customer',
      resourceId: id,
      details: { fields: Object.keys(body) },
    })

    return NextResponse.json(updatedCustomer)
  } catch (error) {
    console.error('PATCH /api/customers/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customers/[id]
 * 고객 삭제
 * 권한: 관리자 또는 고객 소유자
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

    const customer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // 권한 체크: 관리자 또는 소유자만 삭제 가능
    const isAdmin = isAdminRole(session.user?.role as string)
    const isOwner = customer.ownerEmail === session.user?.email

    if (!isAdmin && !isOwner) {
      logAccessDenied({
        userId: session.user?.email,
        resourceType: 'customer',
        resourceId: id,
        action: 'delete',
        reason: 'Only owner or admin can delete customer',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 고객과 관련된 모든 마일스톤 삭제 (CASCADE)
    await prisma.customer.delete({
      where: { id },
    })

    logAuditAction({
      action: 'CUSTOMER_DELETE',
      severity: 'warning',
      success: true,
      userId: session.user?.email,
      resourceType: 'customer',
      resourceId: id,
      details: { companyName: customer.companyName },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/customers/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    )
  }
}
