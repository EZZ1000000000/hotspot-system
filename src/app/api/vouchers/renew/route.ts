// POST /api/vouchers/renew
// تجديد كارت منتهي — بيصفّر الاستهلاك ويمدد الصلاحية
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { voucherId, code, extraDays, extraDataMB, extraTimeMins, adminId } = await req.json()

    // جيب الكارت بـ id أو code
    const voucher = await prisma.voucher.findFirst({
      where: voucherId ? { id: voucherId } : { code: code?.toUpperCase() },
    })
    if (!voucher) return NextResponse.json({ error: 'الكارت غير موجود' }, { status: 404 })
    if (!voucher.isRenewable) return NextResponse.json({ error: 'هذا الكارت غير قابل للتجديد' }, { status: 400 })

    // تحقق إن الأدمن مسموحله
    if (adminId && voucher.hotspotAdminId !== adminId) {
      const admin = await prisma.hotspotAdmin.findUnique({ where: { id: adminId } })
      if (!admin?.canRenewVouchers)
        return NextResponse.json({ error: 'ليس لديك صلاحية التجديد' }, { status: 403 })
    }

    const now = new Date()

    // حساب تاريخ انتهاء جديد
    let newExpiresAt = voucher.expiresAt
    if (extraDays && extraDays > 0) {
      const base = (newExpiresAt && newExpiresAt > now) ? newExpiresAt : now
      newExpiresAt = new Date(base.getTime() + extraDays * 24 * 60 * 60 * 1000)
    }

    // صفّر الاستهلاك أو أضيف عليه
    const newDataLimit = extraDataMB
      ? (voucher.dataLimitMB || 0) + extraDataMB
      : voucher.dataLimitMB

    const newTimeLimit = extraTimeMins
      ? (voucher.timeLimitMin || 0) + extraTimeMins
      : voucher.timeLimitMin

    const updated = await prisma.voucher.update({
      where: { id: voucher.id },
      data: {
        status:         'UNUSED',
        dataUsedMB:     0,
        timeUsedMin:    0,
        usageCount:     0,
        dataLimitMB:    newDataLimit,
        timeLimitMin:   newTimeLimit,
        expiresAt:      newExpiresAt,
        renewCount:     { increment: 1 },
        lastRenewedAt:  now,
      },
    })

    // أقفل أي جلسة نشطة بالكارت ده
    await prisma.session.updateMany({
      where: { voucherId: voucher.id, status: 'ACTIVE' },
      data:  { status: 'ENDED', endedAt: now, endReason: 'SYSTEM' },
    })

    return NextResponse.json({ success: true, voucher: updated })
  } catch (e: any) {
    console.error('[voucher/renew]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
