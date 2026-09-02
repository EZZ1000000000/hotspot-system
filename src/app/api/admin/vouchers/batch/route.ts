import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const p       = new URL(req.url).searchParams
  const batchId = p.get('batchId')
  const adminId = p.get('adminId')
  const status  = p.get('status')   // ALL | UNUSED | ACTIVE | DEPLETED
  const ids     = p.get('ids')      // comma-separated voucher IDs

  // طباعة بـ IDs محددة
  if (ids) {
    const idList = ids.split(',').filter(Boolean)
    const vouchers = await prisma.voucher.findMany({
      where: { id: { in: idList } },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(vouchers)
  }

  // طباعة كل كروت مكان
  if (adminId) {
    const where: any = { hotspotAdminId: adminId }
    if (status && status !== 'ALL') where.status = status
    const vouchers = await prisma.voucher.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(vouchers)
  }

  // طباعة batch محدد
  if (batchId) {
    const vouchers = await prisma.voucher.findMany({
      where: { printBatch: batchId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(vouchers)
  }

  return NextResponse.json({ error: 'batchId or adminId or ids required' }, { status: 400 })
}
