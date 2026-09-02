import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ── wifidog.conf ──────────────────────────────────────────────
function buildConf(d: {
  gatewayId: string; gatewayInterface: string; externalInterface: string
  clientTimeout: number; httpMaxConn: number
}, ip: string, port: number): string {
  return [
    `GatewayID           ${d.gatewayId}`,
    `ExternalInterface   ${d.externalInterface}`,
    `GatewayInterface    ${d.gatewayInterface}`,
    ``,
    `AuthServer {`,
    `    Hostname        ${ip}`,
    `    HTTPPort        ${port}`,
    `    SSLAvailable    ${ip === 'babreizk.online' || !ip.match(/^\d/) ? 'yes' : 'no'}`,
    `    Path            /api/wifidog/`,
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
    `    FirewallRule allow to ${ip}`,
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

// ── install script ────────────────────────────────────────────
function buildScript(d: {
  gatewayId: string; gatewayInterface: string; externalInterface: string
  clientTimeout: number; httpMaxConn: number; routerIp: string; tunnelPort?: number | null
}, ip: string, port: number): string {
  const GW         = d.gatewayId
  const IP         = ip
  const PORT       = String(port)
  const ROUT       = d.routerIp || '192.168.1.1'
  // tunnelPort = البورت الـ reverse tunnel بيتعلق عليه على السيرفر
  // مثلاً 2201 يعني: ssh -p 22 root@babreizk.online → بيوصل للراوتر
  const TUNNEL_PORT = String(d.tunnelPort || 0)
  const HAS_TUNNEL  = d.tunnelPort && d.tunnelPort > 0

  const confLines = buildConf(d, ip, port)
    .split('\n')
    .map(line => `printf '%s\\n' ${shellQuote(line)} >> /etc/wifidog.conf`)
    .join('\n')

  // ── جزء الـ SSH Reverse Tunnel (بس لو tunnelPort محدد) ──
  const tunnelSection = HAS_TUNNEL ? `
echo ">>> إعداد SSH Reverse Tunnel (بورت ${TUNNEL_PORT})..."

# 1. توليد SSH key للراوتر (لو مش موجود)
if [ ! -f /etc/ssh/hotspot_rsa ]; then
  dropbearkey -t rsa -f /etc/ssh/hotspot_rsa 2>/dev/null || \
  ssh-keygen -t rsa -b 2048 -f /etc/ssh/hotspot_rsa -N '' 2>/dev/null || \
  echo "⚠️  مش قادر يولد مفتاح — تأكد من dropbear أو openssh"
fi

# 2. اطبع الـ Public Key عشان تضيفه على السيرفر
PUB_KEY=""
if [ -f /etc/ssh/hotspot_rsa.pub ]; then
  PUB_KEY=$(cat /etc/ssh/hotspot_rsa.pub)
elif [ -f /etc/ssh/hotspot_rsa ]; then
  PUB_KEY=$(dropbearkey -y -f /etc/ssh/hotspot_rsa 2>/dev/null | grep "^ssh-")
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Public Key — ضيفه على السيرفر:                         ║"
echo "║  ssh ubuntu@${IP} 'echo \"\$PUB_KEY\" >> ~/.ssh/authorized_keys' ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo "\$PUB_KEY"
echo ""

# 3. سكريبت الـ tunnel
cat > /usr/bin/hotspot-tunnel << 'TUNNEL_EOF'
#!/bin/sh
# SSH Reverse Tunnel — يحفظ الاتصال دايماً
SERVER="${IP}"
TUNNEL_PORT="${TUNNEL_PORT}"
KEY_FILE="/etc/ssh/hotspot_rsa"

start_tunnel() {
  # بيعمل reverse tunnel: السيرفر:TUNNEL_PORT → الراوتر:22
  ssh -i \$KEY_FILE \\
      -o StrictHostKeyChecking=no \\
      -o ServerAliveInterval=30 \\
      -o ServerAliveCountMax=3 \\
      -o ExitOnForwardFailure=yes \\
      -o BatchMode=yes \\
      -N -R \${TUNNEL_PORT}:localhost:22 \\
      ubuntu@\${SERVER} &
  echo \$! > /tmp/hotspot-tunnel.pid
  echo "✅ Tunnel started (PID \$!)"
}

stop_tunnel() {
  if [ -f /tmp/hotspot-tunnel.pid ]; then
    kill \$(cat /tmp/hotspot-tunnel.pid) 2>/dev/null
    rm -f /tmp/hotspot-tunnel.pid
    echo "🔴 Tunnel stopped"
  fi
}

status_tunnel() {
  if [ -f /tmp/hotspot-tunnel.pid ] && kill -0 \$(cat /tmp/hotspot-tunnel.pid) 2>/dev/null; then
    echo "🟢 Tunnel شغال (PID \$(cat /tmp/hotspot-tunnel.pid))"
    echo "   الدخول من السيرفر: ssh -p \${TUNNEL_PORT} root@localhost"
    echo "   أو من أي مكان:    ssh -J ubuntu@\${SERVER} -p \${TUNNEL_PORT} root@localhost"
  else
    echo "🔴 Tunnel متوقف"
  fi
}

case "\$1" in
  start)  start_tunnel ;;
  stop)   stop_tunnel ;;
  restart) stop_tunnel; sleep 1; start_tunnel ;;
  status) status_tunnel ;;
  *)
    # watch mode — يشغل ويراقب بشكل مستمر
    echo "🔄 Tunnel watchdog شغال..."
    while true; do
      if ! [ -f /tmp/hotspot-tunnel.pid ] || ! kill -0 \$(cat /tmp/hotspot-tunnel.pid) 2>/dev/null; then
        echo "\$(date): restarting tunnel..."
        start_tunnel
      fi
      sleep 30
    done
    ;;
esac
TUNNEL_EOF
chmod +x /usr/bin/hotspot-tunnel

# 4. cron job — يشيك على الـ tunnel كل دقيقتين ويعيد تشغيله لو وقع
(crontab -l 2>/dev/null | grep -v hotspot-tunnel; echo "*/2 * * * * /usr/bin/hotspot-tunnel start >/dev/null 2>&1") | crontab - 2>/dev/null || \
(echo "*/2 * * * * /usr/bin/hotspot-tunnel start >/dev/null 2>&1" >> /etc/crontabs/root && /etc/init.d/cron restart 2>/dev/null || true)

# 5. شغل الـ tunnel فوراً
/usr/bin/hotspot-tunnel start

echo "✅ SSH Tunnel جاهز على البورت ${TUNNEL_PORT}"
` : `
echo "ℹ️  SSH Tunnel غير مفعل (tunnelPort = 0)"
echo "   عشان تفعله: حدد tunnelPort في إعدادات الجهاز في الداشبورد"
`

  return `#!/bin/sh
# ================================================================
#  install-hotspot.sh
#  GatewayID   : ${GW}
#  Server      : ${IP}:${PORT}
#  Router IP   : ${ROUT}
#  Tunnel Port : ${HAS_TUNNEL ? TUNNEL_PORT + ' (SSH Reverse Tunnel مفعل)' : 'غير مفعل'}
#
#  خطوات التثبيت على OpenWrt:
#  1. ارفع السكريبت:
#     scp install-hotspot.sh root@${ROUT}:/tmp/
#  2. اتصل SSH:
#     ssh root@${ROUT}
#  3. شغّله:
#     sh /tmp/install-hotspot.sh
# ================================================================

set -e

GW_ID="${GW}"
SERVER_IP="${IP}"
SERVER_PORT="${PORT}"

echo ""
echo ">>> تثبيت wifidog..."
opkg update  2>/dev/null || true
opkg install wifidog 2>/dev/null || true

echo ">>> كتابة /etc/wifidog.conf..."
rm -f /etc/wifidog.conf
${confLines}

echo ">>> حفظ اوامر الادارة..."

# ─── hotspot-ssid ───────────────────────────────────────────────
cat > /usr/bin/hotspot-ssid << 'ENDOFFILE'
#!/bin/sh
NEW="$1"
if [ -z "$NEW" ]; then
    echo "الـ SSID الحالي: $(uci get wireless.@wifi-iface[0].ssid 2>/dev/null || echo unknown)"
    echo "الاستخدام: hotspot-ssid 'اسم جديد'"
    exit 0
fi
uci set wireless.@wifi-iface[0].ssid="$NEW"
uci commit wireless
wifi reload
echo "تم تغيير SSID => $NEW"
ENDOFFILE
chmod +x /usr/bin/hotspot-ssid

# ─── hotspot-restart ────────────────────────────────────────────
cat > /usr/bin/hotspot-restart << 'ENDOFFILE'
#!/bin/sh
/etc/init.d/wifidog restart && echo "تم اعادة التشغيل"
ENDOFFILE
chmod +x /usr/bin/hotspot-restart

# ─── hotspot-status ─────────────────────────────────────────────
cat > /usr/bin/hotspot-status << 'ENDOFFILE'
#!/bin/sh
GW="${GW}"
SRV="${IP}:${PORT}"
SSID=$(uci get wireless.@wifi-iface[0].ssid 2>/dev/null || echo unknown)
WD=$(pgrep wifidog >/dev/null 2>&1 && echo "🟢 شغال" || echo "🔴 متوقف")
UP=$(awk '{h=int($1/3600);m=int(($1%3600)/60);print h"h "m"m"}' /proc/uptime)
CL=$(arp -n 2>/dev/null | grep -v incomplete | grep -v Address | wc -l)
TUN=""
if [ -f /tmp/hotspot-tunnel.pid ] && kill -0 $(cat /tmp/hotspot-tunnel.pid) 2>/dev/null; then
  TUN="🟢 Tunnel شغال (بورت ${HAS_TUNNEL ? TUNNEL_PORT : 'N/A'})"
else
  TUN="🔴 Tunnel متوقف"
fi
echo "╔══════════════════════════════════════╗"
echo "║        Hotspot Status                ║"
echo "╠══════════════════════════════════════╣"
echo "║  GatewayID : \$GW"
echo "║  Server    : \$SRV"
echo "║  SSID      : \$SSID"
echo "║  wifidog   : \$WD"
echo "║  Tunnel    : \$TUN"
echo "║  Uptime    : \$UP"
echo "║  Clients   : \$CL أجهزة"
echo "╚══════════════════════════════════════╝"
ENDOFFILE
chmod +x /usr/bin/hotspot-status

${tunnelSection}

echo ">>> تفعيل wifidog عند التشغيل..."
/etc/init.d/wifidog enable
/etc/init.d/wifidog start 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅ تم التثبيت بنجاح!                       ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  GatewayID  : ${GW}"
echo "║  Server     : ${IP}:${PORT}"
${HAS_TUNNEL ? `echo "║  SSH Tunnel : بورت ${TUNNEL_PORT} على السيرفر              ║"` : ''}
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  الأوامر المتاحة:                                        ║"
echo "║    hotspot-status           ← الحالة                    ║"
echo "║    hotspot-ssid 'اسم'       ← تغيير WiFi                ║"
echo "║    hotspot-restart          ← إعادة تشغيل wifidog       ║"
${HAS_TUNNEL ? `echo "║    hotspot-tunnel status    ← حالة SSH Tunnel            ║"
echo "║    hotspot-tunnel start     ← تشغيل الـ Tunnel           ║"` : ''}
echo "╚══════════════════════════════════════════════════════════╝"
${HAS_TUNNEL ? `echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  الدخول للراوتر من أي مكان:                             ║"
echo "║  ssh -J ubuntu@${IP} -p ${TUNNEL_PORT} root@localhost    ║"
echo "║  أو من السيرفر مباشرة:                                  ║"
echo "║  ssh -p ${TUNNEL_PORT} root@localhost                    ║"
echo "╚══════════════════════════════════════════════════════════╝"` : ''}
echo ""
`
}

// single-quote safe
function shellQuote(s: string): string {
  if (s === '') return "''"
  return "'" + s.replace(/'/g, "'\\''") + "'"
}

// ── Route ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const p        = new URL(req.url).searchParams
    const deviceId = p.get('deviceId')
    const type     = p.get('type') || 'conf'
    const serverIp  = process.env.SERVER_IP  || 'babreizk.online'
    const serverPort = parseInt(process.env.SERVER_PORT || '443')

    if (!deviceId)
      return NextResponse.json({ error: 'deviceId مطلوب' }, { status: 400 })

    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    if (!device)
      return NextResponse.json({ error: 'الجهاز غير موجود' }, { status: 404 })

    if (type === 'script') {
      const text = buildScript(device, serverIp, serverPort)
      return new NextResponse(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="install-${device.gatewayId}.sh"`,
        },
      })
    }

    const text = buildConf(device, serverIp, serverPort)
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
