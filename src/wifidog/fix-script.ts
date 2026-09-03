import dns from 'dns/promises'

// ═══════════════════════════════════════════════════════════
// WiFiDog TLS Relay Fix Script Builder
//
// المشكلة: wifidog 1.3.0 مش بيدعم TLS (USE_CYASSL مش مفعّل
//          في حزمة OpenWrt) — SSLAvailable yes بيأثر على
//          redirect المتصفح بس، مش على اتصال الراوتر نفسه.
//          الراوتر بيبعت HTTP عادي على بورت 443 → Vercel بيرفض.
//          (وكمان Vercel بيرفض أي TLS من غير SNI بـ 403)
//
// الحل: socat relay محلي على الراوتر:
//   wifidog → 127.0.0.1:8081 (HTTP عادي)
//           → socat (TLS + openssl-snihost) → السيرفر:443
//   + /etc/hosts: الدومين يشاور على 127.0.0.1 محلياً (للراوتر فقط
//     عشان wifidog يبعت Host header الصحيح)
//   + dnsmasq nohosts=1: العملاء يشوفوا الدومين الحقيقي عادي
//   + SSLAvailable yes + SSLPort 443: المتصفح يوصل للـ portal
//     مباشرة عبر https زي ما هو
// ═══════════════════════════════════════════════════════════

