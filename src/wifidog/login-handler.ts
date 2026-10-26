import { prisma } from '../lib/prisma'
import { generateVoucherCode, isVoucherDepleted } from '../lib/voucher'
import { reapIdleSessions } from '../lib/reaper'

export async function handlePortalLogin(body: {
  code: string; mac: string; ip: string; gatewayId: string; hostname?: string
}) {
  let { code, mac, ip, gatewayId, hostname } = body

  // حصاد الجلسات الشبح (بخنق داخلي — غالباً بيرجع فوراً بدون لمس القاعدة)
  // من غيره الجلسات الميتة بتضخم أرقام اللوحة وبتفضل مفتوحة للركوب
  await reapIdleSessions().catch(() => {})

  const cleanCode     = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const formattedCode = cleanCode.match(/.{1,4}/g)?.join('-') || cleanCode

  if (!formattedCode) return { success: false, message: 'أدخل كود الاشتراك' }

  if (!mac) mac = 'TEST-MAC-' + Date.now()
  if (!ip)  ip  = '0.0.0.0'

  // -- دور على الجهاز --------------------------------------------------------
  let device
  if (gatewayId) {
    device = await prisma.device.findUnique({ where: { gatewayId } })
    if (!device) {
      // ── إصلاح ذاتي ──
      // راوتر محوّل من كافيه لتاني ممكن يفضل شوية شغال ماسك GatewayID قديم
      // في الذاكرة — فبيبعت هوية مش موجودة عندنا. لو فيه جهاز واحد شغال
      // بس على السيرفر، فمفيش غموض: نعتبره هو الجهاز المقصود (بدل ما
      // العميل يشوف "الجهاز غير موجود أو غير نشط" والجهاز سليم)
      const actives = await prisma.device.findMany({ where: { isActive: true }, take: 2 })
      if (actives.length === 1) device = actives[0]
    }
  } else {
    device = await prisma.device.findFirst({ where: { isActive: true } })
  }
  if (!device)
    return { success: false, message: 'الجهاز غير موجود أو غير نشط' }
  if (!device.isActive)
    return { success: false, message: '⛔ الخدمة موقوفة مؤقتاً من إدارة الشبكة — تواصل مع الإدارة' }

  // ── الاشتراك (الأدمن) موقوف؟ ─────────────────────────────────────────────
  // ملاحظة مهمة: إيقاف الأدمن (الاشتراك) مش إيقاف للشبكة — صفحة تسجيل الدخول
  // العادية تفضل ظاهرة طبيعية، بس مفيش كرت جديد هيتفعل لحد ما الاشتراك يترفع
  const admin = await prisma.hotspotAdmin.findUnique({
    where:  { id: device.hotspotAdminId },
    select: { isActive: true },
  })
  if (admin && !admin.isActive)
    return { success: false, message: '⛔ الاشتراك موقوف حالياً من إدارة النظام — تواصل مع الإدارة' }

  // -- دور على الكود ---------------------------------------------------------
  // ── إصلاح أمني 2026-10-26: المطابقة الجزئية (startsWith) اتشالت ──
  // كانت بتخلي أول 8 حروف من أي كود أطول يفتح الكرت كله — يعني نص الكود
  // يفتح = نص مساحة التخمين. دلوقتي المطابقة تامة بس (باصفة الشرطات
  // وبدونها — عشان شكل الإدخال المختلف)
  let voucher = await prisma.voucher.findUnique({ where: { code: formattedCode } })
  if (!voucher) voucher = await prisma.voucher.findUnique({ where: { code: cleanCode } })
  if (!voucher) return { success: false, message: 'الكود غير صحيح' }

  // ── كرت موقوف من الإدارة ──
  // إيقاف الكرت بيمنعه هو بس — الشبكة وصفحة الدخول وطبيعتهم عادي
  // والمستخدم يشوف رسالة واضحة جوه صفحة تسجيل الدخول العادية
  if (voucher.status === 'DISABLED')
    return { success: false, message: '⛔ هذا الكرت موقوف من الإدارة — اطلب كرت جديد' }

  if (voucher.status === 'EXPIRED' || voucher.status === 'DEPLETED')
    return { success: false, message: 'هذا الكود منتهي الصلاحية' }

  if (voucher.deviceId && voucher.deviceId !== device.id)
    return { success: false, message: 'هذا الكود مخصص لجهاز آخر' }

  if (voucher.hotspotAdminId !== device.hotspotAdminId)
    return { success: false, message: 'الكود غير صالح لهذه الشبكة' }

  const now = new Date()

  // ═══ حدود الكرت عند الدخول — نفس منطق العدادات بالظبط (دفاع في العمق) ═══
  // العدادات بتقفل الكرت وقت ما الراوتر يبعت counters — لكن لو حد حاول يدخل
  // بالكود قبل ما counters توصل (أو لو التحديث فات) الفحص هنا بيرفضه فوراً
  if (voucher.packageType !== 'UNLIMITED') {
    const elapsedMin = voucher.usedAt ? (now.getTime() - new Date(voucher.usedAt).getTime()) / 60000 : 0
    const { depleted, reason } = isVoucherDepleted({
      ...voucher,
      dataUsedMB:  (voucher as any).dataUsedMB || 0,
      timeUsedMin: elapsedMin,
    })
    if (depleted) {
      prisma.voucher.update({
        where: { id: voucher.id },
        data:  { status: reason === 'DATA_DEPLETED' ? 'DEPLETED' : 'EXPIRED', timeUsedMin: elapsedMin },
      }).catch(() => {})
      return { success: false, message: 'هذا الكود منتهي الصلاحية' }
    }
  }

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

  // ── تنظيف الجلسات الميتة لنفس الكرت ──────────────────────────────────────
  // لو الجهاز غيّر اسم الشبكة (أو العميل قطع فترة طويلة) والموبايل غيّر الـ MAC،
  // الجلسة القديمة بتفضل ACTIVE في الداتابيز ما تعديش عليها counters — وده كان
  // بيمنع العميل يدخل كرته تاني لو الحد الأقصى للأجهزة = 1
  // أي جلسة ACTIVE من غير ping لأكتر من 30 دقيقة = ميتة → ننهيها
  const staleCutoff = new Date(now.getTime() - 30 * 60 * 1000)
  prisma.session.updateMany({
    where: { voucherId: voucher.id, status: 'ACTIVE', lastPingAt: { lt: staleCutoff } },
    data:  { status: 'ENDED', endedAt: now, endReason: 'TIMEOUT' },
  }).catch(() => {})

  // -- جلسة نشطة بنفس MAC؟ رجع نفس التوكن ----------------------------------
  const existingSession = await prisma.session.findFirst({
    where: { macAddress: mac, voucherId: voucher.id, status: 'ACTIVE' },
  })
  if (existingSession) {
    // ── تصحيح ذاتي: لو تفعيل الكرت فشل يوم إنشاء الجلسة (خطأ لحظي قديم) ──
    // كان ممكن الكرت يفضل UNUSED من غير usedAt رغم جلسة شغالة عليه —
    // وده كان بيسمح بإعادة تفعيله من جهاز تاني أثناء الجلسة (مشاركة كود).
    // هنا بنصلح الحالة فوراً فالمحتفظ سليم: جهاز واحد = usageCount واحد
    if (voucher.status === 'UNUSED' || !voucher.usedAt) {
      await prisma.voucher.update({
        where: { id: voucher.id },
        data: {
          status:     'ACTIVE',
          usedAt:     voucher.usedAt || existingSession.startedAt,
          usageCount: voucher.usedAt ? undefined : { increment: 1 },
          deviceId:   voucher.deviceId || device.id,
        },
      }).catch(() => {})
    }
    return { success: true, token: existingSession.token, entryMethod: voucher.voucherType }
  }

  // -- فحص عدد المستخدمين ---------------------------------------------------
  // ── حماية 2026-10-26: حد الأجهزة صفر/فارغ = جهاز واحد مش «بلا حد» ──
  // الفحص القديم كان بيتخطى كل الفحوصات لو maxUsageCount=0 (بيانات قديمة
  // أو استيراد) — فيبقى الكرت مفتوح لأي عدد أجهزة. القاعدة الآن: أي كرت
  // عادي حدّه الأدنى جهاز واحد.
  const deviceLimit = Math.max(1, voucher.maxUsageCount || 0)
  const activeSessions = await prisma.session.count({ where: { voucherId: voucher.id, status: 'ACTIVE' } })
  if (activeSessions >= deviceLimit) {
    return { success: false, message: 'الكود مستخدم حالياً — الحد الأقصى وصل' }
  }

  // ═══ قفل الجهاز الواحد — إصلاح ثغرة مشاركة الكود (2026-10-26) ═══
  // الفحص القديم كان بيعد الجلسات النشطة بس: أول ما العميل الأول يمشي
  // (والجلسة تتقفل بالتايم آوت بعد 30 دقيقة صمت) أي جهاز تاني يفتح نفس الكود.
  // دلوقتي: الكرت المتفعل بيرجع لصاحبه بس (نفس الـ MAC يستكمل وقته المتبقي)
  // وأي جهاز جديد مرفوض نهائياً مهما كان وضع الجلسات.
  if (voucher.usageCount >= deviceLimit) {
    const sameMacBefore = await prisma.session.count({
      where: { voucherId: voucher.id, macAddress: mac },
    })
    if (sameMacBefore === 0)
      return { success: false, message: 'هذا الكود مستخدم من قبل — الكود يعمل على جهاز واحد فقط' }
  }

  // -- أنشئ جلسة جديدة + فعّل الكرت (ذرّية: الاتنين مع بعض أو ولا حاجة) ──
  // قبل كده الجلسة كانت بتتعمل الأول وتحديث الكرت بعدها — لو التحديث فشل
  // (خطأ لحظي) الكرت كان يفضل UNUSED وusageCount=0 رغم إن جلسة شغالة
  // عليه → أي جهاز تاني يقدر يفعله تاني = مشاركة كود (حصل فعلاً)
  let session
  try {
    session = await prisma.$transaction(async (tx) => {
      // إعادة فحص داخل المعاملة ضد السباق (جهازين بيحاولوا في نفس اللحظة)
      const fresh = await tx.voucher.findUnique({ where: { id: voucher.id } })
      if (!fresh) throw new Error('VS_GONE')
      if (fresh.status === 'DISABLED') throw new Error('VS_DISABLED')
      if (fresh.status === 'EXPIRED' || fresh.status === 'DEPLETED') throw new Error('VS_DEPLETED')
      const lim = Math.max(1, fresh.maxUsageCount || 0)
      if ((fresh.usageCount || 0) >= lim) {
        const same = await tx.session.count({ where: { voucherId: fresh.id, macAddress: mac } })
        if (same === 0) throw new Error('VS_DEVICE_LOCK')
      }
      const actives = await tx.session.count({ where: { voucherId: fresh.id, status: 'ACTIVE' } })
      if (actives >= lim) throw new Error('VS_CONCURRENT')

      const s = await tx.session.create({
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

      await tx.voucher.update({
        where: { id: voucher.id },
        data: {
          status:     'ACTIVE',
          usedAt:     fresh.usedAt || now,
          // usageCount = عدد الأجهزة اللي فعلت الكرت فعلاً — الاستكمال بنفس MAC مش بيزوده
          usageCount: fresh.usedAt ? undefined : { increment: 1 },
          deviceId:   fresh.deviceId || device.id,
        },
      })
      return s
    })
  } catch (e: any) {
    const m = e?.message || ''
    if (m === 'VS_DEVICE_LOCK')
      return { success: false, message: 'هذا الكود مستخدم من قبل — الكود يعمل على جهاز واحد فقط' }
    if (m === 'VS_CONCURRENT')
      return { success: false, message: 'الكود مستخدم حالياً — الحد الأقصى وصل' }
    if (m === 'VS_DISABLED')
      return { success: false, message: '⛔ هذا الكرت موقوف من الإدارة — اطلب كرت جديد' }
    if (m === 'VS_DEPLETED' || m === 'VS_GONE')
      return { success: false, message: 'هذا الكود منتهي الصلاحية' }
    throw e
  }

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
