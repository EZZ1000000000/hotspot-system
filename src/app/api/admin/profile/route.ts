import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// GET — جلب بيانات الأدمن
export async function GET(req: NextRequest) {
  const adminId = req.nextUrl.searchParams.get('adminId')
  if (!adminId) return NextResponse.json({ error: 'missing adminId' }, { status: 400 })

  const admin = await prisma.hotspotAdmin.findUnique({
    where: { id: adminId },
    select: {
      id: true, name: true, username: true, email: true, phone: true,
      maxDevices: true, maxVouchersTotal: true, totalVouchersGenerated: true,
      canCreateUnlimited: true, canCreateQR: true, canCreateNFC: true, canRenewVouchers: true,
      isActive: true, createdAt: true,
      _count: { select: { devices: true, vouchers: true, saleRecords: true } },
    },
  })

  if (!admin) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(admin)
}

// PATCH — تحديث البيانات + كلمة المرور
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { adminId, name, phone, currentPassword, newPassword } = body

  if (!adminId) return NextResponse.json({ error: 'missing adminId' }, { status: 400 })

  const admin = await prisma.hotspotAdmin.findUnique({ where: { id: adminId } })
  if (!admin) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const updateData: any = {}

  // تحديث الاسم والموبايل
  if (name?.trim()) updateData.name = name.trim()
  if (phone !== undefined) updateData.phone = phone || null

  // تغيير كلمة المرور
  if (newPassword) {
    if (!currentPassword)
      return NextResponse.json({ error: 'أدخل كلمة المرور الحالية' }, { status: 400 })
    if (newPassword.length < 6)
      return NextResponse.json({ error: 'كلمة المرور الجديدة 6 أحرف على الأقل' }, { status: 400 })

    const valid = await bcrypt.compare(currentPassword, admin.password)
    if (!valid)
      return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 400 })

    updateData.password = await bcrypt.hash(newPassword, 10)
  }

  const updated = await prisma.hotspotAdmin.update({
    where: { id: adminId },
    data: updateData,
    select: { id: true, name: true, username: true, email: true, phone: true },
  })

  return NextResponse.json({ success: true, admin: updated })
}
