// GET    /api/superadmin/vouchers — جلب كروت مع فلتر
// DELETE /api/superadmin/vouchers — حذف كروت
// PATCH  /api/superadmin/vouchers — تعطيل/تفعيل
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const p       = new URL(req.url).searchParams
    const adminId = p.get('adminId')
    const status  = p.get('status')   // UNUSED|ACTIVE|DEPLETED|EXPIRED|ALL
    const page    = parseInt(p.get('page')  || '1')
    const limit   = parseInt(p.get('limit') || '200')

    const where: any = {}
    if (adminId) where.hotspotAdminId = adminId
    if (status && status !== 'ALL') {
      if (status === 'USED') where.status = { in: ['DEPLETED', 'EXPIRED'] }
      else where.status = status
    }

    const [total, vouchers] = await Promise.all([
      prisma.voucher.count({ where }),
      prisma.voucher.findMany({
        where,
        orderBy:  { createdAt: 'desc' },
        skip:     (page - 1) * limit,
        take:     limit,
        include: {
          device:       { select: { name: true } },
          hotspotAdmin: { select: { name: true, username: true } },
          _count:       { select: { sessions: true } },
        },
      }),
    ])

    return NextResponse.json({ total, page, limit, vouchers })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { ids, adminId, status } = await req.json()
    let where: any = {}

    if (ids?.length > 0) {
      where.id = { in: ids }
    } else if (adminId) {
      where.hotspotAdminId = adminId
      if (status === 'USED')      where.status = { in: ['DEPLETED', 'EXPIRED'] }
      else if (status === 'ALL')  { /* حذف كل الكروت */ }
      else if (status)            where.status = status
      else                        where.status = { in: ['DEPLETED', 'EXPIRED'] }
    } else {
      return NextResponse.json({ error: 'حدد ids أو adminId' }, { status: 400 })
    }

    // احذف الجلسات والمكافآت المرتبطة أول
    const vList = await prisma.voucher.findMany({ where, select: { id: true } })
    const vIds  = vList.map(v => v.id)
    if (!vIds.length) return NextResponse.json({ success: true, deleted: 0 })

    // حاول تحذف rewardEarnings لو الجدول موجود
    try { await (prisma as any).rewardEarning.deleteMany({ where: { voucherId: { in: vIds } } }) } catch {}
    await prisma.session.deleteMany({ where: { voucherId: { in: vIds } } })
    const result = await prisma.voucher.deleteMany({ where: { id: { in: vIds } } })

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (err: any) {
    console.error('[superadmin vouchers DELETE]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { ids, adminId, fromStatus, toStatus } = await req.json()
    let where: any = {}

    if (ids?.length > 0) {
      where.id = { in: ids }
    } else if (adminId) {
      where.hotspotAdminId = adminId
      if (fromStatus === 'USED') where.status = { in: ['DEPLETED', 'EXPIRED'] }
      else if (fromStatus)       where.status = fromStatus
    }

    if (!toStatus) return NextResponse.json({ error: 'toStatus مطلوب' }, { status: 400 })

    const result = await prisma.voucher.updateMany({ where, data: { status: toStatus } })
    return NextResponse.json({ success: true, updated: result.count })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
