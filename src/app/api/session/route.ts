// GET /api/session?token=XXX
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isVoucherDepleted } from '@/lib/voucher'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token مطلوب' }, { status: 400 })

  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        voucher: {
          select: {
            id: true, code: true,
            dataLimitMB: true, timeLimitMin: true,
            speedLimitMbps: true, dataUsedMB: true,
            timeUsedMin: true, status: true,
            packageType: true, expiresAt: true,
            usedAt: true,
          },
        },
        device: {
          select: { name: true, wifiSSID: true, description: true },
        },
      },
    })

    if (!session)
      return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 })

    if (session.status !== 'ACTIVE')
      return NextResponse.json({ status: 'ENDED', endReason: session.endReason })

    const now = new Date()

    // ✅ الوقت والداتا بيتحسبوا من session بتاع الجهاز ده بس
    const elapsedSec      = Math.floor((now.getTime() - new Date(session.startedAt).getTime()) / 1000)
    const dataInMB        = session.dataInMB
    const dataOutMB       = session.dataOutMB
    const totalDataMB     = dataInMB + dataOutMB
    const timeLimitSec    = session.voucher.timeLimitMin ? session.voucher.timeLimitMin * 60 : null
    const remainingSec    = timeLimitSec ? Math.max(0, timeLimitSec - elapsedSec) : null
    const dataLimitMB     = session.voucher.dataLimitMB ?? null
    const remainingDataMB = dataLimitMB ? Math.max(0, dataLimitMB - totalDataMB) : null

    // فحص انتهاء الجلسة
    const { depleted, reason } = isVoucherDepleted({
      ...session.voucher,
      dataUsedMB:  totalDataMB,
      timeUsedMin: elapsedSec / 60,
    })

    if (depleted) {
      await prisma.$transaction([
        prisma.session.update({
          where: { id: session.id },
          data: { status: 'ENDED', endedAt: now, endReason: reason as any },
        }),
        prisma.voucher.update({
          where: { id: session.voucherId },
          data: { status: reason === 'DATA_DEPLETED' ? 'DEPLETED' : 'EXPIRED' },
        }),
      ])
      return NextResponse.json({ status: 'ENDED', endReason: reason })
    }

    let portalSettings: any = {}
    try { if (session.device?.description) portalSettings = JSON.parse(session.device.description) } catch {}

    return NextResponse.json({
      status:         'ACTIVE',
      token,
      voucherId:      session.voucher.id,
      voucherCode:    session.voucher.code,
      macAddress:     session.macAddress,
      wifiName:       session.device?.wifiSSID || portalSettings.wifiName  || 'WiFi',
      placeName:      session.device?.name     || portalSettings.placeName || 'Hotspot',
      packageType:    session.voucher.packageType,
      startedAt:      session.startedAt,
      elapsedSec,
      timeLimitSec,
      remainingSec,
      dataInMB,
      dataOutMB,
      totalDataMB,
      dataLimitMB,
      remainingDataMB,
      speedLimitMbps: session.voucher.speedLimitMbps,
      lastPingAt:     session.lastPingAt,
    })
  } catch (err) {
    console.error('[session GET]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
