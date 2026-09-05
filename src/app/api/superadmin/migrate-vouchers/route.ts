// POST /api/superadmin/migrate-vouchers
// ─── استقبال كروت منتهية النقل من سيرفر تاني (جزء من خاصية تبديل السيرفرات) ───
//
// بيستقبل كروت كاملة بالتفاصيل (الكود + الحالة + الاستهلاك + الصلاحية) ويعمل upsert:
// - كود جديد → ينشئه بكل تفاصيله زي ما هو
// - كود موجود → يحدثه بتفاصيل المصدر (وينسب للكافيه الهدف)
// - idempotent: إعادة الإرسال آمنة
//
// الجسم: { hotspotAdminId, deviceId, vouchers: [{ code, packageType, ..., expiresAt, status, ... }] }

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BATCH = 3000

type VIn = Record<string, unknown>

function toDate(v: unknown): Date | null {
  if (!v) return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? null : d
}

export async function POST(req: NextRequest) {
  try {
    const { hotspotAdminId, deviceId, vouchers } = await req.json()

    if (!hotspotAdminId) return NextResponse.json({ error: 'hotspotAdminId مطلوب' }, { status: 400 })
    if (!deviceId)       return NextResponse.json({ error: 'deviceId مطلوب' }, { status: 400 })
    if (!Array.isArray(vouchers) || vouchers.length === 0)
      return NextResponse.json({ error: 'vouchers مطلوب (مصفوفة غير فاضية)' }, { status: 400 })
    if (vouchers.length > MAX_BATCH)
      return NextResponse.json({ error: `الدفعة كبيرة جداً (${vouchers.length}) — الحد ${MAX_BATCH}` }, { status: 413 })

    const admin  = await prisma.hotspotAdmin.findUnique({ where: { id: hotspotAdminId }, select: { id: true } })
    if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { id: true } })
    if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })

    // نظّف الأكواد
    const rows = vouchers
      .map((v: VIn) => ({ v, code: String(v.code || '').toUpperCase().trim() }))
      .filter((r: { code: string }) => r.code.length >= 4)
    if (rows.length === 0) return NextResponse.json({ error: 'مفيش أكواد صالحة في الدفعة' }, { status: 400 })

    // مين موجود قبل كده؟
    const codes = rows.map((r: { code: string }) => r.code)
    const existing = await prisma.voucher.findMany({ where: { code: { in: codes } }, select: { code: true } })
    const existingSet = new Set(existing.map(e => e.code))

    const toCreate = rows.filter((r: { v: VIn; code: string }) => !existingSet.has(r.code))
    const toUpdate = rows.filter((r: { v: VIn; code: string }) =>  existingSet.has(r.code))

    // بيانات كارت كامل للإنشاء
    const createData = toCreate.map(({ v, code }: { v: VIn; code: string }) => ({
      code,
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
      expiresAt:      toDate(v.expiresAt),
      isRenewable:    !!v.isRenewable,
      renewCount:     (v.renewCount     as number) ?? 0,
      lastRenewedAt:  toDate(v.lastRenewedAt),
      status:         (v.status as string) || 'UNUSED',
      usedAt:         toDate(v.usedAt),
      printBatch:     (v.printBatch as string) || 'MIGRATED',
      nfcPayload:     (v.nfcPayload as string) || null,
      qrPayload:      (v.qrPayload as string) || null,
      createdAt:      toDate(v.createdAt) || new Date(),
      deviceId,
      hotspotAdminId,
    }))

    // إنشاء على دفعات صغيرة (100) — أمان للـ transaction
    let createdCount = 0
    for (let i = 0; i < createData.length; i += 100) {
      const batch = createData.slice(i, i + 100)
      await prisma.voucher.createMany({ data: batch, skipDuplicates: true })
      createdCount += batch.length
    }

    // تحديث الموجود — بتفاصيل المصدر + نسبه للكافيه الهدف
    let updatedCount = 0
    for (const { v, code } of toUpdate as { v: VIn; code: string }[]) {
      await prisma.voucher.updateMany({
        where: { code },
        data: {
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
          expiresAt:      toDate(v.expiresAt),
          isRenewable:    !!v.isRenewable,
          renewCount:     (v.renewCount     as number) ?? 0,
          lastRenewedAt:  toDate(v.lastRenewedAt),
          status:         (v.status as string) || 'UNUSED',
          usedAt:         toDate(v.usedAt),
          printBatch:     (v.printBatch as string) || undefined,
          deviceId,
          hotspotAdminId,
        },
      })
      updatedCount++
    }

    // حدّث عداد الأدمن (عدد الكروت الكلي = عدد الكروت الفعلي بعد النقل)
    const actualCount = await prisma.voucher.count({ where: { hotspotAdminId } })
    await prisma.hotspotAdmin.update({
      where: { id: hotspotAdminId },
      data:  { totalVouchersGenerated: actualCount },
    })

    return NextResponse.json({ success: true, created: createdCount, updated: updatedCount, adminTotal: actualCount })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[migrate-vouchers]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
