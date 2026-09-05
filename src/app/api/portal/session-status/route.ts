// GET /api/portal/session-status?token=XXX
// حالة الجلسة المختصرة — بتتقرا من الراوتر (عن طريق جسر CGI)
// بترجع HTTP 200 دايماً لأن wget/uclient-fetch على الراوتر مش بيقرا body غير الـ 200
// بتعيد نفس معادلات الإنفورسمنت بالظبط (auth-handler) عشان الأرقام تطابق قطع النت
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ found: false })

  try {
    const session = await prisma.session.findUnique({
      where:   { token },
      include: {
        voucher: {
          select: {
            code:           true,
            packageType:    true,
            dataLimitMB:    true,
            timeLimitMin:   true,
            speedLimitMbps: true,
          },
        },
      },
    })
    if (!session) return NextResponse.json({ found: false })

    const now        = new Date()
    const elapsedMin = Math.max(0, (now.getTime() - new Date(session.startedAt).getTime()) / 60000)
    const totalDataMB = session.dataInMB + session.dataOutMB
    const v = session.voucher

    const isUnlimited = v?.packageType === 'UNLIMITED'
    const timeLimitMin = !isUnlimited ? v?.timeLimitMin ?? null : null
    const dataLimitMB  = !isUnlimited ? v?.dataLimitMB  ?? null : null
    const remainingMin = timeLimitMin != null ? Math.max(0, timeLimitMin - elapsedMin) : null
    const remainingMB  = dataLimitMB  != null ? Math.max(0, dataLimitMB  - totalDataMB) : null

    return NextResponse.json({
      found:        true,
      status:       session.status,
      endReason:    session.endReason || null,
      voucherCode:  v?.code || '',
      packageType:  v?.packageType || 'BOTH',
      startedAt:    session.startedAt,
      elapsedMin:   Math.round(elapsedMin * 10) / 10,
      timeLimitMin: timeLimitMin,
      remainingMin: remainingMin != null ? Math.round(remainingMin * 10) / 10 : null,
      dataUsedMB:   Math.round(totalDataMB * 10) / 10,
      dataLimitMB:  dataLimitMB,
      remainingMB:  remainingMB != null ? Math.round(remainingMB * 10) / 10 : null,
      speedLimitMbps: v?.speedLimitMbps ?? null,
    })
  } catch {
    return NextResponse.json({ found: false })
  }
}
