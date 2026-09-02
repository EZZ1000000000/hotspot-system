// =============================================
// wifidog Auth Handler
// stage=login    → أول تحقق بعد إدخال التوكن
// stage=counters → كل دقيقة بالبايتس التراكمية
//
// ── قاعدة ذهبية ──────────────────────────────
// لازم نرجع Auth: 1 أو Auth: 0 دايماً
// Auth: -1 يخلي wifidog يوقف الاتصال ويرمي error
// لو DB فشلت في counters → ارجع Auth: 1 (المستخدم يكمل)
// =============================================
import { prisma } from '../lib/prisma'
import { isVoucherDepleted, bytesToMB } from '../lib/voucher'

export async function handleWifidogAuth(searchParams: URLSearchParams) {
  const token    = searchParams.get('token')
  const stage    = searchParams.get('stage') || ''
  const incoming = parseFloat(searchParams.get('incoming') || '0')
  const outgoing = parseFloat(searchParams.get('outgoing') || '0')

  if (!token) return 'Auth: 0'

  // ── stage=login: أول تحقق بعد إدخال التوكن ──
  if (stage === 'login') {
    try {
      const session = await prisma.session.findUnique({
        where:   { token },
        include: { voucher: true },
      })
      if (!session) return 'Auth: 0'
      if (session.status === 'ENDED') return 'Auth: 0'

      if (session.status === 'ACTIVE') {
        const now = new Date()
        if (session.voucher && session.voucher.packageType !== 'UNLIMITED') {
          const elapsedMin  = (now.getTime() - new Date(session.startedAt).getTime()) / 60000
          const totalDataMB = session.dataInMB + session.dataOutMB

          const { depleted, reason } = isVoucherDepleted({
            ...session.voucher,
            dataUsedMB:  totalDataMB,
            timeUsedMin: elapsedMin,
          })

          if (depleted) {
            Promise.all([
              prisma.session.update({
                where: { id: session.id },
                data:  { status: 'ENDED', endedAt: now, endReason: reason as any, timeUsedMin: elapsedMin, lastPingAt: now },
              }).catch(() => {}),
              prisma.voucher.update({
                where: { id: session.voucherId },
                data:  { status: reason === 'DATA_DEPLETED' ? 'DEPLETED' : 'EXPIRED' },
              }).catch(() => {}),
            ])
            return 'Auth: 0'
          }
        }

        prisma.session.update({
          where: { token },
          data:  { lastPingAt: now },
        }).catch(() => {})
        return 'Auth: 1'
      }
      return 'Auth: 0'
    } catch (err) {
      console.error('[wifidog auth login]', err)
      return 'Auth: 0'
    }
  }

  // ── stage=counters: التحديث الدوري ──
  try {
    const session = await prisma.session.findUnique({
      where:   { token },
      include: { voucher: true },
    })

    if (!session) return 'Auth: 0'
    if (session.status !== 'ACTIVE') return 'Auth: 0'

    const now         = new Date()
    const totalInMB   = bytesToMB(incoming)
    const totalOutMB  = bytesToMB(outgoing)
    const totalDataMB = totalInMB + totalOutMB
    const totalTimeMin = (now.getTime() - new Date(session.startedAt).getTime()) / 60000

    if (session.voucher.packageType !== 'UNLIMITED') {
      const { depleted, reason } = isVoucherDepleted({
        ...session.voucher,
        dataUsedMB:  totalDataMB,
        timeUsedMin: totalTimeMin,
      })
      if (depleted) {
        Promise.all([
          prisma.session.update({
            where: { id: session.id },
            data:  { status: 'ENDED', endedAt: now, endReason: reason as any,
                     dataInMB: totalInMB, dataOutMB: totalOutMB, timeUsedMin: totalTimeMin, lastPingAt: now },
          }).catch(() => {}),
          prisma.voucher.update({
            where: { id: session.voucherId },
            data:  { status: reason === 'DATA_DEPLETED' ? 'DEPLETED' : 'EXPIRED',
                     dataUsedMB: totalDataMB, timeUsedMin: totalTimeMin },
          }).catch(() => {}),
        ])
        return 'Auth: 0'
      }
    }

    Promise.all([
      prisma.session.update({
        where: { id: session.id },
        data:  { dataInMB: totalInMB, dataOutMB: totalOutMB,
                 timeUsedMin: totalTimeMin, lastPingAt: now },
      }).catch((e) => console.error('[counters session update]', e)),
      prisma.voucher.update({
        where: { id: session.voucherId },
        data:  { dataUsedMB: totalDataMB, timeUsedMin: totalTimeMin },
      }).catch((e) => console.error('[counters voucher update]', e)),
    ])

    return 'Auth: 1'
  } catch (err) {
    console.error('[wifidog auth counters]', err)
    return 'Auth: 1'
  }
}
