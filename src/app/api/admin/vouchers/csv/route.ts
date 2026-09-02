// GET /api/admin/vouchers/csv?adminId=xxx&status=UNUSED
// بيرجع CSV file للكروت
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const p       = new URL(req.url).searchParams
  const adminId = p.get('adminId')
  const status  = p.get('status')

  if (!adminId) return NextResponse.json({ error: 'adminId required' }, { status: 400 })

  const where: any = { hotspotAdminId: adminId }
  if (status && status !== 'ALL') where.status = status

  const vouchers = await prisma.voucher.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })

  const fmtData = (mb: number | null) => !mb ? 'unlimited' : mb >= 1024 ? (mb/1024).toFixed(1)+'GB' : mb+'MB'
  const fmtTime = (min: number | null) => !min ? 'unlimited' : min >= 60 ? Math.floor(min/60)+'h'+(min%60?min%60+'m':'') : min+'m'

  const header = ['Code','Status','Package','Data Limit','Time Limit','Speed (Mbps)','Data Used','Time Used','Created At','Expires At']
  const rows = vouchers.map(v => [
    v.code,
    v.status,
    v.packageType,
    fmtData(v.dataLimitMB),
    fmtTime(v.timeLimitMin),
    v.speedLimitMbps ?? '',
    fmtData(v.dataUsedMB || null),
    fmtTime(v.timeUsedMin ? Math.round(v.timeUsedMin) : null),
    new Date(v.createdAt).toISOString().slice(0,16).replace('T',' '),
    v.expiresAt ? new Date(v.expiresAt).toISOString().slice(0,16).replace('T',' ') : '',
  ])

  const csv = [header, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(','))
    .join('\r\n')

  const filename = `vouchers-${status||'all'}-${new Date().toISOString().slice(0,10)}.csv`

  return new NextResponse('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
