import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildInstallScript } from '@/wifidog/install-script'

export const dynamic = 'force-dynamic'

// ── wifidog.conf (type=conf) — نفس الإعداد اللي السكربت الموحد بيكتبه ──
function buildConf(d: {
  gatewayId: string; gatewayInterface: string; externalInterface: string
  clientTimeout: number; httpMaxConn: number
  routerIp?: string
}, serverHost: string, uhttpdPort: string): string {
  const routerIp = d.routerIp || '192.168.1.1'
  return [
    `GatewayID           ${d.gatewayId}`,
    `GatewayAddress      ${routerIp}`,
    `ExternalInterface   ${d.externalInterface}`,
    `GatewayInterface    ${d.gatewayInterface}`,
    ``,
    `AuthServer {`,
    `    Hostname        ${routerIp}`,
    `    HTTPPort        ${uhttpdPort}`,
    `    SSLAvailable    no`,
    `    Path            /cgi-bin/go?ep=/`,
    `}`,
    ``,
    `GatewayPort         2060`,
    `HTTPDMaxConn        ${d.httpMaxConn}`,
    `ClientTimeout       ${d.clientTimeout}`,
    `CheckInterval       60`,
    ``,
    `PopularServers      kernel.org,ieee.org`,
    ``,
    `FirewallRuleSet global {`,
    `    FirewallRule allow to ${serverHost}`,
    `}`,
    `FirewallRuleSet validating-users {`,
    `    FirewallRule allow to 0.0.0.0/0`,
    `}`,
    `FirewallRuleSet known-users {`,
    `    FirewallRule allow to 0.0.0.0/0`,
    `}`,
    `FirewallRuleSet unknown-users {`,
    `    FirewallRule block udp port 53`,
    `    FirewallRule block tcp port 53`,
    `    FirewallRule block udp port 67`,
    `    FirewallRule block tcp port 67`,
    `}`,
    `FirewallRuleSet locked-users {`,
    `    FirewallRule block to 0.0.0.0/0`,
    `}`,
  ].join('\n')
}

// ── السكربت الموحد (type=script أو type=relay-fix) ──
// سكربت SSH واحد لكل حاجة: تسطيب + جسر HTTPS + إصلاح التفعيل
// + اسم الشبكة + أوامر الإدارة + اختبار ذاتي — آمن إعادة التشغيل
function buildUnifiedScript(device: {
  id?: string
  name?: string
  gatewayId: string
  routerIp?: string
  gatewayInterface: string
  externalInterface: string
  clientTimeout: number
  wifiSSID?: string | null
  tunnelPort?: number | null
}, serverHost: string): string {
  return buildInstallScript({
    deviceName:        device.name,
    deviceId:          device.id,
    gwId:              device.gatewayId,
    serverHost,
    routerIp:          device.routerIp,
    gatewayInterface:  device.gatewayInterface,
    externalInterface: device.externalInterface,
    clientTimeout:     device.clientTimeout,
    wifiSSID:          device.wifiSSID,
    tunnelPort:        device.tunnelPort,
    tunnelServer:      process.env.SSH_TUNNEL_HOST || null,
  })
}

// ── Route ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const p        = new URL(req.url).searchParams
    const deviceId = p.get('deviceId')
    const type     = p.get('type') || 'conf'

    if (!deviceId)
      return NextResponse.json({ error: 'deviceId مطلوب' }, { status: 400 })

    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    if (!device)
      return NextResponse.json({ error: 'الجهاز غير موجود' }, { status: 404 })

    if (type === 'ssid') {
      return new NextResponse(device.wifiSSID || '', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    if (type === 'script' || type === 'relay-fix') {
      // النوعين بيرجعوا نفس السكربت الموحد — سكربت واحد لكل حاجة
      const serverHost = process.env.NEXT_PUBLIC_SERVER_URL
        ? new URL(process.env.NEXT_PUBLIC_SERVER_URL).host
        : new URL(req.url).host
      const text     = buildUnifiedScript(device, serverHost)
      const filename = type === 'script'
        ? `install-${device.gatewayId}.sh`
        : `relay-fix-${device.gatewayId}.sh`
      return new NextResponse(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    // type=conf — عرض الإعداد النهائي (السكربت الموحد بيكتبه تلقائياً)
    const serverHost = process.env.NEXT_PUBLIC_SERVER_URL
      ? new URL(process.env.NEXT_PUBLIC_SERVER_URL).host
      : new URL(req.url).host
    const text = buildConf(device, serverHost, '80')
    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="wifidog-${device.gatewayId}.conf"`,
      },
    })
  } catch (err) {
    console.error('[config]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
