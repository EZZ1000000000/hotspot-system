// POST /api/portal/sales-order  — طلب شراء باقة من البورتال
// GET  /api/portal/sales-order?gwId=GW-xxx  — طلبات جهاز معين
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { gwId, packageId, packageName, price, customerName, customerPhone, note } = await req.json()

    let deviceInfo: any = null
    if (gwId) {
      deviceInfo = await prisma.device.findUnique({
        where: { gatewayId: gwId },
        include: { hotspotAdmin: { select: { id: true, name: true } } },
      }).catch(() => null)
    }

    await prisma.auditLog.create({
      data: {
        action:     'SALES_REQUEST',
        entityType: 'SalesRequest',
        entityId:   gwId || 'unknown',
        actorType:  'CUSTOMER',
        actorId:    customerPhone || customerName || 'anonymous',
        details: JSON.stringify({
          gwId,
          packageId,
          packageName,
          price,
          customerName:  customerName  || null,
          customerPhone: customerPhone || null,
          note:          note          || null,
          deviceName:    deviceInfo?.name               || null,
          adminId:       deviceInfo?.hotspotAdmin?.id   || null,
          adminName:     deviceInfo?.hotspotAdmin?.name || null,
          requestedAt:   new Date().toISOString(),
        }),
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[portal/sales-order]', e)
    return NextResponse.json({ ok: true }) // دايماً ok للـ UX
  }
}

export async function GET(req: NextRequest) {
  try {
    const p     = new URL(req.url).searchParams
    const gwId  = p.get('gwId')
    const limit = parseInt(p.get('limit') || '100')
    const where: any = { action: 'SALES_REQUEST', entityType: 'SalesRequest' }
    if (gwId) where.entityId = gwId
    const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit })
    return NextResponse.json(logs.map(l => {
      let d: any = {}
      if (l.details) { try { d = JSON.parse(l.details) } catch { d = {} } }
      return {
        id: l.id,
        createdAt: l.createdAt,
        ...d,
      }
    }))
  } catch { return NextResponse.json([]) }
}
