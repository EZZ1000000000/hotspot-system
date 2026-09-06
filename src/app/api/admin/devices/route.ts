// GET  /api/admin/devices?adminId=xxx
// POST /api/admin/devices   — GatewayID + tunnelPort بيتولدوا تلقائي
// PUT  /api/admin/devices   — تعديل جهاز
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

// توليد GatewayID فريد: GW-XXXX-XXXX
function generateGatewayId(): string {
  const part = () => randomBytes(2).toString('hex').toUpperCase()
  return `GW-${part()}-${part()}`
}

// توليد tunnelPort فريد — البورتات بتبدأ من 2201
// كل جهاز جديد بياخد بورت تلقائي مش متكرر
async function generateTunnelPort(): Promise<number> {
  const START_PORT = 2201
  const MAX_PORT   = 2999

  // جيب كل البورتات المستخدمة
  const used = await prisma.device.findMany({
    where:  { tunnelPort: { not: null } },
    select: { tunnelPort: true },
  })
  const usedPorts = new Set(used.map(d => d.tunnelPort))

  // أول بورت مش متخدم
  for (let p = START_PORT; p <= MAX_PORT; p++) {
    if (!usedPorts.has(p)) return p
  }
  throw new Error('كل البورتات اتخدمت!')
}

export async function GET(req: NextRequest) {
  const adminId = new URL(req.url).searchParams.get('adminId')
  // لو مفيش adminId — مترجعش أي حاجة (أمان)
  if (!adminId) return NextResponse.json([])
  const devices = await prisma.device.findMany({
    where: { hotspotAdminId: adminId },
    include: { _count: { select: { sessions: true, vouchers: true } } },
  })

  // ── تقارير نسخة السكربت (script-report:<gatewayId> من KeyValueStore) ──
  // الراوتر بيبلّغ عن نسخته من سكربت التسطيب + الحارس — واللوحة بتحطها
  // جوار كل جهاز: 🛡️ محدّث / ⚠️ محتاج تحديث
  try {
    const reports = await prisma.keyValueStore.findMany({
      where: { key: { in: devices.map(d => `script-report:${d.gatewayId}`) } },
    })
    const byGw = new Map<string, any>()
    for (const r of reports) {
      const gw = r.key.replace('script-report:', '')
      try { byGw.set(gw, JSON.parse(r.value)) } catch {}
    }
    return NextResponse.json(devices.map(d => ({
      ...d,
      scriptReport: byGw.get(d.gatewayId) || null,
    })))
  } catch {
    // لو التقارير مش متاحة — نرجع الأجهزة عادي من غيرها
    return NextResponse.json(devices)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      hotspotAdminId, name, location,
      routerIp, sshPassword, wifiSSID,
      gatewayInterface, externalInterface, clientTimeout,
    } = body

    const admin = await prisma.hotspotAdmin.findUnique({
      where: { id: hotspotAdminId },
      include: { _count: { select: { devices: true } } },
    })
    if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    if (admin._count.devices >= admin.maxDevices)
      return NextResponse.json({ error: `وصلت للحد الأقصى (${admin.maxDevices} أجهزة)` }, { status: 403 })

    // توليد GatewayID تلقائي + التأكد إنه unique
    let gatewayId = generateGatewayId()
    for (let i = 0; i < 10; i++) {
      const exists = await prisma.device.findUnique({ where: { gatewayId } })
      if (!exists) break
      gatewayId = generateGatewayId()
    }

    // توليد tunnelPort تلقائي فريد
    const tunnelPort = await generateTunnelPort()

    // اسم الشبكة الثابت: الاسم اللي المستخدم حدده
    // ولو سيبه فاضي → اسم الجهاز نفسه (اسم الكافيه) عشان الاسم عمره ما يضيع
    const fixedSSID = String(wifiSSID || '').trim() || String(name || '').trim() || null
    if (fixedSSID && fixedSSID.length > 32)
      return NextResponse.json({ error: 'اسم الشبكة لا يمكن أن يتجاوز 32 حرف' }, { status: 400 })

    const device = await prisma.device.create({
      data: {
        name,
        gatewayId,
        tunnelPort,
        location:          location          || null,
        routerIp:          routerIp          || '192.168.1.1',
        sshPassword:       sshPassword       || null,
        wifiSSID:          fixedSSID,
        gatewayInterface:  gatewayInterface  || 'br-lan',
        externalInterface: externalInterface || 'eth0.1',
        clientTimeout:     clientTimeout     || 10,
        hotspotAdminId,
      },
    })
    return NextResponse.json({ success: true, device }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, name, location, routerIp, sshPassword, wifiSSID, isActive } = await req.json()
    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })
    // اسم الشبكة الثابت — لو اتحدّث لازم ميبقاش فاضي و ميعداش 32 حرف
    const newSSID = (wifiSSID !== undefined && wifiSSID !== null) ? String(wifiSSID).trim() : undefined
    if (newSSID === '') return NextResponse.json({ error: 'اسم الشبكة مينفعش يبقى فاضي' }, { status: 400 })
    if (newSSID && newSSID.length > 32) return NextResponse.json({ error: 'اسم الشبكة لا يمكن أن يتجاوز 32 حرف' }, { status: 400 })
    const device = await prisma.device.update({
      where: { id },
      data: {
        ...(name        !== undefined && { name }),
        ...(location    !== undefined && { location }),
        ...(routerIp    !== undefined && { routerIp }),
        ...(sshPassword !== undefined && { sshPassword }),
        ...(newSSID     !== undefined && { wifiSSID: newSSID }),
        ...(isActive    !== undefined && { isActive }),
      },
    })
    return NextResponse.json({ success: true, device })
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'الجهاز غير موجود' }, { status: 404 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
