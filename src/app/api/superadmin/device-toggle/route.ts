// POST /api/superadmin/device-toggle
// { deviceId, isActive }
// لو isActive=false → يوقف الجهاز وينهي كل جلساته فوراً
// لو isActive=true  → يشغل الجهاز
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { deviceId, isActive } = await req.json()
    if (!deviceId) return NextResponse.json({ error: 'deviceId مطلوب' }, { status: 400 })
    if (isActive === undefined) return NextResponse.json({ error: 'isActive مطلوب' }, { status: 400 })

    const now = new Date()

    if (isActive === false) {
      const [sessionsResult, device] = await prisma.$transaction([
        prisma.session.updateMany({
          where: { deviceId, status: 'ACTIVE' },
          data:  { status: 'ENDED', endedAt: now, endReason: 'ADMIN_KICK' },
        }),
        prisma.device.update({
          where: { id: deviceId },
          data:  { isActive: false },
        }),
      ])
      return NextResponse.json({
        success: true,
        isActive: false,
        device,
        sessionsEnded: sessionsResult.count,
      })
    }

    const device = await prisma.device.update({
      where: { id: deviceId },
      data:  { isActive: true },
    })
    return NextResponse.json({ success: true, isActive: true, device })

  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'الجهاز غير موجود' }, { status: 404 })
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
