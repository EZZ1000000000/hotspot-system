import { prisma } from '../lib/prisma'
import { generateVoucherCode } from '../lib/voucher'

export async function handlePortalLogin(body: {
  code: string; mac: string; ip: string; gatewayId: string; hostname?: string
}) {
  let { code, mac, ip, gatewayId, hostname } = body

  const cleanCode     = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const formattedCode = cleanCode.match(/.{1,4}/g)?.join('-') || cleanCode

  if (!formattedCode) return { success: false, message: 'أدخل كود الاشتراك' }

  if (!mac) mac = 'TEST-MAC-' + Date.now()
  if (!ip)  ip  = '0.0.0.0'

  // -- دور على الجهاز --------------------------------------------------------
  let device
  if (gatewayId) {
    device = await prisma.device.findUnique({ where: { gatewayId } })
  } else {
    device = await prisma.device.findFirst({ where: { isActive: true } })
  }
  if (!device || !device.isActive)
    return { success: false, message: 'الجهاز غير موجود أو غير نشط' }

  // -- دور على الكود ---------------------------------------------------------
  let voucher = await prisma.voucher.findUnique({ where: { code: formattedCode } })
  if (!voucher) voucher = await prisma.voucher.findUnique({ where: { code: cleanCode } })
  if (!voucher && cleanCode.length >= 8) {
    voucher = await prisma.voucher.findFirst({
      where: {
        code: { startsWith: cleanCode },
        status: { in: ['UNUSED', 'ACTIVE'] },
        hotspotAdminId: device.hotspotAdminId,
      }
    })
  }
  if (!voucher) return { success: false, message: 'الكود غير صحيح' }

  if (voucher.status === 'EXPIRED' || voucher.status === 'DEPLETED')
    return { success: false, message: 'هذا الكود منتهي الصلاحية' }

  if (voucher.deviceId && voucher.deviceId !== device.id)
    return { success: false, message: 'هذا الكود مخصص لجهاز آخر' }

  if (voucher.hotspotAdminId !== device.hotspotAdminId)
    return { success: false, message: 'الكود غير صالح لهذه الشبكة' }

  const now = new Date()

  // ═══════════════════════════════════════════════════════════════════════════
  // QR كارت — كل مسح = كود مستقل خاص بالجهاز ده بس
  // ═══════════════════════════════════════════════════════════════════════════
  if (voucher.voucherType === 'QR') {
    // لو في جلسة نشطة لنفس الـ MAC على أي voucher فرعي من نفس الـ QR الأصلي
    const existingQRSession = await prisma.session.findFirst({
      where: {
        macAddress: mac,
        status: 'ACTIVE',
        voucher: { qrPayload: voucher.qrPayload || voucher.code },
      },
    })
    if (existingQRSession) {
      return { success: true, token: existingQRSession.token, entryMethod: 'QR' }
    }

    // فحص maxUsageCount — كام جهاز متصل دلوقتي من الـ QR ده (على كل الكروت الفرعية)
    const activeQRSessions = await prisma.session.count({
      where: {
        status: 'ACTIVE',
        voucher: { qrPayload: voucher.qrPayload || voucher.code },
      },
    })
    if (voucher.maxUsageCount > 0 && activeQRSessions >= voucher.maxUsageCount) {
      return { success: false, message: 'الحد الأقصى للمتصلين وصل — حاول بعد شوية' }
    }

    // عمل voucher فرعي جديد خاص بالجهاز ده
    const childCode = generateVoucherCode('mix', 16)
    const childVoucher = await prisma.voucher.create({
      data: {
        code:           childCode,
        voucherType:    'QR',
        packageType:    voucher.packageType,
        dataLimitMB:    voucher.dataLimitMB,
        timeLimitMin:   voucher.timeLimitMin,
        speedLimitMbps: voucher.speedLimitMbps,
        maxUsageCount:  1,
        usageCount:     1,
        status:         'ACTIVE',
        usedAt:         now,
        deviceId:       device.id,
        hotspotAdminId: voucher.hotspotAdminId,
        // نحفظ كود الـ QR الأصلي عشان نقدر نعد المتصلين
        qrPayload:      voucher.qrPayload || voucher.code,
        printBatch:     voucher.printBatch,
      },
    })

    // تحديث usageCount على الـ voucher الأصلي
    await prisma.voucher.update({
      where: { id: voucher.id },
      data: { usageCount: { increment: 1 }, usedAt: voucher.usedAt || now },
    })

    const qrSession = await prisma.session.create({
      data: {
        macAddress:  mac,
        ipAddress:   ip,
        hostname:    hostname || null,
        deviceId:    device.id,
        voucherId:   childVoucher.id,
        startedAt:   now,
        lastPingAt:  now,
        entryMethod: 'QR',
      },
    })

    return {
      success:     true,
      token:       qrSession.token,
      entryMethod: 'QR',
      voucher: {
        dataLimitMB:    childVoucher.dataLimitMB,
        timeLimitMin:   childVoucher.timeLimitMin,
        speedLimitMbps: childVoucher.speedLimitMbps,
      },
    }
  }
  // ═══════════════════════════════════════════════════════════════════════════

  // -- جلسة نشطة بنفس MAC؟ رجع نفس التوكن ----------------------------------
  const existingSession = await prisma.session.findFirst({
    where: { macAddress: mac, voucherId: voucher.id, status: 'ACTIVE' },
  })
  if (existingSession) {
    return { success: true, token: existingSession.token, entryMethod: voucher.voucherType }
  }

  // -- فحص عدد المستخدمين ---------------------------------------------------
  const activeSessions = await prisma.session.count({ where: { voucherId: voucher.id, status: 'ACTIVE' } })
  if (voucher.maxUsageCount > 0 && activeSessions >= voucher.maxUsageCount) {
    return { success: false, message: 'الكود مستخدم حالياً — الحد الأقصى وصل' }
  }

  // -- أنشئ جلسة جديدة -------------------------------------------------------
  const session = await prisma.session.create({
    data: {
      macAddress:  mac,
      ipAddress:   ip,
      hostname:    hostname || null,
      deviceId:    device.id,
      voucherId:   voucher.id,
      startedAt:   now,
      lastPingAt:  now,
    },
  })

  await prisma.voucher.update({
    where: { id: voucher.id },
    data: {
      status:     'ACTIVE',
      usedAt:     voucher.usedAt || now,
      usageCount: { increment: 1 },
      deviceId:   voucher.deviceId || device.id,
    },
  })

  return {
    success:     true,
    token:       session.token,
    entryMethod: voucher.voucherType,
    voucher: {
      dataLimitMB:    voucher.dataLimitMB,
      timeLimitMin:   voucher.timeLimitMin,
      speedLimitMbps: voucher.speedLimitMbps,
    },
  }
}
