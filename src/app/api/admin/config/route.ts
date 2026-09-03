import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ── هل السيرفر HTTPS-only (زي Vercel)؟ أي hostname بدل IP ──
function isHttpsServer(ip: string): boolean {
  return !/^\d/.test(ip)
}

// ── جسر HTTPS على الراوتر نفسه (uhttpd CGI + busybox wget) ──
// ليه محتاجين الجسر أصلاً؟
// 1) نسخة wifidog العادية في OpenWrt مفيهاش TLS خالص
// 2) نسخة wifidog-tls بتتكلم TLS 1.0 بس، و Vercel بيرفض TLS 1.0 (بيقبل 1.2+)
// 3) Vercel نفسه HTTPS-only — مفيش HTTP على بورت 80 (بيرد 308)
// الحل: wifidog يتكلم HTTP مع uhttpd على الراوتر نفسه (بورت 80)،
// والـ CGI بيمرر الطلب للسيرفر عبر wget HTTPS (TLS 1.2 عن طريق libustream)
// ── wifidog.conf ──────────────────────────────
function buildConf(d: {
  gatewayId: string; gatewayInterface: string; externalInterface: string
  clientTimeout: number; httpMaxConn: number
  routerIp?: string
}, ip: string, port: number): string {
  const relay    = isHttpsServer(ip)
  const routerIp = d.routerIp || '192.168.1.1'
  const authHost = relay ? routerIp : ip
  const authPort = relay ? '__UHTTPD_PORT__' : String(port)
  const authPath = relay ? '/cgi-bin/go?ep=/' : '/api/wifidog/'
  return [
    `GatewayID           ${d.gatewayId}`,
    `GatewayAddress      ${routerIp}`,
    `ExternalInterface   ${d.externalInterface}`,
    `GatewayInterface    ${d.gatewayInterface}`,
    ``,
    `AuthServer {`,
    `    Hostname        ${authHost}`,
    `    HTTPPort        ${authPort}`,
    `    SSLAvailable    no`,
    `    Path            ${authPath}`,
    `}`,
    ``,
    `GatewayPort         2060`,
    `HTTPDMaxConn        ${d.httpMaxConn}`,
    `ClientTimeout       ${d.clientTimeout}`,
    `CheckInterval       120`,
    ``,
    `PopularServers      kernel.org,ieee.org`,
    ``,
    `FirewallRuleSet global {`,
    `    FirewallRule allow to ${ip}`,
    ...(relay ? [`    FirewallRule allow to ${routerIp}`] : []),
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
  id?: string
  gatewayId: string; gatewayInterface: string; externalInterface: string
  clientTimeout: number; httpMaxConn: number; routerIp: string; tunnelPort?: number | null
  wifiSSID?: string | null
}, ip: string, port: number): string {
  const GW         = d.gatewayId
  const IP         = ip
  const PORT       = String(port)
  const ROUT       = d.routerIp || '192.168.1.1'
  const WANT_SSID  = d.wifiSSID || 'Free-WiFi'
  const DEV_ID     = d.id || ''
  // tunnelPort = البورت الـ reverse tunnel بيتعلق عليه على السيرفر
  // مثلاً 2201 يعني: reverse tunnel بورت 2201 على سيرفر SSH خارجي
  const TUNNEL_PORT   = String(d.tunnelPort || 0)
  const TUNNEL_SERVER = process.env.SSH_TUNNEL_HOST || ip
  // الـ tunnel محتاج سيرفر SSH حقيقي — بدون SSH_TUNNEL_HOST نتجاهله (مثلاً على Vercel)
  const HAS_TUNNEL    = !!(d.tunnelPort && d.tunnelPort > 0 && process.env.SSH_TUNNEL_HOST)

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
echo "║  ssh ubuntu@${TUNNEL_SERVER} 'echo \"\$PUB_KEY\" >> ~/.ssh/authorized_keys' ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo "\$PUB_KEY"
echo ""

# 3. سكريبت الـ tunnel
cat > /usr/bin/hotspot-tunnel << 'TUNNEL_EOF'
#!/bin/sh
# SSH Reverse Tunnel — يحفظ الاتصال دايماً
SERVER="${TUNNEL_SERVER}"
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
# دعم HTTPS للـ wget (لازم للجسر ولمزامنة الـ SSID مع السيرفر)
opkg install libustream-mbedtls ca-bundle ca-certificates 2>/dev/null || opkg install libustream-openssl ca-bundle ca-certificates 2>/dev/null || true

echo ">>> تركيب جسر HTTPS على الراوتر (لأن السيرفر HTTPS-only)..."
# wifidog مش بيعرف يتكلم TLS 1.2 — الجسر بيستقبل طلباته محلياً ويمررها للسيرفر بـ wget
mkdir -p /www/cgi-bin
cat > /www/cgi-bin/go << 'RELAY_EOF'
${relayShellScript(IP)}
RELAY_EOF
chmod +x /www/cgi-bin/go
opkg install uhttpd >/dev/null 2>&1 || true
if uci -q get uhttpd.main >/dev/null 2>&1; then
  if ! uci -q get uhttpd.main.cgi_prefix >/dev/null 2>&1; then
    uci set uhttpd.main.cgi_prefix='/cgi-bin'
    uci commit uhttpd
    /etc/init.d/uhttpd restart 2>/dev/null || true
  fi
fi
/etc/init.d/uhttpd enable 2>/dev/null || true
/etc/init.d/uhttpd start 2>/dev/null || true

echo ">>> كتابة /etc/wifidog.conf..."
rm -f /etc/wifidog.conf
${confLines}
# نستبدل بورت uhttpd الفعلي في الكونفج (افتراضي 80)
UPORT=$(uci -q get uhttpd.main.listen_http 2>/dev/null | tr ' ' '\\n' | grep -v '^\\[' | head -n1 | sed 's/.*://')
[ -z "$UPORT" ] && UPORT=80
sed -i "s/__UHTTPD_PORT__/$UPORT/" /etc/wifidog.conf

echo ">>> تغيير اسم الشبكتين (2.4GHz + 5GHz) إلى: ${shellQuote(WANT_SSID)}"
# تطبيق اسم الشبكة المحدد في النظام على كل واجهات الواي فاي
i=0
while uci get wireless.@wifi-iface[$i] >/dev/null 2>&1; do
  uci set wireless.@wifi-iface[$i].ssid=${shellQuote(WANT_SSID)}
  i=$((i+1))
done
uci commit wireless
wifi reload 2>/dev/null || true

echo ">>> تركيب مزامنة اسم الشبكة مع السيرفر (كل 5 دقايق)..."
cat > /usr/bin/hotspot-ssid-sync << 'SYNC_EOF'
#!/bin/sh
# بيجيب اسم الشبكة المطلوب من السيرفر ويطبقه على كل الواجهات لو اتغير
SRV="${IP}"
DEV="${DEV_ID}"
[ -z "$DEV" ] && exit 0
WANT=$(wget -q -O - --no-check-certificate "https://$SRV/api/admin/config?deviceId=$DEV&type=ssid" 2>/dev/null | tr -d '[:space:]')
[ -z "$WANT" ] && exit 0
CHANGED=0
i=0
while uci get wireless.@wifi-iface[$i] >/dev/null 2>&1; do
  CUR=$(uci get wireless.@wifi-iface[$i].ssid 2>/dev/null)
  if [ "$CUR" != "$WANT" ]; then
    uci set wireless.@wifi-iface[$i].ssid="$WANT"
    CHANGED=1
  fi
  i=$((i+1))
done
if [ "$CHANGED" = "1" ]; then
  uci commit wireless
  wifi reload
  echo "$(date): SSID => $WANT"
fi
SYNC_EOF
chmod +x /usr/bin/hotspot-ssid-sync
(crontab -l 2>/dev/null | grep -v hotspot-ssid-sync; echo "*/5 * * * * /usr/bin/hotspot-ssid-sync >/dev/null 2>&1") | crontab - 2>/dev/null || (echo "*/5 * * * * /usr/bin/hotspot-ssid-sync >/dev/null 2>&1" >> /etc/crontabs/root && /etc/init.d/cron restart 2>/dev/null || true)

echo ">>> حفظ اوامر الادارة..."

# ─── hotspot-ssid ───────────────────────────────────────────────
cat > /usr/bin/hotspot-ssid << 'ENDOFFILE'
#!/bin/sh
NEW="$1"
if [ -z "$NEW" ]; then
    i=0
    while uci get wireless.@wifi-iface[$i] >/dev/null 2>&1; do
        echo "SSID[$i]: $(uci get wireless.@wifi-iface[$i].ssid 2>/dev/null || echo unknown)"
        i=$((i+1))
    done
    echo "الاستخدام: hotspot-ssid 'اسم جديد'"
    exit 0
fi
i=0
while uci get wireless.@wifi-iface[$i] >/dev/null 2>&1; do
    uci set wireless.@wifi-iface[$i].ssid="$NEW"
    i=$((i+1))
done
uci commit wireless
wifi reload
echo "تم تغيير كل الشبكات => $NEW"
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
echo ">>> اختبار جسر HTTPS (لازم يرجع Pong)..."
TEST_RESP=$(wget -q -T 25 -O - "http://127.0.0.1:\${UPORT}/cgi-bin/go?ep=/ping/?gw_id=SELFTEST" 2>/dev/null || true)
if [ "\${TEST_RESP}" = "Pong" ]; then
  echo "✅ الجسر شغال — الراوتر يوصل للسيرفر بنجاح والتفعيل هيشتغل"
else
  echo "⚠️ الجسر ما رجعش Pong — شغّل الأمر ده وابعت النتيجة:"
  echo "   wget -O - 'http://127.0.0.1:\${UPORT}/cgi-bin/go?ep=/ping/'"
fi

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
echo "║  ssh -J ubuntu@${TUNNEL_SERVER} -p ${TUNNEL_PORT} root@localhost    ║"
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

// ── سكريبت الجسر: CGI بيمرر طلبات wifidog للسيرفر عبر HTTPS ──
// بيتركب على /www/cgi-bin/go و wifidog بيستناده من خلال
// Path = /cgi-bin/go?ep=/  →  الطلب بيطلع:
//   /cgi-bin/go?ep=/auth/?stage=login&token=...
// الآندبوينت بيتبني من قيمة ep والباقي بيتبعت زي ما هو للسيرفر
function relayShellScript(serverHost: string): string {
  return `#!/bin/sh
# جسر HTTPS بين wifidog والسيرفر — بيشغّل على uhttpd CGI
SRV="${serverHost}"
QS="$QUERY_STRING"
[ -z "$QS" ] && QS="ep=/ping/?"
ALL="\${QS#ep=}"
case "$ALL" in
  *\\?*) EP="\${ALL%%\\?*}"; REST="\${ALL#*\\?}" ;;
  *)    EP="$ALL"; REST="" ;;
esac
EP="\${EP#/}"
case "$EP" in
  ping/*|auth/*)
    # طلبات داخلية من wifidog نفسه — نمرر الرد الخام
    RESP=$(wget -q -T 15 -O - --no-check-certificate "https://\${SRV}/api/wifidog/\${EP}?\${REST}" 2>/dev/null)
    RC=$?
    echo "Content-Type: text/plain"
    echo ""
    if [ $RC -eq 0 ] && [ -n "$RESP" ]; then
      echo "$RESP"
    elif echo "$EP" | grep -q "^auth"; then
      echo "Auth: 0"
    else
      echo "ERR"
    fi
    ;;
  *)
    # طلبات من متصفح الموبايل — نحوله مباشرة للسيرفر (الفايرول مسموح للسيرفر)
    echo "Content-Type: text/html"
    echo ""
    echo "<!DOCTYPE html><html><head><meta charset='utf-8'><meta http-equiv='refresh' content='0;url=https://\${SRV}/api/wifidog/\${EP}?\${REST}'></head><body style='font-family:sans-serif;text-align:center;padding:40px;background:#070B12;color:#00D4FF'>جاري فتح صفحة الدخول...</body></html>"
    ;;
esac
`
}

// ── سكريبت إصلاح شامل للراوترات المثبّتة بالفعل ──
// بيصلّح السبب الجذري لمشكلة "We did not get a valid answer from the central server":
// wifidog 1.3.0 مش بيتكلم HTTPS خالص — السكريبت بيركّب جسر محلي (uhttpd CGI + wget)
// وبيكتب /etc/wifidog.conf كامل من جديد بحيث wifidog يتكلم مع الجسر المحلي بس
function buildRelayFix(d: {
  gatewayId: string; routerIp?: string; gatewayInterface?: string; externalInterface?: string
  clientTimeout?: number; httpMaxConn?: number
}, serverHost: string): string {
  const gwId     = d.gatewayId
  const routerIp = d.routerIp || '192.168.1.1'
  const extIf    = d.externalInterface || 'eth0.1'
  const lanIf    = d.gatewayInterface || 'br-lan'
  const cTimeout = d.clientTimeout ?? 10
  const maxConn  = d.httpMaxConn ?? 253
  return `#!/bin/sh
# ================================================================
#  relay-fix.sh — إصلاح اتصال wifidog بالسيرفر عبر جسر HTTPS محلي
#  GatewayID : ${gwId}
#  السيرفر   : ${serverHost}
#  المشكلة   : wifidog مش بيتكلم HTTPS — وده كان بيعمل خطأ
#              "We did not get a valid answer from the central server"
#
#  التشغيل على الراوتر:
#    scp relay-fix.sh root@${routerIp}:/tmp/
#    ssh root@${routerIp}
#    sh /tmp/relay-fix.sh
# ================================================================
GWID="${gwId}"
SRV="${serverHost}"
GWIP="${routerIp}"
EXTIF="${extIf}"
LANIF="${lanIf}"
CTIMEOUT="${cTimeout}"
MAXCONN="${maxConn}"
BRIDGE_OK=0

diag() {
  echo ""
  echo "=============== تشخيص — ابعت النص ده لو لسه في مشكلة ==============="
  echo "--- uhttpd ---"
  uci show uhttpd.main 2>/dev/null || echo "(مفيش uhttpd config)"
  netstat -tln 2>/dev/null | grep -E ':(80|8080|2060) ' || echo "(مفيش مستمع على 80/8080/2060)"
  echo "--- /etc/wifidog.conf ---"
  cat /etc/wifidog.conf 2>/dev/null || echo "(الملف مش موجود)"
  echo "--- اختبار الجسر المحلي ---"
  wget -q -T 10 -O - "http://127.0.0.1:80/cgi-bin/go?ep=/ping/?gw_id=SELFTEST" 2>&1 || echo "(فشل)"
  echo ""
  echo "--- اختبار السيرفر مباشرة HTTPS ---"
  wget -q -T 20 -O - --no-check-certificate "https://${serverHost}/api/wifidog/ping/" 2>&1 || echo "(فشل)"
  echo "===================================================================="
}

echo "=================================================="
echo "  إصلاح اتصال wifidog — $GWID"
echo "=================================================="

echo ">>> [1/7] تثبيت الحزم المطلوبة (ممكن ياخد دقيقة)..."
opkg update >/tmp/rf_opkg.log 2>&1
opkg install wifidog >>/tmp/rf_opkg.log 2>&1
opkg install uhttpd >>/tmp/rf_opkg.log 2>&1
opkg install libustream-mbedtls ca-bundle ca-certificates >>/tmp/rf_opkg.log 2>&1 || \
  opkg install libustream-openssl ca-bundle ca-certificates >>/tmp/rf_opkg.log 2>&1

echo ">>> [2/7] اختبار وصول الراوتر للسيرفر (HTTPS)..."
SRVTEST=$(wget -q -T 20 -O - --no-check-certificate "https://${serverHost}/api/wifidog/ping/" 2>/dev/null)
if [ "$SRVTEST" != "Pong" ]; then
  echo ""
  echo "❌ الراوتر نفسه مش قادر يوصل للسيرفر!"
  echo "   ده معناه إن المشكلة في إنترنت الراوتر أو DNS — مش في wifidog"
  echo "   جرب الأمر ده وشوف النتيجة:"
  echo "   wget -O - --no-check-certificate 'https://${serverHost}/api/wifidog/ping/'"
  diag
  exit 1
fi
echo "    ✅ الراوتر يوصل للسيرفر بنجاح"

echo ">>> [3/7] كتابة الجسر /www/cgi-bin/go..."
mkdir -p /www/cgi-bin
cat > /www/cgi-bin/go << 'RELAY_EOF'
${relayShellScript(serverHost)}
RELAY_EOF
chmod +x /www/cgi-bin/go

echo ">>> [4/7] ضبط uhttpd..."
if uci -q get uhttpd.main >/dev/null 2>&1; then
  if ! uci -q get uhttpd.main.cgi_prefix >/dev/null 2>&1; then
    uci set uhttpd.main.cgi_prefix='/cgi-bin'
    uci commit uhttpd
  fi
fi
/etc/init.d/uhttpd enable 2>/dev/null
/etc/init.d/uhttpd restart 2>/dev/null || /etc/init.d/uhttpd start 2>/dev/null
sleep 1
UPORT=$(uci -q get uhttpd.main.listen_http 2>/dev/null | tr ' ' '\n' | grep -v '^\[' | head -n1 | sed 's/.*://')
[ -z "$UPORT" ] && UPORT=80
echo "    uhttpd يعمل على البورت $UPORT"

echo ">>> [5/7] كتابة /etc/wifidog.conf جديدة (السيرفر = الجسر المحلي)..."
cp /etc/wifidog.conf /etc/wifidog.conf.bak 2>/dev/null
cat > /etc/wifidog.conf << CONF_EOF
GatewayID           ${gwId}
GatewayAddress      ${routerIp}
ExternalInterface   ${extIf}
GatewayInterface    ${lanIf}

AuthServer {
    Hostname        ${routerIp}
    HTTPPort        __UPORT__
    SSLAvailable    no
    Path            /cgi-bin/go?ep=/
}

GatewayPort         2060
HTTPDMaxConn        ${maxConn}
ClientTimeout       ${cTimeout}
CheckInterval       120

PopularServers      kernel.org,ieee.org

FirewallRuleSet global {
    FirewallRule allow to ${serverHost}
    FirewallRule allow to ${routerIp}
}
FirewallRuleSet validating-users {
    FirewallRule allow to 0.0.0.0/0
}
FirewallRuleSet known-users {
    FirewallRule allow to 0.0.0.0/0
}
FirewallRuleSet unknown-users {
    FirewallRule block udp port 53
    FirewallRule block tcp port 53
    FirewallRule block udp port 67
    FirewallRule block tcp port 67
}
FirewallRuleSet locked-users {
    FirewallRule block to 0.0.0.0/0
}
CONF_EOF
sed -i "s/__UPORT__/$UPORT/" /etc/wifidog.conf

echo ">>> [6/7] اختبار الجسر (لازم يرجع Pong)..."
T=$(wget -q -T 25 -O - "http://127.0.0.1:$UPORT/cgi-bin/go?ep=/ping/?gw_id=SELFTEST" 2>/dev/null)
if [ "$T" = "Pong" ]; then
  BRIDGE_OK=1
  echo "    ✅ الجسر شغال تمام"
else
  echo "    البورت $UPORT مش شغال — بجرب 8080..."
  uci set uhttpd.main.listen_http='0.0.0.0:8080'
  uci commit uhttpd
  /etc/init.d/uhttpd restart 2>/dev/null
  sleep 1
  UPORT=8080
  sed -i "s/HTTPPort        .*/HTTPPort        8080/" /etc/wifidog.conf
  T=$(wget -q -T 25 -O - "http://127.0.0.1:8080/cgi-bin/go?ep=/ping/?gw_id=SELFTEST" 2>/dev/null)
  if [ "$T" = "Pong" ]; then
    BRIDGE_OK=1
    echo "    ✅ الجسر شغال على 8080"
  else
    echo "    ❌ الجسر ما رجعش Pong — شوف التشخيص تحت"
  fi
fi

echo ">>> [7/7] إعادة تشغيل wifidog..."
/etc/init.d/wifidog enable 2>/dev/null
/etc/init.d/wifidog restart 2>/dev/null || /etc/init.d/wifidog start 2>/dev/null

echo ""
if [ "$BRIDGE_OK" = "1" ]; then
  echo "======================================"
  echo "  ✅ تم الإصلاح بنجاح!"
  echo ""
  echo "  الخطوة الأخيرة من الموبايل:"
  echo "  1. اعزل شبكة الواي فاي"
  echo "  2. ارجع اتصل تاني"
  echo "  3. افتح أي موقع → ادخل الكرت"
  echo "  4. النت هيفتح عادي"
  echo "======================================"
else
  diag
fi
echo ""
`
}

// ── Route ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const p        = new URL(req.url).searchParams
    const deviceId = p.get('deviceId')
    const type     = p.get('type') || 'conf'
    const serverIp  = process.env.SERVER_IP  || new URL(req.url).host
    const serverPort = parseInt(process.env.SERVER_PORT || '443')

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

    if (type === 'script') {
      const text = buildScript(device, serverIp, serverPort)
      return new NextResponse(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="install-${device.gatewayId}.sh"`,
        },
      })
    }

    if (type === 'relay-fix') {
      const text = buildRelayFix(device, serverIp)
      return new NextResponse(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="relay-fix-${device.gatewayId}.sh"`,
        },
      })
    }

    const text = buildConf(device, serverIp, serverPort).replace('__UHTTPD_PORT__', '80')
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
