// GET /api/superadmin/stats — إحصائيات شاملة
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const adminId = new URL(req.url).searchParams.get('adminId')

    const todayStart = new Date(); todayStart.setHours(0,0,0,0)

    const [activeSessions, devices, admins, todaySessions, cafeStats, consumptionRaw] = await Promise.all([
      // جلسات نشطة
      prisma.session.findMany({
        where: {
          status: 'ACTIVE',
          ...(adminId && { device: { hotspotAdminId: adminId } }),
        },
        include: {
          device:  { select: { id: true, name: true, wifiSSID: true, hotspotAdminId: true } },
          voucher: { select: { code: true, packageType: true, dataLimitMB: true, timeLimitMin: true } },
        },
      }),
      // كل الأجهزة
      prisma.device.findMany({
        where: adminId ? { hotspotAdminId: adminId } : {},
        select: {
          id: true, name: true, gatewayId: true, isActive: true,
          wifiSSID: true, routerIp: true, location: true,
          tunnelPort: true,
          hotspotAdmin: { select: { name: true, username: true } },
          _count: {
            select: {
              sessions: { where: { status: 'ACTIVE' } },
              vouchers: { where: { status: 'ACTIVE' } },
            },
          },
        },
        orderBy: { isActive: 'desc' },
      }),
      // الأدمنز مع إحصائياتهم
      prisma.hotspotAdmin.findMany({
        where: adminId ? { id: adminId } : {},
        include: {
          _count: { select: { devices: true, vouchers: true } },
          devices: {
            select: {
              id: true, name: true, wifiSSID: true, isActive: true,
              _count: { select: { sessions: { where: { status: 'ACTIVE' } } } },
            },
          },
          vouchers: {
            select: { status: true, dataUsedMB: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      // جلسات اليوم
      prisma.session.count({
        where: {
          startedAt: { gte: todayStart },
          ...(adminId && { device: { hotspotAdminId: adminId } }),
        },
      }),
      // إحصائيات لكل كافيه (أدمن)
      prisma.hotspotAdmin.findMany({
        where: adminId ? { id: adminId } : {},
        select: {
          id: true, name: true, username: true, isActive: true,
          devices: {
            select: {
              id: true, name: true, wifiSSID: true, isActive: true,
              sessions: {
                where: { status: 'ACTIVE' },
                select: { id: true },
              },
              _count: { select: { vouchers: { where: { status: 'UNUSED' } } } },
            },
          },
          vouchers: {
            where: { usedAt: { gte: todayStart } },
            select: { id: true, status: true },
          },
          _count: { select: { vouchers: true } },
        },
        orderBy: { name: 'asc' },
      }),
      // تقرير الاستهلاك بالميجا لكل جهاز
      prisma.session.groupBy({
        by: ['deviceId'],
        where: adminId ? { device: { hotspotAdminId: adminId } } : {},
        _sum:   { dataInMB: true, dataOutMB: true, timeUsedMin: true },
        _count: { id: true },
      }),
    ])

    // ربط الاستهلاك بأسماء الأجهزة
    const deviceMap: Record<string, string> = {}
    devices.forEach(d => { deviceMap[d.id] = d.name })

    const consumption = consumptionRaw
      .map(r => ({
        deviceId:   r.deviceId,
        deviceName: deviceMap[r.deviceId] || r.deviceId,
        totalInMB:  r._sum.dataInMB  || 0,
        totalOutMB: r._sum.dataOutMB || 0,
        totalMB:    (r._sum.dataInMB || 0) + (r._sum.dataOutMB || 0),
        sessions:   r._count.id,
        timeMin:    r._sum.timeUsedMin || 0,
      }))
      .sort((a, b) => b.totalMB - a.totalMB)

    return NextResponse.json({
      summary: {
        totalActiveSessions: activeSessions.length,
        totalActiveDevices:  devices.filter(d => d.isActive).length,
        totalDevices:        devices.length,
        totalDataInMB:  activeSessions.reduce((s, x) => s + x.dataInMB, 0),
        totalDataOutMB: activeSessions.reduce((s, x) => s + x.dataOutMB, 0),
      },
      activeSessions,
      devices,
      admins: admins.map(({ password: _, ...a }: any) => ({
        ...a,
        activeSessionsCount: a.devices.reduce((s: number, d: any) => s + d._count.sessions, 0),
        activeVouchers:  a.vouchers.filter((v: any) => v.status === 'ACTIVE').length,
        unusedVouchers:  a.vouchers.filter((v: any) => v.status === 'UNUSED').length,
        totalDataUsedMB: a.vouchers.reduce((s: number, v: any) => s + v.dataUsedMB, 0),
      })),
      consumption,
      todaySessions,
      cafeStats: cafeStats.map(a => ({
        id: a.id, name: a.name, username: a.username, isActive: a.isActive,
        activeSessions: a.devices.reduce((s:number,d:any)=>s+d.sessions.length,0),
        activeDevices:  a.devices.filter((d:any)=>d.isActive).length,
        totalDevices:   a.devices.length,
        unusedVouchers: a.devices.reduce((s:number,d:any)=>s+d._count.vouchers,0),
        todayVouchers:  a.vouchers.length,
        devices: a.devices.map((d:any)=>({ id:d.id, name:d.name, ssid:d.wifiSSID, isActive:d.isActive, activeSessions:d.sessions.length, unusedVouchers:d._count.vouchers })),
      })),
    })
  } catch (err) {
    console.error('[superadmin stats]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
