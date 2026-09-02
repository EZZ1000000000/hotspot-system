// POST /api/vouchers/generate
// يدعم: STANDARD | NFC | QR | UNLIMITED
// صلاحية بالأيام أو بتاريخ محدد
// NFC/QR — السوبر أدمن بس
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateBatchCodes } from '@/lib/voucher'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      hotspotAdminId,
      isSuperAdmin,     // true لو السوبر أدمن هو اللي بيولد
      deviceId,
      count,
      packageType,      // BOTH | DATA_ONLY | TIME_ONLY | UNLIMITED
      voucherType,      // STANDARD | NFC | QR | UNLIMITED
      codeLength,       // عدد حروف الكود (4-32)
      dataLimitMB,
      timeLimitMin,
      speedLimitMbps,
      maxUsageCount,
      codeType,         // mix | letters | numbers
      validityDays,     // صلاحية بالأيام من تاريخ الإنشاء
      expiresAt,        // أو تاريخ محدد
      isRenewable,
    } = body

    const admin = await prisma.hotspotAdmin.findUnique({
      where: { id: hotspotAdminId },
    })
    if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })

    // تحقق من الصلاحيات
    if (!isSuperAdmin) {
      if ((voucherType === 'NFC' || voucherType === 'QR') && !admin.canCreateNFC && !admin.canCreateQR)
        return NextResponse.json({ error: 'ليس لديك صلاحية إنشاء كروت NFC/QR' }, { status: 403 })
      if (packageType === 'UNLIMITED' && !admin.canCreateUnlimited)
        return NextResponse.json({ error: 'ليس لديك صلاحية إنشاء كروت Unlimited' }, { status: 403 })
    }

    // تحقق من الحد
    const remaining = admin.maxVouchersTotal - admin.totalVouchersGenerated
    if (count > remaining)
      return NextResponse.json({ error: `تجاوزت الحد المسموح. المتبقي: ${remaining} كارت` }, { status: 403 })

    // احسب تاريخ الانتهاء
    let expiry: Date | null = null
    if (expiresAt) {
      expiry = new Date(expiresAt)
    } else if (validityDays && validityDays > 0) {
      expiry = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
    }

    // للـ UNLIMITED — مفيش حد
    // تأكد إن القيم مش أكبر من INT4 max (2,147,483,647)
    const INT4_MAX = 2_147_483_647
    const safeInt = (v: any) => {
      const n = parseInt(v)
      if (isNaN(n) || n <= 0) return null
      return Math.min(n, INT4_MAX)
    }
    const finalDataLimit  = packageType === 'UNLIMITED' ? null : safeInt(dataLimitMB)
    const finalTimeLimit  = packageType === 'UNLIMITED' ? null : safeInt(timeLimitMin)
    const finalPkgType    = packageType === 'UNLIMITED' ? 'UNLIMITED' : (packageType || 'BOTH')
    const finalVchrType   = voucherType || 'STANDARD'

    const finalCodeLength = Math.min(32, Math.max(4, codeLength || 16))
    const printBatch = `BATCH-${Date.now()}`

    // توليد كودات فريدة مع التحقق من الداتابيز
    let codes: string[] = []
    let attempts = 0
    while (codes.length < count && attempts < 20) {
      const needed = count - codes.length
      const candidates = generateBatchCodes(needed * 3, codeType || 'mix', finalCodeLength)
      const existing = await prisma.voucher.findMany({
        where: { code: { in: candidates } },
        select: { code: true },
      })
      const existingSet = new Set(existing.map(v => v.code))
      const fresh = candidates.filter(c => !existingSet.has(c) && !codes.includes(c))
      codes.push(...fresh.slice(0, needed))
      attempts++
    }
    if (codes.length < count)
      return NextResponse.json({ error: 'تعذر توليد كودات فريدة، حاول مرة أخرى' }, { status: 500 })

    const vouchers = await prisma.$transaction(
      codes.map((code, i) => {
        // للـ NFC — nfcPayload هو الكود نفسه (الراوتر بيقراه ويدخله تلقائي)
        // للـ QR  — qrPayload هو URL بيحتوي الكود
        const host       = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
        const nfcPayload = finalVchrType === 'NFC' ? code : null
        const qrPayload  = finalVchrType === 'QR'
          ? `${host}/portal?code=${code}`
          : null

        return prisma.voucher.create({
          data: {
            code,
            packageType:    finalPkgType as any,
            voucherType:    finalVchrType as any,
            dataLimitMB:    finalDataLimit,
            timeLimitMin:   finalTimeLimit,
            speedLimitMbps: speedLimitMbps || null,
            maxUsageCount:  maxUsageCount  || 1,
            expiresAt:      expiry,
            validityDays:   validityDays   || null,
            isRenewable:    isRenewable    || false,
            nfcPayload,
            qrPayload,
            deviceId:       deviceId || null,
            hotspotAdminId,
            printBatch,
          },
        })
      })
    )

    await prisma.hotspotAdmin.update({
      where: { id: hotspotAdminId },
      data: { totalVouchersGenerated: { increment: count } },
    })

    return NextResponse.json({
      success: true,
      printBatch,
      count:   vouchers.length,
      isQR:    finalVchrType === 'QR',
      vouchers: vouchers.map(v => ({
        id:            v.id,
        code:          v.code,
        voucherType:   v.voucherType,
        packageType:   v.packageType,
        dataLimitMB:   v.dataLimitMB,
        timeLimitMin:  v.timeLimitMin,
        expiresAt:     v.expiresAt,
        nfcPayload:    v.nfcPayload,
        qrPayload:     v.qrPayload,
      })),
    })
  } catch (err: any) {
    console.error('[generate]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
