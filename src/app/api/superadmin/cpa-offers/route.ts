// GET /api/superadmin/cpa-offers — جلب العروض المخزنة
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const source   = searchParams.get('source') || undefined
    const page     = parseInt(searchParams.get('page') || '1')
    const limit    = parseInt(searchParams.get('limit') || '50')
    const skip     = (page - 1) * limit

    const where = source ? { source, isActive: true } : { isActive: true }
    const [offers, total] = await Promise.all([
      prisma.cpaOffer.findMany({ where, orderBy: { payout: 'desc' }, skip, take: limit }),
      prisma.cpaOffer.count({ where }),
    ])
    return NextResponse.json({ offers, total, page, pages: Math.ceil(total / limit) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
