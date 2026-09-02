// GET /api/superadmin/device-status?deviceId=xxx  — فحص جهاز واحد
// GET /api/superadmin/device-status?adminId=xxx   — فحص كل أجهزة أدمن
// GET /api/superadmin/device-status               — فحص كل الأجهزة
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// فحص إذا كان الراوتر متصل — بنجرب نفتح HTTP request على IP:80
async function pingDevice(ip: string, timeoutMs = 3000): Promise<boolean> {
  if (!ip || ip === '0.0.0.0') return false
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(`http://${ip}`, {
      signal: controller.signal,
      method: 'HEAD',
      cache: 'no-store',
    }).catch(() => null)
    clearTimeout(timer)
    return res !== null
  } catch {
    return false
  }
}

// فحص جلسات نشطة للجهاز
async function hasActiveSession(deviceId: string): Promise<boolean> {
  const count = await prisma.session.count({
    where: { deviceId, status: 'ACTIVE' },
  })
  return count > 0
}

// فحص آخر checkin للجهاز من lastCheckin field
async function getLastCheckin(gatewayId: string): Promise<Date | null> {
  const device = await prisma.device.findUnique({
    where: { gatewayId },
    select: { lastCheckin: true } as any,
  })
  return (device as any)?.lastCheckin ?? null
}

async function checkDeviceStatus(device: {
  id: string
  gatewayId: string
  routerIp: string | null
  isActive: boolean
}) {
  // 1. فحص جلسات نشطة — أكيد متصل
  const hasSession = await hasActiveSession(device.id)
  if (hasSession) return { online: true, reason: 'جلسات نشطة' }

  // 2. فحص آخر checkin
  try {
    const lastCheckin = await getLastCheckin(device.gatewayId)
    if (lastCheckin) {
      const diffMin = (Date.now() - new Date(lastCheckin).getTime()) / 60000
      if (diffMin < 2)  return { online: true,  reason: `آخر ping منذ ${Math.round(diffMin * 60)}ث`, lastCheckin }
      if (diffMin < 10) return { online: true,  reason: `آخر ping منذ ${Math.round(diffMin)}د`, lastCheckin }
      return { online: false, reason: `آخر ظهور منذ ${Math.round(diffMin)}د`, lastCheckin }
    }
  } catch {}

  // 3. HTTP ping للـ IP (بس مش للـ default 192.168.1.1)
  const ip = device.routerIp
  if (ip && ip !== '0.0.0.0' && ip !== '192.168.1.1' && !ip.startsWith('192.168.')) {
    const reachable = await pingDevice(ip)
    if (reachable) return { online: true, reason: 'IP يرد' }
    return { online: false, reason: 'IP لا يرد' }
  }

  return { online: false, reason: 'لا يوجد بيانات' }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const deviceId = searchParams.get('deviceId')
  const adminId  = searchParams.get('adminId')

  try {
    if (deviceId) {
      const device = await prisma.device.findUnique({ where: { id: deviceId } })
      if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const status = await checkDeviceStatus(device)
      return NextResponse.json({ deviceId, ...status })
    }

    const devices = await prisma.device.findMany({
      where: adminId ? { hotspotAdminId: adminId } : undefined,
      select: { id: true, gatewayId: true, routerIp: true, isActive: true, name: true },
    })

    const results = await Promise.all(
      devices.map(async d => {
        const status = await checkDeviceStatus(d)
        return { deviceId: d.id, name: d.name, ...status }
      })
    )

    return NextResponse.json({ devices: results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
