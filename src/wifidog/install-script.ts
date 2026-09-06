// ═══════════════════════════════════════════════════════════
// السكربت الموحد الشامل — سكربت SSH واحد لكل حاجة
//
// ده المولّد الوحيد في السستم لأي سكربت بيتحط على الراوتر.
// بيغني عن: سكربت التسطيب القديم + سكربت relay-fix + سكربت setup v2
//
// بيقوم بكل حاجة بالترتيب:
//   [0/9] كشف مكان كابل الإنترنت تلقائياً — لو متركب في منفذ LAN (زي LAN1)
//         بدل WAN بيظبطه فوراً (بيمنع: الموبايل يفتح نت على طول + صفحة الدخول ماتظهر
//         + الموبايل بيفضل عالق على "جاري الاتصال" — كل دي أعراض الكابل الغلط)
//   [1/9] تنضيف أي إصلاحات قديمة (socat relay / /etc/hosts / dnsmasq)
//         — دي كانت بتتعارض مع الجسر وبتكسر التفعيل
//   [2/9] تسطيب wifidog + iptables (جدار الاعتراض) + دعم HTTPS (libustream + ca-bundle) + uhttpd
//   [3/9] جسر HTTPS محلي (uhttpd CGI على /www/cgi-bin/go)
//         wifidog مش بيتكلم TLS 1.2 → الجسر بيستقبل طلباته محلياً
//         ويمررها للسيرفر عبر HTTPS، وبيعالج الـ trailing slash
//         اللي wifidog 1.3.0 بيضيفه (/api/wifidog/auth/?stage=...)
//   [4/9] كتابة /etc/wifidog.conf الإعداد الصحيح (الراوتر ← الجسر) بكشف تلقائي للواجهات
//   [5/9] تغيير اسم الشبكة على كل واجهات AP (2.4GHz + 5GHz)
//   [6/9] أوامر إدارة: hotspot-status / hotspot-ssid / hotspot-restart
//         / hotspot-test (اختبار الاتصال بالسيرفر في أي وقت)
//         / hotspot-doctor (فحص + إصلاح تلقائي لكل طبقات التفعيل في أي وقت)
//         / hotspot-watchdog (حارس ذاتي — شغال كل 5 دقايق من الكرون ويصلح أي حاجة وقعت لوحدها)
//   [7/9] مزامنة اسم الشبكة مع السيرفر كل 5 دقايق
//   [8/9] SSH Reverse Tunnel (لو متظبط على الجهاز فقط)
//   [9/9] تشغيل الخدمات + اختبار ذاتي كامل (ping + auth + الجسر + wifidog)
//
// السكريبت idempotent — آمن يشغّله أكتر من مرة (تسطيب جديد أو إصلاح)
// ═══════════════════════════════════════════════════════════

