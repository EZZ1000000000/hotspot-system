// GET  /api/superadmin/admins       - list all hotspot admins
// POST /api/superadmin/admins       - create new hotspot admin
// PUT  /api/superadmin/admins       - update admin limits + permissions
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  const admins = await prisma.hotspotAdmin.findMany({
    include: { _count: { select: { devices: true, vouchers: true } } },
    orderBy: { createdAt: 'desc' },
  })
  // لا ترجع الباسورد
  return NextResponse.json(admins.map(({ password, ...a }) => a))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      username, password, email, name, phone,
      maxDevices, maxVouchersTotal, superAdminId,
      canCreateUnlimited, canCreateNFC, canCreateQR, canRenewVouchers,
    } = body

    const hashed = await bcrypt.hash(password, 10)
    const admin  = await prisma.hotspotAdmin.create({
      data: {
        username, password: hashed, email, name,
        phone: phone || null,
        maxDevices:       maxDevices       || 1,
        maxVouchersTotal: maxVouchersTotal || 100,
        canCreateUnlimited: canCreateUnlimited ?? false,
        canCreateNFC:       canCreateNFC       ?? false,
        canCreateQR:        canCreateQR        ?? false,
        canRenewVouchers:   canRenewVouchers   ?? true,
        superAdminId,
      },
    })
    const { password: _, ...safe } = admin
    return NextResponse.json({ success: true, admin: safe }, { status: 201 })
  } catch (err: any) {
    if (err.code === 'P2002') return NextResponse.json({ error: 'اسم المستخدم أو الإيميل موجود بالفعل' }, { status: 409 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, maxDevices, maxVouchersTotal, isActive,
            canCreateUnlimited, canCreateNFC, canCreateQR, canRenewVouchers } = await req.json()
    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })

    const now = new Date()

    // لو بيتوقف الأدمن — أنهي كل جلسات أجهزته فوراً
    if (isActive === false) {
      const adminDevices = await prisma.device.findMany({
        where: { hotspotAdminId: id },
        select: { id: true },
      })
      const deviceIds = adminDevices.map(d => d.id)

      await prisma.$transaction([
        prisma.session.updateMany({
          where: { deviceId: { in: deviceIds }, status: 'ACTIVE' },
          data:  { status: 'ENDED', endedAt: now, endReason: 'ADMIN_KICK' },
        }),
        prisma.hotspotAdmin.update({
          where: { id },
          data:  { isActive: false },
        }),
      ])

      const admin = await prisma.hotspotAdmin.findUnique({ where: { id } })
      const { password: _, ...safe } = admin!
      return NextResponse.json({ success: true, admin: safe, sessionsEnded: true })
    }

    // تحديث عادي
    const admin = await prisma.hotspotAdmin.update({
      where: { id },
      data: {
        ...(maxDevices         !== undefined && { maxDevices }),
        ...(maxVouchersTotal   !== undefined && { maxVouchersTotal }),
        ...(isActive           !== undefined && { isActive }),
        ...(canCreateUnlimited !== undefined && { canCreateUnlimited }),
        ...(canCreateNFC       !== undefined && { canCreateNFC }),
        ...(canCreateQR        !== undefined && { canCreateQR }),
        ...(canRenewVouchers   !== undefined && { canRenewVouchers }),
      },
    })
    const { password: _, ...safe } = admin
    return NextResponse.json({ success: true, admin: safe })
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'الأدمن غير موجود' }, { status: 404 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
