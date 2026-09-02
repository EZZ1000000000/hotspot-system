// GET /api/cron/expire-sessions
// بيتشغل كل دقيقة من الـ server.js
// يقفل الجلسات اللي: خلص وقتها، خلصت داتاها، أو idle أكتر من 10 دقايق

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CRON_SECRET      = process.env.CRON_SECRET || 'hotspot-cron-2024'
const MAX_IDLE_MINUTES = 10

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now     = new Date()
  const results = { expired: 0, depleted: 0, idle: 0, errors: 0 }

  try {
    const sessions = await prisma.session.findMany({
      where:   { status: 'ACTIVE' },
      include: { voucher: true },
    })

    for (const session of sessions) {
      try {
        const voucher     = session.voucher
        const elapsedMin  = (now.getTime() - new Date(session.startedAt).getTime()) / 60000
        const totalDataMB = session.dataInMB + session.dataOutMB

        // ── 1. Idle: مافيش ping من أكتر من MAX_IDLE_MINUTES ──────────
        const lastPing = session.lastPingAt
          ? new Date(session.lastPingAt)
          : new Date(session.startedAt)
        const idleMin = (now.getTime() - lastPing.getTime()) / 60000

        if (idleMin > MAX_IDLE_MINUTES) {
          // الكارت يفضل ACTIVE — المستخدم يكمل من حيث وقف
          await prisma.$transaction([
            prisma.session.update({
              where: { id: session.id },
              data:  { status: 'ENDED', endedAt: now, endReason: 'IDLE_TIMEOUT', timeUsedMin: elapsedMin },
            }),
            prisma.voucher.update({
              where: { id: voucher.id },
              data:  { dataUsedMB: totalDataMB, timeUsedMin: elapsedMin },
            }),
          ])
          results.idle++
          continue
        }

        // ── 2. UNLIMITED → مفيش فحص داتا/وقت ─────────────────────
        if (voucher.packageType === 'UNLIMITED') continue

        // ── 3. expiresAt ────────────────────────────────────────────
        if (voucher.expiresAt && now > new Date(voucher.expiresAt)) {
          await endSession(session.id, voucher.id, 'TIME_EXPIRED', 'EXPIRED',
            session.dataInMB, session.dataOutMB, elapsedMin)
          results.expired++
          continue
        }

        // ── 4. فحص الوقت ─────────────────────────────────────────────
        if (
          voucher.packageType !== 'DATA_ONLY' &&
          voucher.timeLimitMin !== null &&
          elapsedMin >= voucher.timeLimitMin
        ) {
          await endSession(session.id, voucher.id, 'TIME_EXPIRED', 'EXPIRED',
            session.dataInMB, session.dataOutMB, elapsedMin)
          results.expired++
          continue
        }

        // ── 5. فحص الداتا ─────────────────────────────────────────────
        if (
          voucher.packageType !== 'TIME_ONLY' &&
          voucher.dataLimitMB !== null &&
          totalDataMB >= voucher.dataLimitMB
        ) {
          await endSession(session.id, voucher.id, 'DATA_DEPLETED', 'DEPLETED',
            session.dataInMB, session.dataOutMB, elapsedMin)
          results.depleted++
          continue
        }

      } catch (e) {
        console.error('[cron] session error', session.id, e)
        results.errors++
      }
    }

    if (results.expired || results.depleted || results.idle || results.errors) {
      console.log(`[cron] expire-sessions: ${JSON.stringify(results)} (${sessions.length} active)`)
    }
    return NextResponse.json({ ok: true, ...results, total: sessions.length })

  } catch (err) {
    console.error('[cron] fatal', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}

async function endSession(
  sessionId:     string,
  voucherId:     string,
  endReason:     string,
  voucherStatus: string,
  dataInMB:      number,
  dataOutMB:     number,
  timeUsedMin:   number,
) {
  await prisma.$transaction([
    prisma.session.update({
      where: { id: sessionId },
      data:  { status: 'ENDED', endedAt: new Date(), endReason: endReason as any, timeUsedMin },
    }),
    prisma.voucher.update({
      where: { id: voucherId },
      data:  { status: voucherStatus as any, dataUsedMB: dataInMB + dataOutMB, timeUsedMin },
    }),
  ])
}
