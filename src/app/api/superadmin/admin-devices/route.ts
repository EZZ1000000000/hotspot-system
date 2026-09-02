// GET  /api/superadmin/admin-devices?adminId=X  — جلب أجهزة أدمن
// POST /api/superadmin/admin-devices             — إيقاف/تشغيل جهاز
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const adminId = new URL(req.url).searchParams.get('adminId')
    if (!adminId) return NextResponse.json({ error: 'adminId مطلوب' }, { status: 400 })

    const devices = await prisma.device.findMany({
      where: { hotspotAdminId: adminId },
      include: { _count: { select: { sessions: { where: { status: 'ACTIVE' } }, vouchers: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ devices })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { deviceId, isActive, adminId } = await req.json()
    if (!deviceId) return NextResponse.json({ error: 'deviceId مطلوب' }, { status: 400 })

    const device = await prisma.device.update({
      where: { id: deviceId },
      data: { isActive },
    })

    // لو أوقفنا الجهاز، اقفل كل الجلسات النشطة
    if (!isActive) {
      await prisma.session.updateMany({
        where: { deviceId, status: 'ACTIVE' },
        data: { status: 'ENDED', endReason: 'ADMIN_KICK', endedAt: new Date() },
      })
    }

    // سجل في الـ AuditLog
    await prisma.auditLog.create({
      data: {
        action:     isActive ? 'DEVICE_ENABLED' : 'DEVICE_DISABLED',
        entityType: 'Device',
        entityId:   deviceId,
        actorType:  'SUPER_ADMIN',
        actorId:    adminId || null,
        details:    JSON.stringify({ deviceName: device.name, gatewayId: device.gatewayId }),
      },
    })

    return NextResponse.json({ success: true, device })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