export function shellQuote(s: string): string {
  if (s === '') return "''"
  return "'" + String(s).replace(/'/g, "'\\''") + "'"
}

export interface InstallScriptOptions {
  deviceName?: string
  deviceId?: string
  gwId: string
  serverHost: string
  routerIp?: string
  gatewayInterface?: string
  externalInterface?: string
  clientTimeout?: number
  wifiSSID?: string | null
  tunnelPort?: number | null
  tunnelServer?: string | null
}

export function buildInstallScript(o: InstallScriptOptions): string {
  const gwId          = String(o.gwId || '').trim()
  const serverHost    = String(o.serverHost || '').trim()
  const deviceId      = String(o.deviceId || '').trim()
  const deviceName    = String(o.deviceName || o.gwId || '').trim()
  const routerIp      = String(o.routerIp || '192.168.1.1').trim()
  const gwIf          = String(o.gatewayInterface || 'br-lan').trim()
  const extIf         = String(o.externalInterface || 'eth0.1').trim()
  const clientTimeout = parseInt(String(o.clientTimeout ?? 10), 10) || 10
  const ssid          = String(o.wifiSSID || '').trim()
  const tunnelPort    = String(o.tunnelPort || 0)
  const tunnelServer  = String(o.tunnelServer || '').trim()
  const hasTunnel     = !!(tunnelPort && tunnelPort !== '0' && tunnelServer)
  // نسخة الدومين للـ sed regex (النقاط متجاهلة)
  const sedHost       = serverHost.replace(/\./g, '\\.')
  const today         = new Date().toISOString().slice(0, 10)

  if (!gwId || !serverHost) {
    throw new Error('gwId و serverHost مطلوبين لبناء السكربت')
  }

  return `#!/bin/sh
# ================================================================
# 🚀 HOTSPOT — السكربت الشامل الموحد (تسطيب + إصلاح في سكربت واحد)
# الجهاز    : ${deviceName}
# GatewayID : ${gwId}
# السيرفر   : ${serverHost}
# التاريخ   : ${today}
# ================================================================
# ده السكريبت الوحيد اللي محتاجه — ينفع للجهاز الجديد وللجهاز القديم
# اللي فيه مشكلة تفعيل، وآمن إعادة تشغيله أكتر من مرة. بيقوم بـ:
#   0) يكتشف مكان كابل الإنترنت — لو متركب في منفذ LAN بدل WAN بيظبطه لوحده
#   1) ينضّف أي إصلاحات قديمة (socat/hosts) كانت بتسبب تعارض
#   2) يسطّب wifidog + جسر HTTPS محلي على الراوتر
#   3) يكتب إعدادات wifidog الصحيحة (إصلاح "We did not get a valid answer")
#   4) يغيّر اسم الشبكة (2.4GHz + 5GHz) ويزامنه مع السيرفر تلقائياً
#   5) يسطّب أوامر إدارة: hotspot-status / hotspot-ssid / hotspot-restart
#      / hotspot-test (اختبار الاتصال في أي وقت)
#   6) يقيس كل حاجة بنفسه في الآخر ويقولك النتيجة بوضوح
# ================================================================

GW_ID=${shellQuote(gwId)}
SRV=${shellQuote(serverHost)}
DEV_ID=${shellQuote(deviceId)}
WANT_SSID=${shellQuote(ssid)}
TUNNEL_PORT=${shellQuote(tunnelPort)}
TUNNEL_SERVER=${shellQuote(tunnelServer)}

say(){ echo ""; echo "==> $*"; }

# ────────────────────────────────────────────────
# [1/9] تنضيف أي إصلاحات قديمة
#  (سكريبت socat القديم كان بيضيف /etc/hosts يعطل الجسر الحالي)
# ────────────────────────────────────────────────
say "[1/9] تنضيف أي إصلاحات قديمة..."
[ "$(id -u)" = "0" ] || { echo "❌ لازم تشغّل السكريبت بحساب root"; exit 1; }

# ────────────────────────────────────────────────
# [0/9] كشف مكان كابل الإنترنت وإصلاحه تلقائياً
#  لو الكابل متركب في منفذ LAN (زي LAN1) الراوتر مش بيعمل NAT:
#    → الموبايل بياخد نت من راوتر الشبكة العلوي على طول (بيفتح نت من غير صفحة دخول)
#    → أو بيفضل عالق على "جاري الاتصال" (خادمي DHCP بيتصارعوا)
#  الكشف: منفذ WAN فاضي + فيه كابل شغال في منفذ LAN → نحوّل المنفذ ده يبقى WAN
# ────────────────────────────────────────────────
have_link(){ [ -f "/sys/class/net/$1/carrier" ] && [ "$(cat /sys/class/net/$1/carrier 2>/dev/null)" = "1" ]; }
WANDEV=$(uci -q get network.wan.device 2>/dev/null)
[ -z "$WANDEV" ] && WANDEV=$(uci -q get network.wan.ifname 2>/dev/null | awk '{print $1}')
[ -z "$WANDEV" ] && WANDEV=wan
if have_link "$WANDEV"; then
  echo "✅ كابل الإنترنت في مكانه الصح (منفذ: $WANDEV)"
else
  REBPORT=''
  for P in lan1 lan2 lan3 lan4; do
    if have_link "$P"; then REBPORT=$P; break; fi
  done
  if [ -n "$REBPORT" ]; then
    say "🔌 الكابل متركب في منفذ $REBPORT — هظبطه يبقى هو منفذ الإنترنت (WAN)"
    # 1) شيل المنفذ من جسر الشبكة الداخلية (br-lan)
    i=0
    while uci -q show network.@device[$i] >/dev/null 2>&1; do
      [ "$(uci -q get network.@device[$i].name)" = "br-lan" ] && uci -q del_list network.@device[$i].ports="$REBPORT"
      i=$((i+1))
    done
    # 2) واجهة WAN تبقى على المنفذ ده (من غير ما نلمس نوع الاتصال)
    if uci -q get network.wan >/dev/null 2>&1; then
      if uci -q get network.wan.device >/dev/null 2>&1 || [ -n "$(uci -q show network.wan 2>/dev/null | grep '\.device=')" ]; then
        uci set network.wan.device="$REBPORT"
      else
        uci set network.wan.ifname="$REBPORT"
      fi
    else
      uci set network.wan=interface
      uci set network.wan.device="$REBPORT"
      uci set network.wan.proto='dhcp'
    fi
    uci -q set network.wan6.device="$REBPORT" 2>/dev/null
    uci commit network
    # 3) تحميل الإعدادات — الجلسة ممكن تقطع لحظة وترجع
    say "   ⏳ بحمّل إعدادات الشبكة (لو الاتصال قطع لحظة، استنى وأعد التصال)"
    ubus call network reload >/dev/null 2>&1 || /etc/init.d/network restart >/dev/null 2>&1
    NB=0
    while [ $NB -lt 20 ]; do
      sleep 3
      ip -4 route show default 2>/dev/null | grep -q "dev $REBPORT" && break
      NB=$((NB+1))
    done
    if ip -4 route show default 2>/dev/null | grep -q "dev $REBPORT"; then
      echo "✅ الإنترنت اشتغل عن طريق منفذ $REBPORT"
    else
      echo "⚠️  لسه مفيش إنترنت عن طريق $REBPORT — كمّل برضه بس ممكن التسطيب يفشل لو النت مش راجع"
      echo "   → اتأكد إن الكابل اللي في $REBPORT هو كابل المودم/الراوتر الرئيسي فعلاً"
    fi
    ip -4 route show default 2>/dev/null | sed 's/^/   🛣️  /'
  else
    echo "⚠️  مفيش كابل إنترنت في أي منفذ (لا WAN ولا LAN1-4) — وصّل كابل المودم الأول"
  fi
fi

/etc/init.d/hotspot-relay stop    >/dev/null 2>&1
/etc/init.d/hotspot-relay disable >/dev/null 2>&1
rm -f /etc/init.d/hotspot-relay /usr/bin/hotspot-relay.sh
killall socat >/dev/null 2>&1
# حذف أي سطر بيحوّل الدومين لـ 127.0.0.1 من /etc/hosts
sed -i "/${sedHost}/d" /etc/hosts 2>/dev/null
# إرجاع DNS لوضعه الطبيعي للعملاء
uci -q delete dhcp.@dnsmasq[0].nohosts >/dev/null 2>&1
uci -q commit dhcp
/etc/init.d/dnsmasq restart >/dev/null 2>&1
echo "✅ مفيش إصلاحات قديمة — بداية نظيفة"

# ────────────────────────────────────────────────
# [2/9] تسطيب الحزم
# ────────────────────────────────────────────────
say "[2/9] تسطيب wifidog + دعم HTTPS..."
if ! command -v wifidog >/dev/null 2>&1; then
  opkg update >/tmp/hotspot_opkg.log 2>&1
  opkg install wifidog >>/tmp/hotspot_opkg.log 2>&1
fi
command -v wifidog >/dev/null 2>&1 \\
  && echo "✅ wifidog جاهز" \\
  || { echo "❌ فشل تسطيب wifidog — راجع /tmp/hotspot_opkg.log"; exit 1; }

# iptables — دي اللي wifidog بيستخدمها عشان يعترف بموبايلات الزوار ويحوّلهم لصفحة الدخول
# من غيرها: الموبايل يتصل بالشبكة عادي وصفحة الدخول مش بتظهر خالص
if ! command -v iptables >/dev/null 2>&1; then
  opkg update >>/tmp/hotspot_opkg.log 2>&1
  opkg install iptables >>/tmp/hotspot_opkg.log 2>&1
fi
command -v iptables >/dev/null 2>&1 \\
  && echo "✅ iptables جاهزة (جدار الاعتراض)" \\
  || echo "⚠️  iptables مش متسطبة — صفحة الدخول مش هتظهر للموبايلات (شغّل: opkg update && opkg install iptables)"

# دعم HTTPS لـ wget/uclient-fetch — ده أساس الجسر (لازم libustream)
opkg list-installed 2>/dev/null | grep -q '^libustream' || {
  opkg update >>/tmp/hotspot_opkg.log 2>&1
  for PKG in libustream-mbedtls20230106 libustream-mbedtls libustream-openssl20230106 libustream-openssl libustream-wolfssl libustream-cyassl; do
    opkg install "$PKG" >>/tmp/hotspot_opkg.log 2>&1 && break
  done
}
opkg list-installed 2>/dev/null | grep -q '^ca-bundle' || opkg install ca-bundle >>/tmp/hotspot_opkg.log 2>&1
if opkg list-installed 2>/dev/null | grep -q '^libustream'; then
  echo "✅ دعم HTTPS جاهز (libustream)"
else
  echo "⚠️  libustream متسطبش — لو اختبار الجسر فشل، شغّل: opkg update && opkg install libustream-mbedtls ca-bundle"
fi

# ────────────────────────────────────────────────
# [3/9] جسر HTTPS المحلي (uhttpd CGI)
#  wifidog 1.3.0 مش بيتكلم TLS 1.2 (و Vercel بيقبل HTTPS بس)
#  → الجسر بيستقبل طلبات wifidog محلياً ويمررها للسيرفر عبر HTTPS
#  → وبيعالج كمان الـ trailing slash اللي wifidog بيضيفه للروابط
# ────────────────────────────────────────────────
say "[3/9] تركيب جسر HTTPS المحلي..."
mkdir -p /www/cgi-bin
cat > /www/cgi-bin/go << 'BRIDGE_EOF'
#!/bin/sh
# ═══════════════════════════════════════════════════════
# جسر HTTPS الشامل — كل حاجة بتعدي من هنا:
#  • wifidog (ping/auth) → HTTPS → السيرفر
#  • متصفح الموبايل (صفحة الدخول + تسجيل الدخول) → الراوتر → HTTPS → السيرفر
#    يعني الموبايل مش محتاج يوصّل السيرفر نهائياً قبل التفعيل!
# ═══════════════════════════════════════════════════════
SRV="${serverHost}"
GW="${gwId}"

https_get(){
  uclient-fetch -q -T 20 -O - --no-check-certificate "$1" 2>>/tmp/hotspot_https.log \\
    || wget -q -T 20 -O - --no-check-certificate "$1" 2>>/tmp/hotspot_https.log
}
https_post(){
  uclient-fetch -q -T 20 -O - --no-check-certificate --post-data="$2" "$1" 2>>/tmp/hotspot_https.log \\
    || wget -q -T 20 -O - --no-check-certificate --post-data="$2" "$1" 2>>/tmp/hotspot_https.log
}

QS="$QUERY_STRING"
[ -z "$QS" ] && QS="ep=/ping/?"
ALL="\${QS#ep=}"
# EP ممكن يتقفل بعلامة ؟ (أسلوب wifidog: ep=/login/?params) أو & (الأسلوب النضيف: ep=/portal/&params)
case "$ALL" in
  *\\?*) EP="\${ALL%%\\?*}"; REST="\${ALL#*\\?}" ;;
  *\\&*) EP="\${ALL%%&*}";  REST="\${ALL#*&}" ;;
  *)     EP="$ALL"; REST="" ;;
esac
EP="\${EP#/}"
EP="\${EP%/}"   # شيل الـ trailing slash اللي wifidog بيضيفها (auth/ ← auth)

case "$EP" in
  ping|auth)
    # طلبات داخلية من wifidog نفسه — نمرر رد السيرفر الخام
    RESP=$(https_get "https://\${SRV}/api/wifidog/\${EP}?\${REST}")
    echo "Content-Type: text/plain"
    echo ""
    if [ -n "$RESP" ]; then
      printf '%s\\n' "$RESP"
    elif [ "$EP" = "auth" ]; then
      echo "Auth: 0"
    else
      echo "ERR"
    fi
    ;;
  authtest)
    # فحص ذاتي — نفس مسار auth بس من غير fallback
    # عشان الفحص يفرّق بين رد السيرفر الحقيقي وفشل الوصول
    RESP=$(https_get "https://\${SRV}/api/wifidog/auth?\${REST}")
    echo "Content-Type: text/plain"
    echo ""
    if [ -n "$RESP" ]; then
      printf '%s\\n' "$RESP"
    else
      echo "BRIDGE_FAIL"
    fi
    ;;
  login)
    # wifidog حوّل متصفح الموبايل هنا — بنحوّله لصفحة البورتال المحلية
    # 3 طبقات حماية عشان مستحيل تطلع صفحة بيضا:
    #   1) Status: 302 + Location مطلق (المتصفح يتابعها فوراً)
    #   2) meta refresh في HTML (لو المتصفح تجاهل الـ 302)
    #   3) لينك يدوي (آخر ملجأ — المستخدم يضغط بنفسه)
    GO="/cgi-bin/go?ep=/portal/&\${REST}"
    echo "Status: 302 Found"
    echo "Location: http://\${HTTP_HOST:-${routerIp}}$GO"
    echo "Content-Type: text/html; charset=utf-8"
    echo ""
    echo "<!DOCTYPE html><html dir='rtl'><head><meta charset='utf-8'><meta http-equiv='refresh' content='0;url=$GO'></head><body style='font-family:sans-serif;background:#070B12;color:#00D4FF;text-align:center;padding:60px 20px'><p>جاري فتح صفحة الدخول...</p><p><a href='$GO' style='color:#00D4FF'>اضغط هنا لو الصفحة مافتحتش</a></p></body></html>"
    ;;
  portal)
    # صفحة الدخول — بتتخدم من كاش الراوتر (فورية 100%)
    # بتتحدث من السيرفر كل 5 دقايق (الكرون) أو أول ما الكاش يعدي
    # ولو السيرفر مش واصل → بنخدم آخر نسخة محفوظة بدل صفحة بيضا
    CACHE=/tmp/hotspot_portal.html
    CTS=/tmp/hotspot_portal.ts
    NOW=$(date +%s)
    TS=$(cat "$CTS" 2>/dev/null)
    case "$TS" in ''|*[!0-9]*) TS=0 ;; esac
    AGE=$((NOW - TS))
    if [ ! -s "$CACHE" ] || [ "$AGE" -gt 300 ]; then
      RESP=$(https_get "https://\${SRV}/api/portal/page?gw_id=\${GW}")
      if [ -n "$RESP" ]; then
        # تعديل نقطتين في الصفحة:
        #  1) تسجيل الدخول يروح للجسر المحلي بدل السيرفر (الموبايل مش واصل السيرفر أصلاً)
        #  2) زرار صفحة الجلسة يتعامل مع السيرفر مباشرة (بعد التفعيل الموبايل يبقى مسموح له)
        printf '%s' "$RESP" | sed "s|fetch('/api/portal/login'|fetch('/cgi-bin/go?ep=/apilogin/'|; s|window.location.replace('/session?token='|window.location.replace('https://\${SRV}/session?token='|" > "$CACHE.t" \
          && { mv "$CACHE.t" "$CACHE"; date +%s > "$CTS"; }
        rm -f "$CACHE.t"
      fi
    fi
    echo "Content-Type: text/html; charset=utf-8"
    echo "Cache-Control: no-store"
    echo ""
    if [ -s "$CACHE" ]; then
      cat "$CACHE"
    else
      echo "<!DOCTYPE html><html dir='rtl'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta http-equiv='refresh' content='3'></head><body style='font-family:sans-serif;background:#070B12;color:#00D4FF;text-align:center;padding:60px 20px'><h2>📡 بجهّز صفحة الدخول...</h2><p style='color:#6B8CAE'>الصفحة هتظهر تلقائياً خلال ثواني — استنى شوية</p></body></html>"
    fi
    ;;
  apilogin)
    # طلب تسجيل الدخول من صفحة البورتال — بنمرر الجسم للسيرفر زي ما هو
    BODY=""
    if [ "\$REQUEST_METHOD" = "POST" ] && [ -n "\$CONTENT_LENGTH" ]; then
      BODY=\$(head -c "\$CONTENT_LENGTH" 2>/dev/null)
    fi
    # ضمان إضافي: لو الصفحة بعتت gatewayId فاضي أو null نحط بتاع الجهاز
    BODY=\$(printf '%s' "$BODY" | sed "s|\"gatewayId\":null|\"gatewayId\":\"${gwId}\"|g; s|\"gatewayId\":\"\"|\"gatewayId\":\"${gwId}\"|g")
    RESP=\$(https_post "https://\${SRV}/api/portal/login" "\$BODY")
    echo "Content-Type: application/json"
    echo ""
    if [ -n "\$RESP" ]; then
      printf '%s' "\$RESP"
    else
      echo '{"success":false,"message":"مشكلة اتصال بالسيرفر — جرب تاني"}'
    fi
    ;;
  apistatus)
    # حالة الجلسة — صفحة التفعيل بتسأل بيها عن الوقت المتبقي والميجا
    # (عبر الجسر المحلي — شغالة حتى قبل ما نت الموبايل يتفتح)
    TOKEN=$(printf '%s' "$REST" | tr '&' '\\n' | sed -n 's/^token=//p' | head -n1)
    RESP=$(https_get "https://\${SRV}/api/portal/session-status?token=\${TOKEN}")
    echo "Content-Type: application/json"
    echo ""
    if [ -n "$RESP" ]; then
      printf '%s' "$RESP"
    else
      echo '{"found":false}'
    fi
    ;;
  gw_message.php|gw_message)
    # رسايل wifidog (مرفوض/منتهي) — من السيرفر
    RESP=$(https_get "https://\${SRV}/api/wifidog/gw_message.php?\${REST}")
    echo "Content-Type: text/html"
    echo ""
    printf '%s' "\$RESP"
    ;;
  *)
    # أي طلب تاني من متصفح → وديره لصفحة البورتال (بنفس حماية الـ 302)
    GO="/cgi-bin/go?ep=/portal/&gw_id=\${GW}"
    echo "Status: 302 Found"
    echo "Location: http://\${HTTP_HOST:-${routerIp}}$GO"
    echo "Content-Type: text/html; charset=utf-8"
    echo ""
    echo "<!DOCTYPE html><html dir='rtl'><head><meta charset='utf-8'><meta http-equiv='refresh' content='0;url=$GO'></head><body style='font-family:sans-serif;background:#070B12;color:#00D4FF;text-align:center;padding:60px 20px'><p>جاري فتح صفحة الدخول...</p><p><a href='$GO' style='color:#00D4FF'>اضغط هنا لو الصفحة مافتحتش</a></p></body></html>"
    ;;
esac
BRIDGE_EOF
chmod +x /www/cgi-bin/go

# uhttpd: تأكد إنه موجود وشغال و CGI مفعل
opkg list-installed 2>/dev/null | grep -q '^uhttpd' || opkg install uhttpd >>/tmp/hotspot_opkg.log 2>&1
if uci -q get uhttpd.main >/dev/null 2>&1; then
  case "$(uci -q get uhttpd.main.cgi_prefix 2>/dev/null)" in
    *cgi-bin*) : ;;
    *) uci set uhttpd.main.cgi_prefix='/cgi-bin'; uci commit uhttpd ;;
  esac
fi
/etc/init.d/uhttpd enable  >/dev/null 2>&1
/etc/init.d/uhttpd restart >/dev/null 2>&1 || /etc/init.d/uhttpd start >/dev/null 2>&1
sleep 1
UPORT=$(uci -q get uhttpd.main.listen_http 2>/dev/null | tr ' ' '\\n' | grep -v '^\\[' | head -n1 | sed 's/.*://')
[ -z "$UPORT" ] && UPORT=80
netstat -tln 2>/dev/null | grep -q ":$UPORT " \\
  && echo "✅ الجسر شغال (uhttpd على بورت $UPORT)" \\
  || echo "⚠️  uhttpd مش شغال على بورت $UPORT — لو الجسر فشل في الاختبار شغّل: /etc/init.d/uhttpd restart"

# ────────────────────────────────────────────────
# [4/9] كتابة /etc/wifidog.conf — الإعداد الصحيح
#  wifidog ←(HTTP)→ الجسر المحلي ←(HTTPS)→ السيرفر
# ────────────────────────────────────────────────
say "[4/9] كتابة إعدادات wifidog (بكشف تلقائي للواجهات والعناوين)..."
cp /etc/wifidog.conf /etc/wifidog.conf.bak 2>/dev/null
# ── كشف تلقائي: عنوان الراوتر على شبكة الكافيه (مش مكتوب يدوي — أي راوتر هيشتغل)
GWIP=$(uci -q get network.lan.ipaddr 2>/dev/null)
[ -z "$GWIP" ] && GWIP=$(ip -4 addr show br-lan 2>/dev/null | awk '/inet /{split($2,a,"/"); print a[1]; exit}')
[ -z "$GWIP" ] && GWIP='${routerIp}'
# ── كشف تلقائي: واجهة الشبكة الداخلية
GWIF=$(uci -q get network.lan.device 2>/dev/null)
if [ -n "$GWIF" ] && ! ip link show "$GWIF" >/dev/null 2>&1; then GWIF=''; fi
[ -z "$GWIF" ] && GWIF=$(uci -q get network.lan.ifname 2>/dev/null | awk '{print $1}')
[ -z "$GWIF" ] && ip link show br-lan >/dev/null 2>&1 && GWIF=br-lan
[ -z "$GWIF" ] && GWIF='${gwIf}'
# ── كشف تلقائي: واجهة الإنترنت (مخرج المسار الافتراضي) — أهم حاجة
EXTIF=$(ip -4 route show default 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1); exit}}')
if [ -n "$EXTIF" ] && ! ip link show "$EXTIF" >/dev/null 2>&1; then EXTIF=''; fi
if [ -z "$EXTIF" ] || [ "$EXTIF" = "$GWIF" ] || echo "$EXTIF" | grep -q '^br-'; then
  EXTIF=''
  for CAND in '${extIf}' $(uci -q get network.wan.device 2>/dev/null) $(uci -q get network.wan.ifname 2>/dev/null) pppoe-wan eth0.1 eth1 eth0; do
    [ -z "$CAND" ] && continue
    echo "$CAND" | grep -q '^br-' && continue
    if ip link show "$CAND" >/dev/null 2>&1; then EXTIF="$CAND"; break; fi
  done
fi
[ -z "$EXTIF" ] && EXTIF='${extIf}'
echo "   🌐 واجهة الإنترنت: $EXTIF | واجهة الشبكة: $GWIF | عنوان الراوتر: $GWIP"
cat > /etc/wifidog.conf << WDEOF
GatewayID           ${gwId}
GatewayAddress      __GWIP__
ExternalInterface   __EXTIF__
GatewayInterface    __GWIF__

AuthServer {
    Hostname        __GWIP__
    HTTPPort        __UPORT__
    SSLAvailable    no
    Path            /cgi-bin/go?ep=/
}

GatewayPort         2060
HTTPDMaxConn        253
ClientTimeout       ${clientTimeout}
CheckInterval       300

PopularServers      kernel.org,ieee.org

FirewallRuleSet global {
    FirewallRule allow to ${serverHost}
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
sed -i "s/__UPORT__/$UPORT/; s/__GWIP__/$GWIP/g; s/__EXTIF__/$EXTIF/g; s/__GWIF__/$GWIF/g" /etc/wifidog.conf
echo "✅ wifidog.conf اتكتبت (القديمة محفوظة في /etc/wifidog.conf.bak)"

# ────────────────────────────────────────────────
# [5/9] اسم الشبكة (2.4GHz + 5GHz)
# ────────────────────────────────────────────────
if [ -n "$WANT_SSID" ] && uci -q show wireless >/dev/null 2>&1; then
  say "[5/9] تغيير اسم الشبكة إلى: $WANT_SSID"
  i=0
  while uci -q show wireless.@wifi-iface[$i] >/dev/null 2>&1; do
    MODE=$(uci -q get wireless.@wifi-iface[$i].mode 2>/dev/null)
    if [ "$MODE" = "ap" ] || [ -z "$MODE" ]; then
      uci set wireless.@wifi-iface[$i].ssid="$WANT_SSID"
      echo "   ✔️  واجهة [$i] (mode=\${MODE:-ap})"
    else
      echo "   ⏭️  واجهة [$i] mode=$MODE — اتسابت (واجهة uplink)"
    fi
    i=$((i+1))
  done
  uci commit wireless
  wifi reload >/dev/null 2>&1
  echo "✅ اسم الشبكة اتطبق"
else
  say "[5/9] اسم الشبكة — مفيش تغيير مطلوب"
fi

# ────────────────────────────────────────────────
# [6/9] أوامر الإدارة
# ────────────────────────────────────────────────
say "[6/9] تسطيب أوامر الإدارة..."

cat > /usr/bin/hotspot-test << 'TEST_EOF'
#!/bin/sh
# 🧪 اختبار شامل لاتصال الراوتر بالسيرفر — شغّله في أي وقت
SRV="${serverHost}"
GW="${gwId}"

https_get(){
  uclient-fetch -q -T 20 -O - --no-check-certificate "$1" 2>>/tmp/hotspot_https.log \\
    || wget -q -T 20 -O - --no-check-certificate "$1" 2>>/tmp/hotspot_https.log
}

echo "╔══════════════════════════════════════════╗"
echo "║     اختبار الاتصال — Hotspot             ║"
echo "╚══════════════════════════════════════════╝"

# 0) هل الراوتر نفسه واصل الإنترنت أصلاً
if ping -c 2 -W 3 8.8.8.8 >/dev/null 2>&1; then
  echo "✅ 0) إنترنت الراوتر نفسه: واصل"
else
  echo "❌ 0) إنترنت الراوتر نفسه: مقطوع — الراوتر مش واصل النت خالص"
  echo "   → دي مش مشكلة السيتام — راجع كابل/مودم الـ WAN"
fi

# 0b) DNS — لو رجع 127.0.0.1 يبقى فيه خربنة hosts قديمة
NSL=$(nslookup "\$SRV" 2>&1 | tail -n 4)
if echo "\$NSL" | grep -q 'Address' && ! echo "\$NSL" | grep -q '127\\.0\\.0\\.1'; then
  echo "✅ 0b) DNS (\$SRV): تمام"
else
  echo "❌ 0b) DNS (\$SRV): فشل أو رجع IP غلط:"
  echo "\$NSL" | sed 's/^/     /'
  echo "   → لو 127.0.0.1 ظهر فوق: فيه سطر قديم في /etc/hosts امسحه"
fi

# 1) HTTPS مباشر من الراوتر للسيرفر
T1=$(https_get "https://\$SRV/api/wifidog/ping?gw_id=\$GW")
if [ "$T1" = "Pong" ]; then
  echo "✅ 1) الراوتر ↔ السيرفر (HTTPS مباشر): تمام"
else
  echo "❌ 1) الراوتر ↔ السيرفر (HTTPS مباشر): فشل (رجعت: \${T1:-لا شيء})"
  if command -v nc >/dev/null 2>&1 && nc -w 5 "\$SRV" 443 </dev/null >/dev/null 2>&1; then
    echo "   → TCP 443 مفتوح، يبقى المشكلة في طبقة TLS — جرب:"
    echo "     opkg update && opkg install libustream-mbedtls20230106 ca-bundle"
  else
    echo "   → TCP 443 مش مفتوح (DNS/جدار ناري/مزود الخدمة)"
  fi
  echo "   → آخر الأخطاء المسجلة في /tmp/hotspot_https.log:"
  tail -n 4 /tmp/hotspot_https.log 2>/dev/null | sed 's/^/     /'
fi

UPORT=$(uci -q get uhttpd.main.listen_http 2>/dev/null | tr ' ' '\\n' | grep -v '^\\[' | head -n1 | sed 's/.*://')
[ -z "$UPORT" ] && UPORT=80

T2=$(wget -q -T 20 -O - "http://127.0.0.1:\$UPORT/cgi-bin/go?ep=/ping/?gw_id=\$GW" 2>/dev/null)
if [ "$T2" = "Pong" ]; then
  echo "✅ 2) الجسر المحلي (uhttpd CGI): تمام"
else
  echo "❌ 2) الجسر المحلي (uhttpd CGI): فشل (رجعت: \${T2:-لا شيء})"
  echo "   → جرب: /etc/init.d/uhttpd restart ثم hotspot-test تاني"
fi

# نفس الطلب بالظبط اللي wifidog بيطلبه لما تكتب الكرت
# لكن عبر ep=/authtest/ — من غير fallback، يعني الرد ده من السيرفر فعلاً
# (توكن وهمي → السيرفر المفروض يرد "Auth: 0" — لو رجعت BRIDGE_FAIL يبقى الوصول مقطوع)
T3=$(wget -q -T 20 -O - "http://127.0.0.1:\$UPORT/cgi-bin/go?ep=/authtest/?stage=login&ip=192.168.1.99&mac=AA:BB:CC:DD:EE:FF&token=SELFTEST&gw_id=\$GW" 2>/dev/null)
if [ "$T3" = "Auth: 0" ]; then
  echo "✅ 3) مسار التحقق من الكروت (auth): تمام — السيرفر بيرد فعلاً"
elif [ "$T3" = "BRIDGE_FAIL" ]; then
  echo "❌ 3) مسار التحقق من الكروت (auth): الجسر شغال، بس مش قادر يوصل للسيرفر (نفس سبب رقم 1)"
else
  echo "❌ 3) مسار التحقق من الكروت (auth): رجعت حاجة غير متوقعة (رجعت: \${T3:-لا شيء})"
fi

# 3b) صفحة الدخول اللي الموبايل بيفتحها — لازم تيجي من الجسر كاملة
T6=$(wget -q -T 20 -O - "http://127.0.0.1:\$UPORT/cgi-bin/go?ep=/portal/" 2>/dev/null)
T6OK=0
case "$T6" in *doLogin*) T6OK=1 ;; esac
if [ "$T6OK" = "1" ]; then
    echo "✅ 3b) صفحة الدخول (بورتال الموبايل): تمام — بتتخدم محلياً من الراوتر"
else
    echo "❌ 3b) صفحة الدخول (بورتال الموبايل): فشل (رجعت: \${T6:-لا شيء})"
    echo "   → غالباً نفس سبب رقم 1 — الراوتر مش واصل السيرفر"
fi

if pgrep wifidog >/dev/null 2>&1; then
  echo "✅ 4) خدمة wifidog: شغالة"
else
  echo "❌ 4) خدمة wifidog: واقفة — جرب: /etc/init.d/wifidog restart"
fi

if netstat -tln 2>/dev/null | grep -q ':2060 '; then
  echo "✅ 5) بوابة الراوتر (2060): شغالة"
else
  echo "❌ 5) بوابة الراوتر (2060): مش شغالة — جرب: /etc/init.d/wifidog restart"
fi

echo "──────────────────────────────────────────"
if [ "$T2" = "Pong" ] && [ "$T3" = "Auth: 0" ] && [ "$T6OK" = "1" ] && pgrep wifidog >/dev/null 2>&1; then
  echo "🎉 النتيجة: كل حاجة تمام — التفعيل هيشتغل من أول كارت"
else
  echo "⚠️  النتيجة: فيه مشكلة — ابعت سكرين من الرسائل دي للدعم الفني"
fi
TEST_EOF
chmod +x /usr/bin/hotspot-test

cat > /usr/bin/hotspot-status << 'STATUS_EOF'
#!/bin/sh
# 📊 حالة السيتام — شغّله في أي وقت
GW="${gwId}"
SRV="${serverHost}"
# اسم الشبكة من أول واجهة AP (mode=ap) — مش iface[0] الأعمى (ممكن تكون uplink)
WSSID=$(i=0; S=unknown; while uci -q show wireless.@wifi-iface[$i] >/dev/null 2>&1; do M=$(uci -q get wireless.@wifi-iface[$i].mode 2>/dev/null); if [ "$M" = "ap" ] || [ -z "$M" ]; then S=$(uci -q get wireless.@wifi-iface[$i].ssid 2>/dev/null || echo unknown); break; fi; i=$((i+1)); done; echo "$S")
if pgrep wifidog >/dev/null 2>&1; then WD="🟢 شغال"; else WD="🔴 متوقف"; fi
UP=$(awk '{h=int($1/3600);m=int(($1%3600)/60);print h"h "m"m"}' /proc/uptime)
CL=$(arp -n 2>/dev/null | grep -v incomplete | grep -v Address | wc -l)
UPORT=$(uci -q get uhttpd.main.listen_http 2>/dev/null | tr ' ' '\\n' | grep -v '^\\[' | head -n1 | sed 's/.*://')
[ -z "$UPORT" ] && UPORT=80
BR=$(wget -q -T 10 -O - "http://127.0.0.1:\$UPORT/cgi-bin/go?ep=/ping/?gw_id=\$GW" 2>/dev/null)
if [ "$BR" = "Pong" ]; then BRST="🟢 شغال"; else BRST="🔴 مش شغال"; fi
echo "╔══════════════════════════════════════╗"
echo "║        Hotspot Status                ║"
echo "╠══════════════════════════════════════╣"
echo "║  GatewayID : \$GW"
echo "║  Server    : \$SRV"
echo "║  SSID      : \$WSSID"
echo "║  wifidog   : \$WD"
echo "║  الجسر     : \$BRST"
echo "║  Uptime    : \$UP"
echo "║  Clients   : \$CL أجهزة"
echo "╚══════════════════════════════════════╝"
echo "💡 للاختبار الكامل: hotspot-test"
STATUS_EOF
chmod +x /usr/bin/hotspot-status

cat > /usr/bin/hotspot-ssid << 'ENDOFFILE'
#!/bin/sh
# 📶 تغيير اسم الشبكة — hotspot-ssid 'الاسم الجديد'
NEW="$1"
if [ -z "$NEW" ]; then
    i=0
    while uci -q show wireless.@wifi-iface[$i] >/dev/null 2>&1; do
        echo "SSID[$i]: $(uci -q get wireless.@wifi-iface[$i].ssid 2>/dev/null || echo unknown)"
        i=$((i+1))
    done
    echo "الاستخدام: hotspot-ssid 'اسم جديد'"
    exit 0
fi
i=0
while uci -q show wireless.@wifi-iface[$i] >/dev/null 2>&1; do
    uci set wireless.@wifi-iface[$i].ssid="$NEW"
    i=$((i+1))
done
uci commit wireless
wifi reload
echo "تم تغيير كل الشبكات => $NEW"
ENDOFFILE
chmod +x /usr/bin/hotspot-ssid

cat > /usr/bin/hotspot-restart << 'ENDOFFILE'
#!/bin/sh
# 🔄 إعادة تشغيل wifidog
/etc/init.d/wifidog restart && echo "تم إعادة تشغيل wifidog"
ENDOFFILE
chmod +x /usr/bin/hotspot-restart

cat > /usr/bin/hotspot-doctor << 'DOCTOR_EOF'
#!/bin/sh
# 🩺 طبيب الهوت سبوت — فحص + إصلاح تلقائي لكل طبقات التفعيل
# شغّله في أي وقت لاقيت الصفحة مش بتظهر أو الحالة واقفة
GW="${gwId}"
say(){ echo ""; echo "==> $*"; }
GOOD=0; BAD=0
good(){ echo "✅ $*"; GOOD=$((GOOD+1)); }
bad(){ echo "❌ $*"; BAD=$((BAD+1)); }

say "[1/6] إنترنت الراوتر نفسه"
if ping -c 2 -W 3 8.8.8.8 >/dev/null 2>&1; then
  good "الإنترنت واصل"
else
  bad "الإنترنت مقطوع — راجع كابل/مودم الـ WAN (دي مش مشكلة السستم)"
fi

say "[2/6] خدمة wifidog"
if pgrep wifidog >/dev/null 2>&1; then
  good "wifidog شغال"
else
  echo "   ⏳ wifidog واقف — بجرب أشغّله..."
  /etc/init.d/wifidog restart >/dev/null 2>&1 || /etc/init.d/wifidog start >/dev/null 2>&1
  sleep 4
  if pgrep wifidog >/dev/null 2>&1; then good "wifidog رجع شغال"; else bad "wifidog مش راضي يشتغل — ابعت سكرين من: logread | grep -i wifidog | tail -n 10"; fi
fi

say "[3/6] الجسر المحلي (uhttpd)"
/etc/init.d/uhttpd restart >/dev/null 2>&1
sleep 1
BR=$(wget -q -T 15 -O - "http://127.0.0.1/cgi-bin/go?ep=/ping/?gw_id=$GW" 2>/dev/null)
if [ "$BR" = "Pong" ]; then
  good "الجسر شغال والسيرفر بيرد عليه"
else
  bad "الجسر مش شغال — شغّل: /etc/init.d/uhttpd restart ولو فضل فاشل ابعت: logread | tail -n 15"
fi

say "[4/6] قواعد الاعتراض (اللي بتفتح صفحة الدخول للموبايلات)"
if command -v iptables >/dev/null 2>&1 && iptables -t nat -S 2>/dev/null | grep -q 2060; then
  good "قاعدة الاعتراض مسجلة في الجدار الناري"
else
  echo "   ⏳ القاعدة ناقصة — بصلّحها (إعادة تشغيل الجدار الناري ثم wifidog)..."
  /etc/init.d/firewall restart >/dev/null 2>&1
  sleep 2
  /etc/init.d/wifidog restart >/dev/null 2>&1
  sleep 5
  if command -v iptables >/dev/null 2>&1 && iptables -t nat -S 2>/dev/null | grep -q 2060; then
    good "اتصلحت — القاعدة رجعت"
  else
    bad "لسه ناقصة — لو iptables مش متسطبة: opkg update && opkg install iptables ثم hotspot-doctor تاني"
  fi
fi

say "[5/6] محاكاة موبايل — من wifidog لحد صفحة الدخول"
H1=$(wget -S -T 10 -O /dev/null "http://127.0.0.1:2060/login/?gw_id=$GW" 2>&1)
if echo "$H1" | grep -qi '302'; then
  good "wifidog بيحوّل الموبايل لصفحة الدخول (302)"
else
  bad "wifidog مش بيحوّل — ردوده: $(echo "$H1" | head -n 3 | tr '\\n' ' ')"
fi
T3=$(wget -q -T 20 -O - "http://127.0.0.1/cgi-bin/go?ep=/portal/&gw_id=$GW" 2>/dev/null)
case "$T3" in
  *doLogin*) good "صفحة الدخول بتتخدم كاملة من الراوتر" ;;
  *) bad "صفحة الدخول مش بتتحمّل — غالباً نفس سبب رقم 1 (الإنترنت/السيرفر)" ;;
esac

say "[6/6] تسجيل نبضة في السيرفر"
if wget -q -T 15 -O /dev/null "http://127.0.0.1/cgi-bin/go?ep=/ping/?gw_id=$GW" 2>/dev/null; then
  good "النبضة وصلت — الحالة هتبقى أونلاين في اللوحة حالاً"
else
  bad "النبضة مانجحتش — شغّل hotspot-test للتفاصيل"
fi

echo ""
echo "═══════════════════════════════════════"
if [ "$BAD" = "0" ]; then
  echo "🎉 كل حاجة سليمة ($GOOD فحص ناجح)"
  echo "   اعزل شبكة الواي فاي من الموبايل وارجع اتصل"
  echo "   وافتح أي موقع — صفحة الدخول هتظهر حالاً"
else
  echo "⚠️  فيه $BAD مشكلة — ابعت سكرين بالرسائل دي كلها للدعم"
fi
echo "═══════════════════════════════════════"
DOCTOR_EOF
chmod +x /usr/bin/hotspot-doctor

cat > /usr/bin/hotspot-watchdog << 'WDG_EOF'
#!/bin/sh
# 🛡️ الحارس الذاتي — شغال كل 5 دقايق من الكرون
# لو wifidog وقع أو الجسر وقع أو قاعدة الاعتراض ضاعت — يصلحها لوحده
# (wifidog بيقفل نفسه لو iptables مش موجودة أو خط النت واقف — الحارس بيجرب تاني كل 5 دقايق
#  فأول ما النت يرجع، الحارس بيرجّع wifidog والاعتراض لوحده من غير ما حد يتصل بنا)
if ! pgrep uhttpd >/dev/null 2>&1; then
  /etc/init.d/uhttpd start >/dev/null 2>&1
fi
if ! pgrep wifidog >/dev/null 2>&1; then
  /etc/init.d/wifidog restart >/dev/null 2>&1 || /etc/init.d/wifidog start >/dev/null 2>&1
fi
if command -v iptables >/dev/null 2>&1; then
  if ! iptables -t nat -S 2>/dev/null | grep -q 2060; then
    /etc/init.d/firewall restart >/dev/null 2>&1
    sleep 3
    /etc/init.d/wifidog restart >/dev/null 2>&1
  fi
fi
exit 0
WDG_EOF
chmod +x /usr/bin/hotspot-watchdog
(crontab -l 2>/dev/null | grep -v hotspot-watchdog; echo "*/5 * * * * /usr/bin/hotspot-watchdog >/dev/null 2>&1") | crontab - >/dev/null 2>&1 || { echo "*/5 * * * * /usr/bin/hotspot-watchdog >/dev/null 2>&1" >> /etc/crontabs/root; }
/etc/init.d/cron restart >/dev/null 2>&1

echo "✅ أوامر الإدارة جاهزة: hotspot-status · hotspot-test · hotspot-ssid · hotspot-restart · hotspot-doctor · hotspot-watchdog"

# ────────────────────────────────────────────────
# [7/9] مزامنة اسم الشبكة مع السيرفر (كل 5 دقايق)
# ────────────────────────────────────────────────
if [ -n "$DEV_ID" ]; then
  say "[7/9] مزامنة اسم الشبكة مع السيرفر (كل 5 دقايق)..."
  cat > /usr/bin/hotspot-ssid-sync << 'SYNC_EOF'
#!/bin/sh
# بيجيب اسم الشبكة المطلوب من السيرفر ويطبقه على واجهات AP لو اتغير
SRV="${serverHost}"
DEV="${deviceId}"
[ -z "$DEV" ] && exit 0
https_get(){
  uclient-fetch -q -T 20 -O - --no-check-certificate "$1" 2>>/tmp/hotspot_https.log \\
    || wget -q -T 20 -O - --no-check-certificate "$1" 2>>/tmp/hotspot_https.log
}
WANT=$(https_get "https://\$SRV/api/admin/config?deviceId=\$DEV&type=ssid" 2>/dev/null | head -n1 | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
[ -z "$WANT" ] && exit 0
# حماية: لو الرد كان صفحة خطأ (HTML/JSON) ولا الاسم طوله غير منطقي
# → منغيرش اسم الشبكة بحاجة غلط — الاسم الثابت يفضل زي ما هو
case "$WANT" in
  *"<"*|*">"*|*"{"*|*"}"*|*'"'*|*"'"*|*"%"*|*"="*|*"&"*|*";"*) exit 0 ;;
esac
WLEN=\${#WANT}
[ "\$WLEN" -gt 64 ] && exit 0
[ "\$WANT" = "unknown" ] && exit 0
CHANGED=0
i=0
while uci -q show wireless.@wifi-iface[$i] >/dev/null 2>&1; do
  MODE=$(uci -q get wireless.@wifi-iface[$i].mode 2>/dev/null)
  if [ "$MODE" = "ap" ] || [ -z "$MODE" ]; then
    CUR=$(uci -q get wireless.@wifi-iface[$i].ssid 2>/dev/null)
    if [ "$CUR" != "$WANT" ]; then
      uci set wireless.@wifi-iface[$i].ssid="$WANT"
      CHANGED=1
    fi
  fi
  i=$((i+1))
done
if [ "$CHANGED" = "1" ]; then
  uci commit wireless
  wifi reload
  echo "$(date): SSID => \$WANT"
fi
# تحديث كاش صفحة الدخول المحلي كل 5 دقايق
# عشان أي موبايل يفتح البورتال يلاقي الصفحة جاهزة فوراً (من غير انتظار السيرفر)
UPORT=$(uci -q get uhttpd.main.listen_http 2>/dev/null | tr ' ' '\\n' | grep -v '^\\[' | head -n1 | sed 's/.*://')
[ -z "$UPORT" ] && UPORT=80
wget -q -T 30 -O /dev/null "http://127.0.0.1:$UPORT/cgi-bin/go?ep=/portal/" 2>/dev/null
SYNC_EOF
  chmod +x /usr/bin/hotspot-ssid-sync
  (crontab -l 2>/dev/null | grep -v hotspot-ssid-sync; echo "*/5 * * * * /usr/bin/hotspot-ssid-sync >/dev/null 2>&1") | crontab - >/dev/null 2>&1 \\
    || { echo "*/5 * * * * /usr/bin/hotspot-ssid-sync >/dev/null 2>&1" >> /etc/crontabs/root; /etc/init.d/cron restart >/dev/null 2>&1; }
  echo "✅ المزامنة شغالة"
else
  say "[7/9] مزامنة اسم الشبكة — مش متاحة (الجهاز مش مربوط بحساب في السيرفر)"
fi

# ────────────────────────────────────────────────
# [8/9] SSH Reverse Tunnel (اختياري — لو متظبط على السيرفر)
# ────────────────────────────────────────────────
${hasTunnel ? `if [ -n "$TUNNEL_SERVER" ] && [ "$TUNNEL_PORT" != "0" ]; then
  say "[8/9] إعداد SSH Reverse Tunnel (بورت $TUNNEL_PORT)..."
  KEY_FILE=/etc/dropbear/hotspot_rsa
  [ -f "$KEY_FILE" ] || dropbearkey -t rsa -f "$KEY_FILE" -N "" >/dev/null 2>&1
  PUB=$(dropbearkey -y -f "$KEY_FILE" 2>/dev/null | grep '^ssh-')
  if [ -n "$PUB" ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║  Public Key — ضيفه على السيرفر في ~/.ssh/authorized_keys ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo "$PUB"
    echo ""
  fi
  cat > /usr/bin/hotspot-tunnel << 'TUNNEL_EOF'
#!/bin/sh
SERVER="${tunnelServer}"
TUNNEL_PORT="${tunnelPort}"
KEY_FILE="/etc/dropbear/hotspot_rsa"
while true; do
  ssh -i "$KEY_FILE" \\
      -o StrictHostKeyChecking=no \\
      -o ServerAliveInterval=30 \\
      -o ServerAliveCountMax=3 \\
      -o ExitOnForwardFailure=yes \\
      -o BatchMode=yes \\
      -N -R "\${TUNNEL_PORT}:localhost:22" root@"\${SERVER}" >/dev/null 2>&1
  echo "Tunnel disconnected — retry in 10s..."
  sleep 10
done
TUNNEL_EOF
  chmod +x /usr/bin/hotspot-tunnel
  cat > /etc/init.d/hotspot-tunnel << 'TINIT_EOF'
#!/bin/sh /etc/rc.common
START=99
STOP=10
USE_PROCD=1
start_service() {
    procd_open_instance
    procd_set_param command /bin/sh /usr/bin/hotspot-tunnel
    procd_set_param respawn 3600 5 0
    procd_close_instance
}
TINIT_EOF
  chmod +x /etc/init.d/hotspot-tunnel
  /etc/init.d/hotspot-tunnel enable >/dev/null 2>&1
  /etc/init.d/hotspot-tunnel restart >/dev/null 2>&1 || /etc/init.d/hotspot-tunnel start >/dev/null 2>&1
  echo "✅ Tunnel جاهز — الدخول من السيرفر: ssh -p $TUNNEL_PORT root@localhost"
else
  say "[8/9] SSH Tunnel — مش متظبط (تخطي)"
fi` : `say "[8/9] SSH Tunnel — مش متظبط (تخطي)"`}

# ────────────────────────────────────────────────
# [9/9] تشغيل الخدمات + الاختبار النهائي
# ────────────────────────────────────────────────
say "[9/9] تشغيل الخدمات + الاختبار النهائي..."
/etc/init.d/wifidog enable >/dev/null 2>&1
/etc/init.d/wifidog restart >/dev/null 2>&1 || /etc/init.d/wifidog start >/dev/null 2>&1
sleep 4
if ! pgrep wifidog >/dev/null 2>&1; then
  echo "⚠️  wifidog ماشتالش من أول محاولة — بجرب تاني واطلع السبب..."
  logread 2>/dev/null | grep -i wifidog | tail -n 6 | sed 's/^/     /'
  /etc/init.d/wifidog restart >/dev/null 2>&1 || /etc/init.d/wifidog start >/dev/null 2>&1
  sleep 4
fi
if pgrep wifidog >/dev/null 2>&1; then
  echo "✅ wifidog شغال"
else
  echo "❌ wifidog مش راضي يشتغل — دي آخر رسايل الراوتر (ابعت صورة منها للدعم):"
  logread 2>/dev/null | tail -n 20 | sed 's/^/     /'
fi

# ── التأكد إن قواعد الاعتراض اتسجلت في الجدار الناري فعلاً ──
# دي القاعدة اللي بتخلي أي موبايل يفتح أي موقع يتبعت لصفحة الدخول تلقائياً
# (لو الجدار الناري اتعاد تشغيله بعد wifidog — القاعدة بتضيع وصفحة الدخول مش بتظهر)
if command -v iptables >/dev/null 2>&1; then
  NF=0
  while [ $NF -lt 8 ]; do
    iptables -t nat -S 2>/dev/null | grep -q 2060 && break
    sleep 2
    NF=$((NF+1))
  done
  if iptables -t nat -S 2>/dev/null | grep -q 2060; then
    echo "✅ قواعد الاعتراض اتسجلت — الموبايلات هتتبعت لصفحة الدخول تلقائياً"
  else
    echo "⚠️  قواعد الاعتراض مش ظاهرة — بجرب إعادة تشغيل الجدار الناري ثم wifidog..."
    /etc/init.d/firewall restart >/dev/null 2>&1
    sleep 2
    /etc/init.d/wifidog restart >/dev/null 2>&1
    sleep 5
    iptables -t nat -S 2>/dev/null | grep -q 2060 \
      && echo "✅ اتصلحت — الاعتراض شغال دلوقتي" \
      || { echo "❌ القاعدة لسه ناقصة — شغّل: hotspot-doctor وابعت سكرين بالنتيجة"; }
  fi
fi

hotspot-test

# تحميل نسخة صفحة الدخول في كاش الراوتر دلوقتي — أول موبايل هيلاقيها فوراً
say "[تمهيد] تحضير صفحة الدخول محلياً (كاش فوري)..."
UPORT=$(uci -q get uhttpd.main.listen_http 2>/dev/null | tr ' ' '\\n' | grep -v '^\\[' | head -n1 | sed 's/.*://')
[ -z "$UPORT" ] && UPORT=80
if wget -q -T 60 -O /dev/null "http://127.0.0.1:$UPORT/cgi-bin/go?ep=/portal/" 2>/dev/null; then
  echo "✅ صفحة الدخول متحمّلة محلياً — هتظهر للموبايل فوراً"
else
  echo "⚠️  الصفحة هتتحمّل تلقائياً أول ما موبايل يفتح البورتال (أو بعد 5 دقايق بالكرون)"
fi

# تسجيل فوري في السيرفر — الحالة أونلاين في لوحة التحكم خلال ثواني (مش مستنيين 5 دقايق)
if wget -q -T 20 -O /dev/null "http://127.0.0.1:$UPORT/cgi-bin/go?ep=/ping/?gw_id=$GW_ID&sys_uptime=1&sys_memfree=1&sys_load=1&wifidog_uptime=1" 2>/dev/null; then
  echo "✅ الجهاز اتسجل في السيرفر — هتلاقي حالته أونلاين في لوحة التحكم حالاً"
else
  echo "⚠️  التسجيل الفوري مانجحش — أول نبضة تلقائية من wifidog هتسجله خلال 5 دقايق"
fi

echo ""
echo "════════════════════════════════════════════════"
echo " ✅ السكربت الشامل خلص!"
echo ""
echo " GatewayID : $GW_ID"
echo " السيرفر   : $SRV"
echo ""
echo " 🔥 جرب دلوقتي:"
echo "    1- اعزل شبكة الواي فاي من الموبايل وارجع اتصل"
echo "    2- افتح أي موقع → هتتحول لصفحة الدخول"
echo "    3- اكتب رقم الكرت → النت هيفتح فوراً"
echo ""
echo " 🧪 لو حابب تتأكد في أي وقت: hotspot-test"
echo "════════════════════════════════════════════════"
echo ""
`
}
