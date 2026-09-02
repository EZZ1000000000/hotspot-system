// POST /api/session/keepalive
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isVoucherDepleted } from '@/lib/voucher'

export async function POST(req: NextRequest) {
  try {
    const { token, disconnect } = await req.json()
    if (!token) return NextResponse.json({ ok: false }, { status: 400 })

    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        voucher: {
          select: {
            id: true, dataLimitMB: true, timeLimitMin: true,
            dataUsedMB: true, timeUsedMin: true,
            status: true, packageType: true, expiresAt: true,
            usedAt: true, // أول وقت استخدام الكارت
          },
        },
      },
    })

    if (!session || session.status !== 'ACTIVE')
      return NextResponse.json({ ok: false, ended: true, reason: 'SESSION_NOT_FOUND' })

    const now = new Date()

    // ── قطع يدوي من المستخدم ─────────────────────────────────────────
    if (disconnect) {
      await prisma.$transaction([
        // أنهِ الجلسة
        prisma.session.update({
          where: { id: session.id },
          data: { status: 'ENDED', endedAt: now, endReason: 'USER_LOGOUT' },
        }),
        // الكارت يفضل ACTIVE (مش UNUSED) — عشان لما يرجع يكمل من حيث وقف
        // الاستهلاك محفوظ في dataUsedMB و timeUsedMin
        prisma.voucher.update({
          where: { id: session.voucherId },
          data: { status: 'ACTIVE' },
        }),
      ])
      return NextResponse.json({ ok: true, ended: true, reason: 'USER_LOGOUT' })
    }

    // ── فحص انتهاء الباقة (backup للـ auth-handler) ─────────────────
    const { depleted, reason } = isVoucherDepleted(session.voucher)
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
      return NextResponse.json({ ok: false, ended: true, reason })
    }

    // ── تحديث lastPingAt ─────────────────────────────────────────────
    await prisma.session.update({
      where: { id: session.id },
      data:  { lastPingAt: now },
    })

    // ── احسب الوقت من usedAt (أول ضرب للكارت) لا من startedAt ─────────
    // usedAt = اللحظة اللي اتضرب فيها الكارت لأول مرة — ثابت مش بيتغير
    const cardStartTime = session.voucher.usedAt
      ? new Date(session.voucher.usedAt)
      : new Date(session.startedAt)
    const elapsedSec   = Math.floor((now.getTime() - cardStartTime.getTime()) / 1000)
    const totalDataMB  = session.dataInMB + session.dataOutMB
    const timeLimitSec = session.voucher.timeLimitMin ? session.voucher.timeLimitMin * 60 : null
    const remainingSec = timeLimitSec ? Math.max(0, timeLimitSec - elapsedSec) : null

    return NextResponse.json({
      ok:          true,
      ended:       false,
      mac:         session.macAddress,
      dataUsedMB:  totalDataMB,
      timeUsedMin: elapsedSec / 60,
      remainingSec,
    })
  } catch (err) {
    console.error('[keepalive]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
