import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const p       = new URL(req.url).searchParams
  const adminId = p.get('adminId')
  const status  = p.get('status')  // UNUSED | ACTIVE | DEPLETED | EXPIRED | ALL
  const page    = parseInt(p.get('page') || '1')
  const limit   = parseInt(p.get('limit') || '200')

  if (!adminId) return NextResponse.json({ error: 'adminId required' }, { status: 400 })

  const where: any = { hotspotAdminId: adminId }
  if (status && status !== 'ALL') where.status = status

  const vouchers = await prisma.voucher.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })
  return NextResponse.json(vouchers)
}
