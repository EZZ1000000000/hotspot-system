// GET  /api/admin/sessions?deviceId=xxx
// DELETE /api/admin/sessions - kick session
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const params   = new URL(req.url).searchParams
  const deviceId = params.get('deviceId')
  const adminId  = params.get('adminId')

  // ── فلتر الأجهزة اللي تبع الأدمن ده بس ──
  let deviceFilter: any = {}
  if (deviceId) {
    deviceFilter = { deviceId }
  } else if (adminId) {
    // جيب كل أجهزة الأدمن ده بس
    const adminDevices = await prisma.device.findMany({
      where:  { hotspotAdminId: adminId },
      select: { id: true },
    })
    const deviceIds = adminDevices.map(d => d.id)
    if (deviceIds.length === 0) return NextResponse.json([])
    deviceFilter = { deviceId: { in: deviceIds } }
  }

  const sessions = await prisma.session.findMany({
    where: { status: 'ACTIVE', ...deviceFilter },
    include: {
      voucher: { select: { code: true, dataLimitMB: true, timeLimitMin: true, dataUsedMB: true, timeUsedMin: true, voucherType: true } },
      device:  { select: { name: true } },
    },
    orderBy: { startedAt: 'desc' },
  })
  return NextResponse.json(sessions)
}

export async function DELETE(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'KICKED', endedAt: new Date(), endReason: 'ADMIN_KICK' },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
