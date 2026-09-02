import { prisma } from './prisma'
import { sendEmail as sendEmailFn, notificationEmail } from './email'

// ── إنشاء إشعار في DB (+ إيميل اختياري) ─────────────────────────────────────
export async function createNotification({
  adminId, type, title, body, sendEmail = false,
}: {
  adminId: string
  type: string
  title: string
  body: string
  sendEmail?: boolean
}) {
  // حفظ في DB
  await prisma.notification.create({
    data: { hotspotAdminId: adminId, type, title, body },
  })

  // إيميل لو مطلوب
  if (sendEmail) {
    const admin = await prisma.hotspotAdmin.findUnique({
      where: { id: adminId },
      select: { email: true, name: true },
    })
    if (admin?.email) {
      await sendEmailFn(
        admin.email,
        title,
        notificationEmail(admin.name, title, body),
      )
    }
  }
}

// ── فحص الكروت المنخفضة وإشعار الأدمن ────────────────────────────────────────
// يُستدعى من wifidog auth عند كل طلب
export async function checkVoucherAlert(adminId: string) {
  const admin = await prisma.hotspotAdmin.findUnique({
    where: { id: adminId },
    select: { maxVouchersTotal: true, totalVouchersGenerated: true, name: true },
  })
  if (!admin) return

  const unused = await prisma.voucher.count({
    where: { hotspotAdminId: adminId, status: 'UNUSED' },
  })

  // إشعار لما الكروت المتاحة أقل من 5
  if (unused <= 5 && unused > 0) {
    // تحقق إن مفيش إشعار مشابه في آخر ساعة
    const recent = await prisma.notification.findFirst({
      where: {
        hotspotAdminId: adminId,
        type: 'VOUCHER_LOW',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    })
    if (!recent) {
      await createNotification({
        adminId,
        type: 'VOUCHER_LOW',
        title: `⚠️ الكروت على وشك النفاد`,
        body: `متبقي فقط ${unused} كارت غير مستخدم. ولّد كروت جديدة لتجنب انقطاع الخدمة.`,
        sendEmail: true,
      })
    }
  }

  // إشعار لما الكروت بتخلص خالص
  if (unused === 0) {
    const recent = await prisma.notification.findFirst({
      where: {
        hotspotAdminId: adminId,
        type: 'VOUCHER_EMPTY',
        createdAt: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      },
    })
    if (!recent) {
      await createNotification({
        adminId,
        type: 'VOUCHER_EMPTY',
        title: `🚫 الكروت نفدت!`,
        body: `لا يوجد كروت متاحة. العملاء لن يتمكنوا من الاتصال حتى تولّد كروت جديدة.`,
        sendEmail: true,
      })
    }
  }
}

// ── إشعار جهاز متوقف ──────────────────────────────────────────────────────────
export async function notifyDeviceDown(deviceId: string) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: { hotspotAdmin: { select: { id: true, name: true } } },
  })
  if (!device) return

  const recent = await prisma.notification.findFirst({
    where: {
      hotspotAdminId: device.hotspotAdminId,
      type: 'DEVICE_DOWN',
      body: { contains: device.name },
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
    },
  })
  if (recent) return

  await createNotification({
    adminId: device.hotspotAdminId,
    type: 'DEVICE_DOWN',
    title: `🔴 جهاز "${device.name}" متوقف`,
    body: `الجهاز "${device.name}" (${device.gatewayId}) توقف عن الاستجابة. تحقق من الاتصال.`,
    sendEmail: true,
  })
}

// ── إشعار جهاز عاد للعمل ─────────────────────────────────────────────────────
export async function notifyDeviceUp(deviceId: string) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: { hotspotAdmin: true },
  })
  if (!device) return

  await createNotification({
    adminId: device.hotspotAdminId,
    type: 'DEVICE_UP',
    title: `🟢 جهاز "${device.name}" عاد للعمل`,
    body: `الجهاز "${device.name}" متصل الآن ويعمل بشكل طبيعي.`,
    sendEmail: false, // مش لازم إيميل للعودة
  })
}
