// POST /api/setup/migrate-vouchers
// ─── نقل كروت كافيه من سيرفر قديم لسيرفر جديد مع الحفاظ على كل التفاصيل ───
// (الكود + الحالة + الاستهلاك + الصلاحية + حدود الباقة — مش كروت جديدة)
//
// الجسم: {
//   targetServer: 'gamma'|'kappa'|'dun'|'seven',
//   targetAdminId, targetDeviceId,
//   fromServer?: 'gamma'|'kappa'|'dun'|'seven',   // لو ناقص = السيرفر الحالي
//   fromAdminId?,                                  // مطلوب لو المصدر سيرفر تاني
// }
//
// - idempotent: تكرار التشغيل بيبقى نفس النتيجة (upsert بالكود) — آمن إعادة المحاولة
// - الدفعات: 2000 كارت بالمرة — عشان حجم الرد والوقت

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SERVERS: Record<string, string> = {
  gamma: 'https://hotspot-system-gamma.vercel.app',
  kappa: 'https://hotspot-system-kappa.vercel.app',
  dun:   'https://hotspot-system-dun.vercel.app',
  seven: 'https://hotspot-system-seven.vercel.app',
}

const PAGE = 2000

// الحقول اللي بننقلها من الكارت (كل تفاصيله ما عدا الـ ids والعلاقات)
function pickVoucher(v: Record<string, unknown>) {
  return {
    code:           String(v.code || '').toUpperCase().trim(),
    packageType:    (v.packageType as string)    || 'BOTH',
    voucherType:    (v.voucherType as string)    || 'STANDARD',
    dataLimitMB:    (v.dataLimitMB    as number | null) ?? null,
    timeLimitMin:   (v.timeLimitMin   as number | null) ?? null,
    speedLimitMbps: (v.speedLimitMbps as number | null) ?? null,
    maxUsageCount:  (v.maxUsageCount  as number) ?? 1,
    usageCount:     (v.usageCount     as number) ?? 0,
    dataUsedMB:     (v.dataUsedMB     as number) ?? 0,
    timeUsedMin:    (v.timeUsedMin    as number) ?? 0,
    validityDays:   (v.validityDays   as number | null) ?? null,
    expiresAt:      v.expiresAt ? new Date(v.expiresAt as string) : null,
    isRenewable:    !!v.isRenewable,
    renewCount:     (v.renewCount     as number) ?? 0,
    lastRenewedAt:  v.lastRenewedAt ? new Date(v.lastRenewedAt as string) : null,
    status:         (v.status as string) || 'UNUSED',
    usedAt:         v.usedAt ? new Date(v.usedAt as string) : null,
    printBatch:     (v.printBatch as string) || null,
    nfcPayload:     (v.nfcPayload as string) || null,
    qrPayload:      (v.qrPayload as string) || null,
    createdAt:      v.createdAt ? new Date(v.createdAt as string) : new Date(),
  }
}

async function jfetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
    headers: init?.body ? { 'Content-Type': 'application/json', ...(init?.headers || {}) } : init?.headers,
  })
  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('application/json') ? await res.json().catch(() => null) : await res.text()
  return { status: res.status, ok: res.ok, data }
}

export async function POST(req: NextRequest) {
  const started = Date.now()
  try {
    const { targetServer, targetAdminId, targetDeviceId, fromServer, fromAdminId } = await req.json()

    if (!SERVERS[targetServer]) return NextResponse.json({ error: `سيرفر هدف غير معروف: ${targetServer}` }, { status: 400 })
    if (!targetAdminId || !targetDeviceId) return NextResponse.json({ error: 'targetAdminId و targetDeviceId مطلوبين' }, { status: 400 })

    const selfKey = ((process.env.NEXT_PUBLIC_SERVER_URL || '').includes('hotspot-system-'))
      ? (SERVERS.gamma === process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/$/, '') ? 'gamma'
        : SERVERS.kappa === process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/$/, '') ? 'kappa'
        : SERVERS.dun   === process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/$/, '') ? 'dun'
        : 'seven')
      : undefined
    const sourceIsSelf = !fromServer || fromServer === selfKey
    if (!sourceIsSelf && !SERVERS[fromServer]) return NextResponse.json({ error: `سيرفر مصدر غير معروف: ${fromServer}` }, { status: 400 })
    if (!sourceIsSelf && !fromAdminId) return NextResponse.json({ error: 'fromAdminId مطلوب لما المصدر سيرفر تاني' }, { status: 400 })

    const targetBase = SERVERS[targetServer]
    const sourceBase = sourceIsSelf ? null : SERVERS[fromServer]

    // 1) اقرأ الكروت من المصدر صفحة صفحة + ابعتها فوراً للهدف (مفيش انتظار تحميل الكل)
    let page = 1
    let total = 0
    let created = 0
    let updated = 0
    let sourceTotal: number | null = null

    while (true) {
      // ── اقرأ دفعة من المصدر ──
      let rows: Record<string, unknown>[]
      if (sourceIsSelf) {
        rows = await prisma.voucher.findMany({
          where: { hotspotAdminId: fromAdminId || targetAdminId },
          orderBy: { createdAt: 'asc' },
          skip: (page - 1) * PAGE,
          take: PAGE,
        })
        if (sourceTotal === null) sourceTotal = await prisma.voucher.count({ where: { hotspotAdminId: fromAdminId || targetAdminId } })
      } else {
        const r = await jfetch(`${sourceBase}/api/superadmin/vouchers?adminId=${fromAdminId}&status=ALL&limit=${PAGE}&page=${page}`)
        if (!r.ok || !(r.data as { vouchers?: unknown[] })?.vouchers)
          return NextResponse.json({ error: `فشل قراءة الكروت من السيرفر القديم (صفحة ${page})` }, { status: 502 })
        rows = (r.data as { vouchers: Record<string, unknown>[] }).vouchers
        if (sourceTotal === null) sourceTotal = (r.data as { total: number }).total
      }
      if (rows.length === 0) break

      // ── ابعت الدفعة للهدف (receiver بعمل upsert) ──
      const payload = {
        hotspotAdminId: targetAdminId,
        deviceId:       targetDeviceId,
        vouchers:       rows.map(pickVoucher),
      }
      const pr = await jfetch(`${targetBase}/api/superadmin/migrate-vouchers`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!pr.ok)
        return NextResponse.json({ error: `فشل كتابة الدفعة ${page} على السيرفر الهدف: ${JSON.stringify(pr.data).slice(0, 200)}` }, { status: 502 })

      created += ((pr.data as { created?: number })?.created) || 0
      updated += ((pr.data as { updated?: number })?.updated) || 0
      total   += rows.length

      if (sourceTotal !== null && total >= sourceTotal) break
      if (rows.length < PAGE) break
      page++
      if (Date.now() - started > 50_000) break // سيب الباقي لإعادة تشغيل (idempotent)
    }

    return NextResponse.json({
      success: true,
      total,
      created,
      updated,
      sourceTotal,
      remaining: sourceTotal !== null ? Math.max(0, sourceTotal - total) : 0,
      elapsedSec: Math.round((Date.now() - started) / 1000),
      message: total === 0
        ? 'مفيش كروت للنقل — الكافيه كان فاضي'
        : `✅ اتنقل ${total} كارت (جديد: ${created} — موجود واتحدث: ${updated})`,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
