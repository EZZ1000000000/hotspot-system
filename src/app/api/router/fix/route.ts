import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildRelayFixScript, resolveAuthIps } from '@/wifidog/fix-script'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════
// GET /api/router/fix?gw_id=GW-XXXX
// بيطلع سكريبت POSIX sh يشغّله المستخدم على الراوتر (SSH)
// لإصلاح مشكلة التفعيل (WiFiDog TLS Relay) — نفس سكريبت
// /api/admin/config?type=relay-fix بس بالـ gatewayId
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const gwId = new URL(req.url).searchParams.get('gw_id')
  if (!gwId) return new Response('Missing gw_id', { status: 400 })

  const device = await prisma.device.findUnique({ where: { gatewayId: gwId } })
  if (!device) return new Response(`Device not found: ${gwId}`, { status: 404 })

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || new URL(req.url).origin
  const authHost  = new URL(serverUrl).hostname
  const realIps   = await resolveAuthIps(authHost)

  const script = buildRelayFixScript({
    deviceName: device.name,
    gwId: device.gatewayId,
    gatewayInterface: device.gatewayInterface,
    externalInterface: device.externalInterface,
    clientTimeout: device.clientTimeout,
    authHost,
    realIps,
  })

  return new Response(script, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `inline; filename="fix-${device.gatewayId}.sh"`,
      'Cache-Control': 'no-store',
    },
  })
}
