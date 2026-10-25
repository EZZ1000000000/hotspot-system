// =============================================
// wifidog Auth Handler
// stage=login    → أول تحقق بعد إدخال التوكن
// stage=counters → كل دقيقة بالبايتس التراكمية
//
// ── الإصلاح 2026-10-25: محاسبة على مستوى الكرت مش الجلسة ──
// المشكلة: لما العميل يغيّر MAC بتاعه (تغيير اسم الشبكة / موبايل جديد) ويعيد
// نفس الكرت، كانت جلسة جديدة بعداد صفري بتتسجل، والفحص كان بيقرا عداد
// الجلسة الجديدة (صفر) مش عداد الكرت الحقيقي → الكرت عمره ما يقفل!
// الحل:
//   1) الوقت دايماً يتحسب من voucher.usedAt (أول استخدام) — مش من بداية الجلسة
//   2) الداتا تتجمع على الكرت بالفارق (زيادة الـ counters عن آخر قيمة للجلسة)
//      فتغيير الـ MAC ما يصفّرش الاستهلاك
//   3) لو الكرت وصل حده → كل جلسات الكرت النشطة تتقفل فوراً (مش الجلسة الحالية بس)
//   4) لو الكرت حالته EXPIRED/DEPLETED وأي جلسة لسه شغالة → قطع فوري
//
// ── قاعدة ذهبية ──────────────────────────────
// لازم نرجع Auth: 1 أو Auth: 0 دايماً
// Auth: -1 يخلي wifidog يوقف الاتصال ويرمي error
// لو DB فشلت في counters → ارجع Auth: 1 (المستخدم يكمل)
// الجهاز الموقوف من اللوحة (isActive=false) → Auth: 0 دايماً في المرحلتين — قطع الأكسسز للعميل المتأخر
// الكرت الموقوف من الإدارة (status=DISABLED) → إنهاء الجلسة وقطع فوري برضه — من غير ما يأثر على باقي الشبكة
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
        include: { voucher: true, device: true },
      })
      if (!session) return 'Auth: 0'
      // الجهاز موقوف من اللوحة (عميل مدفّعش) → قطع فوري بغض النظر عن حالة الجلسة
      if (session.device && !session.device.isActive) return 'Auth: 0'
      if (session.status === 'ENDED') return 'Auth: 0'

      // الكرت اتوقف من الإدارة → ننهي الجلسة ونقطع — باقي الشبكة زي ما هي
      if (session.voucher && session.voucher.status === 'DISABLED') {
        const nowD = new Date()
        prisma.session.update({
          where: { id: session.id },
          data:  { status: 'ENDED', endedAt: nowD, endReason: 'ADMIN_KICK' },
        }).catch(() => {})
        return 'Auth: 0'
      }

      // الكرت خلص (EXPIRED/DEPLETED) وأي جلسة لسه شغالة → قطع فوري
      // (كانت دي ثغرة: الجلسة الجديدة بعد تغيير الـ MAC كانت بتكمل شغالة)
      if (session.voucher && (session.voucher.status === 'EXPIRED' || session.voucher.status === 'DEPLETED')) {
        const nowD = new Date()
        prisma.session.updateMany({
          where: { voucherId: session.voucherId, status: 'ACTIVE' },
          data:  { status: 'ENDED', endedAt: nowD, endReason: session.voucher.status === 'DEPLETED' ? 'DATA_DEPLETED' : 'TIME_EXPIRED' },
        }).catch(() => {})
        return 'Auth: 0'
      }

      if (session.status === 'ACTIVE') {
        const now = new Date()
        if (session.voucher && session.voucher.packageType !== 'UNLIMITED') {
          // ⏱️ الوقت من أول استخدام للكرت (voucher.usedAt) — مش من بداية الجلسة
          const timeBase   = (session.voucher as any)?.usedAt || session.startedAt
          const elapsedMin = (now.getTime() - new Date(timeBase).getTime()) / 60000
          // 📊 الداتا من إجمالي الكرت المتراكم (مش عداد الجلسة الحالية)
          const totalDataMB = session.voucher ? (session.voucher as any).dataUsedMB || 0 : (session.dataInMB + session.dataOutMB)

          const { depleted, reason } = isVoucherDepleted({
            ...session.voucher,
            dataUsedMB:  totalDataMB,
            timeUsedMin: elapsedMin,
          })

          if (depleted) {
            Promise.all([
              // قفل كل جلسات الكرت النشطة (أي MAC كان شغال بيه)
              prisma.session.updateMany({
                where: { voucherId: session.voucherId, status: 'ACTIVE' },
                data:  { status: 'ENDED', endedAt: now, endReason: reason as any, lastPingAt: now },
              }).catch(() => {}),
              prisma.session.update({
                where: { id: session.id },
                data:  { timeUsedMin: elapsedMin },
              }).catch(() => {}),
              prisma.voucher.update({
                where: { id: session.voucherId },
                data:  { status: reason === 'DATA_DEPLETED' ? 'DEPLETED' : 'EXPIRED', timeUsedMin: elapsedMin },
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
      include: { voucher: true, device: true },
    })

    if (!session) return 'Auth: 0'
    // الجهاز موقوف من اللوحة → الراوتر بيفصل العميل أول ما يعمل counters (كل 5 دقايق)
    if (session.device && !session.device.isActive) return 'Auth: 0'
    if (session.status !== 'ACTIVE') return 'Auth: 0'

    // الكرت خلص (EXPIRED/DEPLETED) → قطع فوري لأي جلسة لسه شغالة عليه
    if (session.voucher && (session.voucher.status === 'EXPIRED' || session.voucher.status === 'DEPLETED')) {
      const nowD = new Date()
      prisma.session.updateMany({
        where: { voucherId: session.voucherId, status: 'ACTIVE' },
        data:  { status: 'ENDED', endedAt: nowD, endReason: session.voucher.status === 'DEPLETED' ? 'DATA_DEPLETED' : 'TIME_EXPIRED' },
      }).catch(() => {})
      return 'Auth: 0'
    }

    // الكرت اتوقف من الإدارة → قطع في أول counters
    if (session.voucher && session.voucher.status === 'DISABLED') {
      const nowD = new Date()
      prisma.session.updateMany({
        where: { voucherId: session.voucherId, status: 'ACTIVE' },
        data:  { status: 'ENDED', endedAt: nowD, endReason: 'ADMIN_KICK' },
      }).catch(() => {})
      return 'Auth: 0'
    }

    const now         = new Date()
    const totalInMB   = bytesToMB(incoming)
    const totalOutMB  = bytesToMB(outgoing)
    const totalDataMB = totalInMB + totalOutMB

    // ⏱️ الوقت دايماً من أول استخدام للكرت (voucher.usedAt) — تغيير الـ MAC أو
    // إعادة الدخول مش بترجّع العداد للصفر. (كان دي الثغرة الأساسية)
    const timeBase = (session.voucher as any)?.usedAt || session.startedAt
    const totalTimeMin = (now.getTime() - new Date(timeBase).getTime()) / 60000

    // 📊 الداتا: الفارق بين الـ counters الجديدة وآخر قيمة محفوظة للجلسة ده
    // بيتجمع على الكرت نفسه — فلو العميل اقطع واعاد (MAC جديد بعداد صفري)
    // استهلاكه القديم يفضل محفوظ على الكرت والجديد بيتزاد عليه
    const prevSessionMB = (session.dataInMB || 0) + (session.dataOutMB || 0)
    const incrementMB   = Math.max(0, totalDataMB - prevSessionMB)
    const voucherDataUsedMB = (session.voucher ? (session.voucher as any).dataUsedMB || 0 : 0) + incrementMB

    if (session.voucher.packageType !== 'UNLIMITED') {
      const { depleted, reason } = isVoucherDepleted({
        ...session.voucher,
        dataUsedMB:  voucherDataUsedMB,
        timeUsedMin: totalTimeMin,
      })
      if (depleted) {
        Promise.all([
          // قفل كل جلسات الكرت النشطة — أي جهاز/MAC شغال بنفس الكرت يتقطع
          prisma.session.updateMany({
            where: { voucherId: session.voucherId, status: 'ACTIVE' },
            data:  { status: 'ENDED', endedAt: now, endReason: reason as any, lastPingAt: now },
          }).catch(() => {}),
          prisma.session.update({
            where: { id: session.id },
            data:  { dataInMB: totalInMB, dataOutMB: totalOutMB, timeUsedMin: totalTimeMin },
          }).catch(() => {}),
          prisma.voucher.update({
            where: { id: session.voucherId },
            data:  { status: reason === 'DATA_DEPLETED' ? 'DEPLETED' : 'EXPIRED',
                     dataUsedMB: voucherDataUsedMB, timeUsedMin: totalTimeMin },
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
        data:  { dataUsedMB: voucherDataUsedMB, timeUsedMin: totalTimeMin },
      }).catch((e) => console.error('[counters voucher update]', e)),
    ])

    return 'Auth: 1'
  } catch (err) {
    console.error('[wifidog auth counters]', err)
    return 'Auth: 1'
  }
}
