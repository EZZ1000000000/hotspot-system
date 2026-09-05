import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildInstallScript } from '@/wifidog/install-script'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════
// GET /api/router/fix?gw_id=GW-XXXX
// بيرجع السكربت الشامل الموحد (نفس /api/admin/config?type=script)
// — سكربت SSH واحد لكل حاجة: تسطيب + إصلاح التفعيل + اختبار ذاتي
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const gwId = new URL(req.url).searchParams.get('gw_id')
  if (!gwId) return new Response('Missing gw_id', { status: 400 })

  const device = await prisma.device.findUnique({ where: { gatewayId: gwId } })
  if (!device) return new Response(`Device not found: ${gwId}`, { status: 404 })

  const serverHost = process.env.NEXT_PUBLIC_SERVER_URL
    ? new URL(process.env.NEXT_PUBLIC_SERVER_URL).host
    : new URL(req.url).host

  const script = buildInstallScript({
    deviceName:        device.name,
    deviceId:          device.id,
    gwId:              device.gatewayId,
    serverHost,
    routerIp:          device.routerIp,
    gatewayInterface:  device.gatewayInterface,
    externalInterface: device.externalInterface,
    clientTimeout:     device.clientTimeout,
    // اسم الشبكة الثابت: المحدد من المستخدم، ولو فاضي → اسم الجهاز (اسم الكافيه)
    wifiSSID:          (device.wifiSSID || '').trim() || device.name.trim(),
    tunnelPort:        device.tunnelPort,
    tunnelServer:      process.env.SSH_TUNNEL_HOST || null,
  })

  return new Response(script, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `inline; filename="install-${device.gatewayId}.sh"`,
      'Cache-Control': 'no-store',
    },
  })
}