export function shellQuote(s: string): string {
  return "'" + String(s).replace(/'/g, "'\\''") + "'"
}

export async function resolveAuthIps(authHost: string): Promise<string[]> {
  try {
    return await dns.resolve4(authHost)
  } catch {
    try {
      return await dns.resolve4('cname.vercel-dns.com')
    } catch {
      return []
    }
  }
}

export function buildRelayFixScript(opts: {
  deviceName: string
  gwId: string
  gatewayInterface?: string
  externalInterface?: string
  clientTimeout?: number
  authHost: string
  realIps: string[]
}): string {
  const gwId          = shellQuote(opts.gwId)
  const authHost      = shellQuote(opts.authHost)
  const bakedIps      = shellQuote(opts.realIps.join(' ') || '76.76.21.21')
  const gwInterface   = shellQuote(opts.gatewayInterface || 'br-lan')
  const extInterface  = shellQuote(opts.externalInterface || 'eth0.1')
  const clientTimeout = parseInt(String(opts.clientTimeout ?? '10'), 10) || 10
  const deviceName    = opts.deviceName || opts.gwId

  return `#!/bin/sh
# ================================================================
# 🛠️  إصلاح مشكلة التفعيل — WiFiDog TLS Relay
# الجهاز    : ${deviceName}
# GatewayID : ${opts.gwId}
# السيرفر   : ${opts.authHost}
# التاريخ   : ${new Date().toISOString().slice(0, 10)}
# ================================================================
# المشكلة:
#   wifidog 1.3.0 مش بيدعم TLS (بيبعت HTTP عادي على بورت 443)
#   والسيرفر بيقبل HTTPS فقط
#   → الراوتر مش قادر يتحقق من التوكن
#   → "Error: We did not get a valid answer from the central server"
#
# الحل:
#   socat relay محلي على الراوتر:
#   wifidog → 127.0.0.1:8081 (HTTP عادي) → socat (TLS + SNI) → السيرفر
#   + /etc/hosts: الدومين يشاور على 127.0.0.1 محلياً (للراوتر فقط)
#   + dnsmasq nohosts: عشان العملاء يشوفوا الدومين الحقيقي عادي
# ================================================================

AUTHSERV=${authHost}
GW_ID=${gwId}
FALLBACK_IPS=${bakedIps}
GW_IF=${gwInterface}
EXT_IF=${extInterface}
CLIENT_TIMEOUT=${clientTimeout}
RELAY_PORT=8081

echo ""
echo "=============================================="
echo "  إصلاح التفعيل — ${deviceName}"
echo "=============================================="

# ────────────────────────────────────────────────
# [1/7] تثبيت socat
# ────────────────────────────────────────────────
echo ">>> [1/7] تثبيت socat..."
if ! command -v socat >/dev/null 2>&1; then
    opkg update >/tmp/fix_opkg.log 2>&1
    opkg install socat >>/tmp/fix_opkg.log 2>&1
fi
if ! command -v socat >/dev/null 2>&1; then
    echo "❌ فشل تثبيت socat — راجع /tmp/fix_opkg.log"
    tail -5 /tmp/fix_opkg.log
    exit 1
fi
echo "✅ socat جاهز"

# ────────────────────────────────────────────────
# [2/7] معرفة الـ IP الحقيقي للسيرفر
# (nslookup بيطلب من الـ DNS مباشرة — مش متأثر بـ /etc/hosts)
# ────────────────────────────────────────────────
echo ">>> [2/7] حل اسم السيرفر..."
REAL_IP=""
RAW=$(nslookup "$AUTHSERV" 2>/dev/null)
REAL_IP=$(printf '%s' "$RAW" | awk -F': ' '/Name/{f=1;next} f&&/Address/{print $2}' | grep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' | head -1)
if [ -z "$REAL_IP" ]; then
    REAL_IP=$(printf '%s' "$RAW" | grep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' | grep -v '^127\\.' | tail -1)
fi
if [ -z "$REAL_IP" ]; then
    RAW2=$(nslookup "$AUTHSERV" 8.8.8.8 2>/dev/null)
    REAL_IP=$(printf '%s' "$RAW2" | awk -F': ' '/Name/{f=1;next} f&&/Address/{print $2}' | grep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' | head -1)
fi
if [ -z "$REAL_IP" ]; then
    REAL_IP=$(echo $FALLBACK_IPS | cut -d' ' -f1)
    echo "⚠️  DNS فشل — استخدام IP الاحتياطي: $REAL_IP"
fi
echo "✅ IP السيرفر: $REAL_IP"

# ────────────────────────────────────────────────
# [3/7] /etc/hosts — الراوتر يشوف الدومين محلياً
# (ده اللي بيخلي wifidog يبعت Host الصحيح مع التحويل للـ relay)
# ────────────────────────────────────────────────
echo ">>> [3/7] إعداد /etc/hosts..."
touch /etc/hosts
sed -i "/[[:space:]]\${AUTHSERV}$/d" /etc/hosts 2>/dev/null
echo "127.0.0.1 \${AUTHSERV}" >> /etc/hosts
echo "✅ الراوتر هيوصل للسيرفر عبر الـ relay"

# ────────────────────────────────────────────────
# [4/7] حماية عملاء الـ WiFi من التأثير
# dnsmasq nohosts=1 → العملاء يحلوا الدومين طبيعي (IP الحقيقي)
# ────────────────────────────────────────────────
echo ">>> [4/7] حماية DNS للعملاء..."
uci -q set dhcp.@dnsmasq[0].nohosts='1'
uci -q commit dhcp
/etc/init.d/dnsmasq restart >/dev/null 2>&1
echo "✅ العملاء مش متأثرين"

# ────────────────────────────────────────────────
# [5/7] خدمة الـ relay (socat + watchdog)
# ────────────────────────────────────────────────
echo ">>> [5/7] إعداد خدمة الـ relay..."
cat > /usr/bin/hotspot-relay.sh << 'RELEOF'
#!/bin/sh
# Hotspot TLS Relay Watchdog — socat 127.0.0.1:8081 → TLS → AuthServer:443
AUTHSERV="__AUTHSERV__"
GW_ID="__GWID__"
FALLBACK_IPS="__FALLBACKIPS__"
RELAY_PORT=8081
CUR_IP=""
while true; do
    NEW_IP=""
    RAW=$(nslookup "$AUTHSERV" 2>/dev/null)
    NEW_IP=$(printf '%s' "$RAW" | awk -F': ' '/Name/{f=1;next} f&&/Address/{print $2}' | grep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' | head -1)
    [ -z "$NEW_IP" ] && NEW_IP=$(printf '%s' "$RAW" | grep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' | grep -v '^127\\.' | tail -1)
    [ -z "$NEW_IP" ] && NEW_IP=$(echo $FALLBACK_IPS | cut -d' ' -f1)
    LISTENING=$(netstat -tln 2>/dev/null | grep ":$RELAY_PORT " | grep 127.0.0.1 | wc -l)
    if [ "$LISTENING" = "0" ] || [ "$NEW_IP" != "$CUR_IP" ]; then
        killall socat 2>/dev/null
        sleep 1
        socat "TCP-LISTEN:$RELAY_PORT,bind=127.0.0.1,fork,reuseaddr" \\
              "OPENSSL:$NEW_IP:443,verify=0,openssl-snihost=$AUTHSERV" >/dev/null 2>&1 &
        CUR_IP="$NEW_IP"
    fi
    sleep 60
done
RELEOF
sed -i "s|__AUTHSERV__|\${AUTHSERV}|; s|__GWID__|\${GW_ID}|; s|__FALLBACKIPS__|\${FALLBACK_IPS}|" /usr/bin/hotspot-relay.sh
chmod +x /usr/bin/hotspot-relay.sh

cat > /etc/init.d/hotspot-relay << 'INITEOF'
#!/bin/sh /etc/rc.common
START=99
STOP=10
USE_PROCD=1
start_service() {
    procd_open_instance
    procd_set_param command /bin/sh /usr/bin/hotspot-relay.sh
    procd_set_param respawn 3600 5 0
    procd_close_instance
}
INITEOF
chmod +x /etc/init.d/hotspot-relay
killall socat 2>/dev/null
/etc/init.d/hotspot-relay enable
/etc/init.d/hotspot-relay restart >/dev/null 2>&1 || /etc/init.d/hotspot-relay start
sleep 3
if netstat -tln 2>/dev/null | grep -q ":8081 "; then
    echo "✅ الـ relay شغال على 127.0.0.1:8081"
else
    echo "⚠️  الـ relay لسه مش شغال — بنكمل وبنختبره في الخطوة الأخيرة"
fi

# ────────────────────────────────────────────────
# [6/7] كتابة /etc/wifidog.conf بالإعداد الصحيح
# HTTPPort 8081 → wifidog يتكلم مع الـ relay المحلي
# SSLAvailable yes → المتصفح يتحول للـ portal عبر https عادي
# ────────────────────────────────────────────────
echo ">>> [6/7] كتابة /etc/wifidog.conf..."
cp /etc/wifidog.conf /etc/wifidog.conf.bak 2>/dev/null
cat > /etc/wifidog.conf << WDEOF
GatewayID           \${GW_ID}
ExternalInterface   \${EXT_IF}
GatewayInterface    \${GW_IF}

AuthServer {
    Hostname         \${AUTHSERV}
    HTTPPort         8081
    SSLAvailable     yes
    SSLPort          443
    Path             /api/wifidog/
}

GatewayPort         2060
HTTPDMaxConn        253
ClientTimeout       \${CLIENT_TIMEOUT}
CheckInterval       30
PopularServers      kernel.org,ieee.org

FirewallRuleSet global {
    FirewallRule allow to \${REAL_IP}
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
WDEOF
echo "✅ wifidog.conf اتحديثت (القديمة محفوظة في wifidog.conf.bak)"

# ────────────────────────────────────────────────
# [7/7] إعادة تشغيل wifidog + اختبار نهائي
# ────────────────────────────────────────────────
echo ">>> [7/7] إعادة تشغيل wifidog..."
/etc/init.d/wifidog enable 2>/dev/null
/etc/init.d/wifidog restart
sleep 4

echo ""
echo ">>> اختبار الـ relay..."
RESP=$(printf "GET /api/wifidog/ping?gw_id=\${GW_ID} HTTP/1.0\\r\\nUser-Agent: WiFiDog 1.3.0\\r\\nHost: \${AUTHSERV}\\r\\n\\r\\n" \\
      | socat - "TCP:127.0.0.1:\${RELAY_PORT}" 2>/dev/null)
if printf '%s' "$RESP" | grep -q "Pong"; then
    echo "✅ اختبار الـ relay: نجح (Pong)!"
else
    echo "⚠️  اختبار ping فشل — بجرب اختبار auth..."
    RESP2=$(printf "GET /api/wifidog/auth/?stage=login&gw_id=\${GW_ID} HTTP/1.0\\r\\nUser-Agent: WiFiDog 1.3.0\\r\\nHost: \${AUTHSERV}\\r\\n\\r\\n" \\
          | socat - "TCP:127.0.0.1:\${RELAY_PORT}" 2>/dev/null)
    if printf '%s' "$RESP2" | grep -q "Auth:"; then
        echo "✅ اختبار auth: نجح (Auth:)!"
    else
        echo "❌ الـ relay مش شغال — معلومات التشخيص:"
        echo "--- socat ---";  command -v socat && socat -V 2>/dev/null | head -1
        echo "--- netstat 8081 ---"; netstat -tln 2>/dev/null | grep 8081 || echo "مش متركب!"
        echo "--- /etc/hosts ---"; tail -2 /etc/hosts
        echo "--- nslookup ---"; nslookup \${AUTHSERV} 2>/dev/null | tail -4
        echo "--- wifidog ---"; /etc/init.d/wifidog status 2>/dev/null || true
        echo ""
        echo "ابعت الرسايل دي للدعم الفني"
        exit 1
    fi
fi

echo ""
echo "=============================================="
echo " ✅ الإصلاح اكتمل بنجاح!"
echo ""
echo " GatewayID  : \${GW_ID}"
echo " AuthServer : \${AUTHSERV} عبر relay محلي"
echo ""
echo " 🔥 جرب دلوقتي:"
echo "    1- اعزل شبكة الواي فاي وارجع اتصل"
echo "    2- افتح أي موقع → هتتحول لصفحة الدخول"
echo "    3- اكتب رقم الكارت → النت هيفتح فوراً"
echo "=============================================="
echo ""
`
}
