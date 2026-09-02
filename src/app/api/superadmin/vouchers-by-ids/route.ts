import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.getAll('ids')
  if (!ids.length) return NextResponse.json([])
  const vouchers = await prisma.voucher.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, code: true,
      dataLimitMB: true, timeLimitMin: true,
      speedLimitMbps: true, maxUsageCount: true,
      packageType: true, qrPayload: true,
    }
  })
  return NextResponse.json(vouchers)
}
