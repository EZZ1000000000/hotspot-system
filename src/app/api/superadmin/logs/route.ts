// GET /api/superadmin/logs — سجل العمليات الكامل
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page       = parseInt(searchParams.get('page') || '1')
    const limit      = parseInt(searchParams.get('limit') || '50')
    const action     = searchParams.get('action') || undefined
    const entityType = searchParams.get('entityType') || undefined
    const actorType  = searchParams.get('actorType') || undefined
    const search     = searchParams.get('search') || ''
    const skip       = (page - 1) * limit

    const where: any = {}
    if (action)     where.action     = { contains: action, mode: 'insensitive' }
    if (entityType) where.entityType = entityType
    if (actorType)  where.actorType  = actorType
    if (search)     where.OR = [
      { action:     { contains: search, mode: 'insensitive' } },
      { entityType: { contains: search, mode: 'insensitive' } },
      { actorId:    { contains: search, mode: 'insensitive' } },
    ]

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.auditLog.count({ where }),
    ])

    // إحصائيات سريعة
    const stats = await prisma.auditLog.groupBy({
      by: ['action'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })

    return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit), stats })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
