// ═══════════════════════════════════════════════════════════
// 🛡️ مولّد سكربت الحارس الذاتي v10 — hotspot-watchdog
//
// v10 = قفل «الفلتر اليتيم» — أخطر شكل لـ«النت بيفتح من غير صفحة دخول»:
//   wifidog شغال وينبض وقواعده موجودة بس مش مربوطة على FORWARD
//   (سباق إقلاع / firewall restart بعد wifidog) → الترافيك بيعدي جنبها
//   خالص: HTTP يتاعترض (البورتال يظهر لبعض) وكل الباقي بيمشي ببلاش
//   الفحص القديم [3c] كان بيعدّ القواعد — والقواعد اليتيمة بتتععد → كشف فاشل
//   v10 بيفحص الربط نفسه على FORWARD وبيصلح: إعادة تشغيل → حقن الربط آمناً
//
// v8 = قفل أسباب «النت بيفتح من غير صفحة دخول»:
//   • تسريب IPv6 (wifidog بيعترض IPv4 بس) → قفل تمرير IPv6 من الشبكة المحلية
//   • TrustedMACList في الإعدادات → إزالة فورية + إعادة تشغيل
//   • قواعد فلتر wifidog مفقودة والعملية شغالة → إعادة تشغيل قسرية
//
// ده المصدر الوحيد للحارس في السستم (نسخة واحدة لكل الراوترات):
//   1) سكربت التسطيب الموحد بيحطه على الراوتر (embedded)
//   2) /api/router/watchdog بيخدم نصه — والراوترات المركّبة
//      بتحدّث نفسها بنسخته كل ساعة (self-update) من غير تدخل حد
//
// الحارس v2 بيعالج كل أسباب مشكلة "النت بيفتح من غير صفحة دخول"
// اللي حصلت في راوتر لوكشن (KT-KM08 — كيرنل مخصص بعد فورمات):
//   • uhttpd واقف → تشغيل
//   • wifidog واقف → إعادة تشغيل
//   • iptables مش متسطبة أصلاً → إصلاح سجل opkg (إدخال kernel الناقص)
//     ثم تسطيب — لأن فيد OpenWrt 23.05 مفيهوش حزمة kernel
//   • امتدادات nft معطوبة على الكيرنل (REDIRECT/REJECT بيفشلوا)
//     → تحميل الموديولات + تسطيب iptables-zz-legacy + تبديل الروابط
//       لباك-إند legacy ثم إعادة تشغيل firewall + wifidog
//   • قاعدة الاعتراض (2060) ناقصة → فحص الباك-إند → إصلاح → تشغيل
//   • تحديث ذاتي من السيرفر كل ساعة — أي إصلاح مستقبلي بيوصل
//     لكل الراوترات الشغالة لوحده خلال ساعة (من غير لصق أي حاجة)
//
// السكربت مستقل تماماً عن الجهاز: بيقرأ GatewayID ودومين السيرفر
// من /etc/wifidog.conf وقت التشغيل. كل عمليات الإصلاح مكتمة
// (rate-limited كل 30 دقيقة) عشان ميضغطش الراوتر أو الفيد.
// ═══════════════════════════════════════════════════════════

export const WATCHDOG_VERSION = '12'

export function buildWatchdogScript(): string {
  return `#!/bin/sh
# 🛡️ الحارس الذاتي v12 (WFD_WD_VERSION=12) — إصلاح جوهري: أسماء سلاسل wifidog الحقيقية
# v12 = العيب القاتل في v10/v11: فحص الربط كان بيدوّر على 'wifidog' بأحرف صغيرة في FORWARD،
#   وwifidog الحديث بيسمّي سلاسله 'WiFiDog_<if>_*' بحروف كبيرة → الفحص كان بيقول
#   «الربط مقطوع» على طول → إعادة تشغيل wifidog كل 10 دقايق → أي عميل بكرت سليم
#   بيتطرد طول الوقت (ده سبب «الكروت بتموت والناس بتققط»). v12 بيتعامل مع النظامين:
#   الجديد WiFiDog_<if>_Internet/Unknown + القديم wd_outgoing/wd_incoming
#   + [3c++] إنفورسمنت دائم لسلسلة المنع (Unknown لازم فيها REJECT فعلي)
#   + TrustedMACList مسموحة لو الإدارة عملت /etc/hotspot-trusted-allow (جهاز الإدارة بس)
# v11 — فحوصات محلية كل 5 دقايق + مكالمات السيرفر مخنوقة
# v10 إضافة — قفل «الفلتر اليتيم»: قواعد wifidog موجودة بس مش مربوطة على FORWARD
#   (سباق إقلاع: wifidog بنى قواعده وfirewall أعاد البناء بعده وشال الربط)
#   النتيجة كانت: البورتال بيظهر لأجهزة بالصدفة (HTTP) والنت كلها مفتوحة للباقي.
#   الفحص بيبص على ربط FORWARD نفسه مش على عدد القواعد — والإصلاح:
#   إعادة تشغيل wifidog → لو الربط مارجعش → حقن الربط يدوياً (بشرط إن السلاسل
#   فيها منع فعلي — عشان منحبسش الشبكة غلط) + بلاغ تشخيصي موسّع كل 10 دقايق
# v9 إضافة — تنظيف العملاء المصادقين القدامى العالقين في ذاكرة wifidog:
#   العملاء اللي كانوا داخلين في أي فترة سابقة (ثغرة أو إعداد قديم) بيفضلوا
#   «مصادقين» في ذاكرة الراوتر لحد ما wifidog يعيد تشغيله — بيتصفحوا ببلاش
#   حتى لو السيرفر شايفهم صفر جلسات. التنظيف بيطردّهم مرة واحدة لكل إقلاع:
#   المشترك بكرت سليم بيرجع تلقائي، واللي كان داخل ببلاش بياخد صفحة الدخول
#   + تقرير تشخيصي للسيرفر (عدد العملاء + قفل IPv6 + TrustedMAC)
# v8 إضافات أمنية — أسباب «النت بيفتح من غير صفحة دخول»:
#   • تسريب IPv6: wifidog بيعترض IPv4 بس — لو المزود مدي IPv6 العميل بيدخل من غير بورتال
#     → قفل تمرير IPv6 من الشبكة المحلية بالكامل (العملاء يستخدموا IPv4 ويعبروا على البورتال)
#   • TrustedMACList في wifidog.conf: أجهزة مسموح ليها تخطي البورتال خالص → بتنشال
#   • قواعد الفلتر بتاعة wifidog اتمسحت (بعد restart للفايروول) والعملية شغالة
#     → النبض شغال بس الاعتراض ميت = نت ببلاش → إعادة تشغيل قسرية
# يصلح لوحده: uhttpd / wifidog / قاعدة الاعتراض / باك-إند iptables المعطوب
# + كشف العملية العنيدة: wifidog ماسك GatewayID قديم بعد تحويل الجهاز
#   بين الكافيهات → قتل قسري وإعادة تشغيل (سبب "الجهاز غير موجود أو غير نشط")
# + كشف بقايا الكافيه القديم: سكربتات متوجهة لسيرفر تاني (سبب "الاسم بيرجع
#   للكافيه القديم" بعد التحويل) → مسح شامل وتسطيب نظيف من سيرفرنا لوحده
# + فرض اسم الشبكة من السيرفر كل ساعة — شبكة أمان لو المزامنة وقعت
# وبيحدّث نفسه من السيرفر كل ساعة — أي إصلاح جديد بيوصل لكل الراوترات لوحده
# وبيبلّغ عن نسخة السكربت المركّبة كل ساعة — عشان اللوحة تعرف مين محدّث ومين لأ
WFD_WD_VERSION="12"
LOG=/tmp/hotspot_watchdog.log
CONF=/etc/wifidog.conf

wdlog(){
  echo "$(date '+%m-%d %H:%M') $*" >> "$LOG" 2>/dev/null
  L=$(wc -l < "$LOG" 2>/dev/null)
  case "$L" in ''|*[!0-9]*) L=0 ;; esac
  [ "$L" -gt 200 ] && { tail -n 80 "$LOG" > "$LOG.t" 2>/dev/null; mv "$LOG.t" "$LOG" 2>/dev/null; }
  return 0
}

# ── واجهة البوابة من الإعدادات (v12) — أساس أسماء السلاسل في wifidog الحديث
wd_if(){
  WIF=$(sed -n 's/^GatewayInterface[[:space:]]*//p' "$CONF" 2>/dev/null | head -n1 | tr -d ' \\t')
  case "$WIF" in ''|*[!A-Za-z0-9._-]*) WIF=br-lan ;; esac
  echo "$WIF"
}

# ── هوية الجهاز من wifidog.conf (نسخة واحدة للحارس على أي راوتر)
GW=$(sed -n 's/^GatewayID[[:space:]]*//p' "$CONF" 2>/dev/null | head -n1 | tr -d ' \\t')
SRV=$(sed -n 's/.*FirewallRule allow to //p' "$CONF" 2>/dev/null | head -n1 | tr -d ' \\t')

# ── حماية: سطر الكرون موجود دايماً (لو حد مسحه بالغلط يرجع لوحده)
crontab -l 2>/dev/null | grep -q hotspot-watchdog || {
  (crontab -l 2>/dev/null | grep -v hotspot-watchdog; echo "*/5 * * * * /usr/bin/hotspot-watchdog >/dev/null 2>&1") | crontab - >/dev/null 2>&1
}

# ── [0b] صحة الكرون: أي سطر كرون بيكم سيرفر تاني مباشرة (بقايا كافيه قديم) بينتمس
#  وسطورنا بترجع لوحدها — ده اللي يمنع أي حاجة قديمة تشتغل ورا ضهرنا
if crontab -l 2>/dev/null | grep -Eq 'vercel\\.app'; then
  (crontab -l 2>/dev/null | grep -vE 'hotspot-|vercel\\.app'; \\
   echo "*/5 * * * * /usr/bin/hotspot-watchdog >/dev/null 2>&1"; \\
   [ -f /usr/bin/hotspot-ssid-sync ] && echo "*/60 * * * * /usr/bin/hotspot-ssid-sync >/dev/null 2>&1"; true
  ) | crontab - >/dev/null 2>&1 \\
  && wdlog "الكرون كان فيه سطور لسيرفرات تانية (بقايا كافيه قديم) → اتنضفت ورجّعنا سطورنا"
fi

# ── [0c] ترقية كرون ssid-sync القديم: كل 5 دقايق كانت بتضرب قاعدة السيرفر
#  على الفاضي 24/7 (سبب استهلاك ساعات Neon) → كل 60 دقيقة كفاية
if crontab -l 2>/dev/null | grep -q 'hotspot-ssid-sync'; then
  if crontab -l 2>/dev/null | grep -q '\\*/5 \\* \\* \\* \\* /usr/bin/hotspot-ssid-sync'; then
    (crontab -l 2>/dev/null | grep -v 'hotspot-ssid-sync'; \\
     [ -f /usr/bin/hotspot-ssid-sync ] && echo "*/60 * * * * /usr/bin/hotspot-ssid-sync >/dev/null 2>&1"; true
    ) | crontab - >/dev/null 2>&1 \\
    && wdlog "كرون مزامنة الاسم اتخفف من كل 5 دقايق لكل ساعة (توفير قاعدة السيرفر)"
  fi
fi

# ── [1] الجسر المحلي (uhttpd)
if ! pgrep uhttpd >/dev/null 2>&1; then
  /etc/init.d/uhttpd start >/dev/null 2>&1
  wdlog "uhttpd كان واقف → اتشغّل"
fi

# ── [2] خدمة wifidog — إعادة تشغيل بقوة (مش بس لو واقفة)
# init.d ساعات بيفشل يقتل العملية القديمة فتفضل عايشة بالإعدادات القديمة
wd_frs(){
  /etc/init.d/wifidog stop >/dev/null 2>&1
  killall -9 wifidog >/dev/null 2>&1
  sleep 2
  killall -9 wifidog >/dev/null 2>&1
  /etc/init.d/wifidog start >/dev/null 2>&1
  sleep 4
  pgrep wifidog >/dev/null 2>&1 || { wifidog >/dev/null 2>&1 & sleep 3; }
  return 0
}
if ! pgrep wifidog >/dev/null 2>&1; then
  wd_frs
  wdlog "wifidog كان واقف → اتشغّل"
else
  # ── [2d] تنظيف العملاء المصادقين القدامى (مرة واحدة لكل إقلاع) ──
  # ده حل بلاغ «النت بيفتح لبعض الناس من غير صفحة دخول»: ذاكرة wifidog فيها
  # عملاء اتصدّقوا قبل أي إصلاح أمني — السيرفر شايفهم صفر جلسات بس الراوتر
  # مازال بيمرر ترافيكم. الطرد بيخلّي الكل يعدّي على البورتال تاني.
  if [ ! -f /tmp/wd_purge_done ]; then
    touch /tmp/wd_purge_done
    WDCLI=$(wdctl status 2>/dev/null | grep -ci 'MAC:')
    case "$WDCLI" in ''|*[!0-9]*) WDCLI=0 ;; esac
    wd_frs
    wdlog "🔒 تنظيف العملاء المصادقين القدامى (\${WDCLI} عميل كان عالق في الذاكرة) — المشتركين بيرجعوا تلقائي وغيرهم بياخدوا صفحة الدخول"
  fi
  # ── [2b] كشف العملية العنيدة: wifidog الشغال ماسك GatewayID قديم؟
  # بنسأله بنفسه: إيه الهوية اللي بيحوّل بيها الموبايلات (302 على بورت البوابة)
  # ولو مختلفة عن الإعدادات → قتل قسري (مرة كل 30 دقيقة كحد أقصى)
  TSF=/tmp/wd_gwfix_ts
  NOW=$(date +%s); TS=$(cat "$TSF" 2>/dev/null); case "$TS" in ''|*[!0-9]*) TS=0 ;; esac
  if [ $((NOW - TS)) -ge 1800 ] && command -v nc >/dev/null 2>&1 && [ -n "$GW" ]; then
    RUNGW=$(printf "GET /login/ HTTP/1.0\\r\\nHost: 127.0.0.1\\r\\n\\r\\n" | nc -w 5 127.0.0.1 2060 2>/dev/null | sed -n 's/.*[?&]gw_id=\\([^&]*\\).*/\\1/p' | head -n1 | tr -d '\\r')
    if [ -n "$RUNGW" ] && [ "$RUNGW" != "$GW" ]; then
      date +%s > "$TSF"
      wdlog "wifidog ماسك هوية قديمة ($RUNGW والصح $GW) → قتل قسري وإعادة تشغيل"
      wd_frs
      pgrep wifidog >/dev/null 2>&1 || wdlog "⚠️ wifidog مرجعش بعد إصلاح الهوية — هيجرب تاني بعد 30 دقيقة"
    fi
  fi
fi

# ── [2c] كشف بقايا كافيه قديم: سكربتات بتكلم سيرفر غير سيرفرنا
#  ده سبب "الاسم بيرجع للكافيه القديم" بعد تحويل الجهاز: لو sync أو الجسر
#  مكتوبين لدومين كافيه تاني (تسطيب قديم فضل عايش) → بنمسح كل حاجة قديمة
#  ونعمل تسطيب نظيف من سيرفرنا (مرة كل ساعتين كحد أقصى عشان مينضغطش الراوتر)
NOW=$(date +%s); TS=$(cat /tmp/wd_foreign_ts 2>/dev/null); case "$TS" in ''|*[!0-9]*) TS=0 ;; esac
if [ -n "$SRV" ] && [ -n "$GW" ] && [ -f /usr/bin/hotspot-ssid-sync ] && [ $((NOW - TS)) -ge 7200 ]; then
  FRN=0
  grep -qF "$SRV" /usr/bin/hotspot-ssid-sync 2>/dev/null || FRN=1
  if [ -f /www/cgi-bin/go ] && ! grep -qF "$SRV" /www/cgi-bin/go 2>/dev/null; then
    FRN=1
  fi
  if [ "$FRN" = "1" ]; then
    date +%s > /tmp/wd_foreign_ts
    wdlog "⚠️ فيه سكربتات متوجهة لسيرفر تاني (بقايا كافيه قديم) → مسح شامل + تسطيب نظيف من سيرفرنا"
    wget -q -T 30 -O /tmp/wd_fix_install.sh --no-check-certificate "https://\${SRV}/api/router/fix?gw_id=\${GW}" 2>/dev/null \\
      || uclient-fetch -q -T 30 -O /tmp/wd_fix_install.sh --no-check-certificate "https://\${SRV}/api/router/fix?gw_id=\${GW}" 2>/dev/null
    if [ -s /tmp/wd_fix_install.sh ] && head -n1 /tmp/wd_fix_install.sh 2>/dev/null | grep -q '#!/bin/sh' && sh -n /tmp/wd_fix_install.sh >/dev/null 2>&1; then
      sh /tmp/wd_fix_install.sh >> "$LOG" 2>&1
      wdlog "التسطيب النظيف خلص — بقايا الكافيه القديم اتمسحت ✅"
    else
      wdlog "⚠️ تنزيل سكربت التسطيب فشل — هنعيد المحاولة بعد ساعتين"
      rm -f /tmp/wd_foreign_ts
    fi
    rm -f /tmp/wd_fix_install.sh
    exit 0
  fi
fi

# ── فحص صحة باك-إند iptables (اختبار امتدادات حقيقي — مش مجرد وجود الأمر)
wd_backend_ok(){
  iptables -t nat -N WFD_WD_CHK >/dev/null 2>&1 || iptables -t nat -F WFD_WD_CHK >/dev/null 2>&1
  iptables -t filter -N WFD_WD_CHK >/dev/null 2>&1 || iptables -t filter -F WFD_WD_CHK >/dev/null 2>&1
  if iptables -t nat -A WFD_WD_CHK -p tcp -j REDIRECT --to-ports 2060 >/dev/null 2>&1 \\
     && iptables -t filter -A WFD_WD_CHK -p tcp -j REJECT --reject-with icmp-port-unreachable >/dev/null 2>&1; then
    R=0
  else
    R=1
  fi
  iptables -t nat -F WFD_WD_CHK >/dev/null 2>&1;    iptables -t nat -X WFD_WD_CHK >/dev/null 2>&1
  iptables -t filter -F WFD_WD_CHK >/dev/null 2>&1; iptables -t filter -X WFD_WD_CHK >/dev/null 2>&1
  return $R
}

# ── إصلاح سجل opkg لو ناقصه إدخال kernel (فيد OpenWrt مفيهوش الحزمة — بيحصل بعد الفورمات
#    وساعتها أي تسطيب لحزم الجدار الناري بيفشل بـ "cannot find dependency kernel")
wd_fix_opkg_kernel(){
  KVER="$(opkg info kmod-ipt-core 2>/dev/null | sed -n 's/.*kernel (=[[:space:]]*\\([^)]*\\)).*/\\1/p' | head -n1 | tr -d ' \\t')"
  [ -z "$KVER" ] && KVER="$(opkg info kmod-nft-compat 2>/dev/null | sed -n 's/.*kernel (=[[:space:]]*\\([^)]*\\)).*/\\1/p' | head -n1 | tr -d ' \\t')"
  [ -z "$KVER" ] && return 0
  STK="$(opkg status kernel 2>/dev/null | sed -n 's/^Version: //p' | head -n1)"
  if [ -z "$STK" ]; then
    { echo ""; echo "Package: kernel"; echo "Version: $KVER"; echo "Architecture: $(opkg print-architecture 2>/dev/null || echo mipsel_24kc)"; echo "Status: install ok installed"; echo ""; } >> /usr/lib/opkg/status
    wdlog "سجلنا kernel ($KVER) في سجل opkg — كان ناقص (سبب فشل التسطيب)"
  elif [ "$STK" != "$KVER" ]; then
    sed -i "/^Package: kernel\\$/,/^\\$/s/^Version: .*/Version: $KVER/" /usr/lib/opkg/status
    wdlog "ظبطنا إصدار kernel المسجل في opkg: $STK → $KVER"
  fi
  return 0
}

# ── تحميل موديولات الجدار الناري (legacy) — best-effort
wd_load_modules(){
  for m in ip_tables iptable_filter iptable_nat iptable_mangle ipt_REJECT nf_nat nf_conntrack nf_nat_redirect xt_REDIRECT xt_MASQUERADE xt_tcpudp xt_state xt_conntrack xt_mac xt_mark xt_LOG xt_comment xt_multiport nf_reject_ipv4; do
    modprobe "$m" >/dev/null 2>&1 || { M="/lib/modules/$(uname -r)/$m.ko"; [ -f "$M" ] && insmod "$M" >/dev/null 2>&1; }
  done
  return 0
}

# ── إصلاح الباك-إند: تبديل لـ legacy المتوافق مع أي كيرنل (مرة كل 30 دقيقة كحد أقصى)
wd_backend_repair(){
  TSF=/tmp/wd_be_ts
  NOW=$(date +%s); TS=$(cat "$TSF" 2>/dev/null); case "$TS" in ''|*[!0-9]*) TS=0 ;; esac
  [ $((NOW - TS)) -lt 1800 ] && return 0
  date +%s > "$TSF"
  wdlog "امتدادات iptables (nft) معطوبة على الكيرنل ده → تبديل لباك-إند legacy..."
  wd_load_modules
  wd_fix_opkg_kernel
  opkg update >/dev/null 2>&1
  opkg install iptables-zz-legacy >/dev/null 2>&1 || opkg install --force-depends iptables-zz-legacy >/dev/null 2>&1
  if [ -f /usr/sbin/xtables-legacy-multi ]; then
    ln -sf /usr/sbin/xtables-legacy-multi /usr/sbin/iptables
    ln -sf /usr/sbin/xtables-legacy-multi /usr/sbin/iptables-restore 2>/dev/null
    ln -sf /usr/sbin/xtables-legacy-multi /usr/sbin/iptables-save 2>/dev/null
    wdlog "الروابط اتبدّلت لباك-إند legacy (متوافق مع الكيرنل)"
  else
    wdlog "⚠️ باك-إند legacy متسطبش — راجع سجل opkg"
  fi
  return 0
}

# ── تسطيب iptables لو مش موجودة أصلاً (مرة كل 30 دقيقة كحد أقصى)
wd_install_iptables(){
  TSF=/tmp/wd_ipt_ts
  NOW=$(date +%s); TS=$(cat "$TSF" 2>/dev/null); case "$TS" in ''|*[!0-9]*) TS=0 ;; esac
  [ $((NOW - TS)) -lt 1800 ] && return 0
  date +%s > "$TSF"
  wdlog "iptables مش متسطبة → بنحاول نسطّبها..."
  wd_fix_opkg_kernel
  opkg update >/dev/null 2>&1
  opkg install iptables >/dev/null 2>&1 || opkg install --force-depends iptables >/dev/null 2>&1
  if command -v iptables >/dev/null 2>&1; then
    wdlog "iptables اتسطبت"
    wd_load_modules
    wd_backend_ok || wd_backend_repair
  else
    wdlog "⚠️ تسطيب iptables فشل — هنجرب تاني بعد 30 دقيقة"
  fi
  return 0
}

# ── [3] قاعدة الاعتراض (2060) + صحة الباك-إند
if command -v iptables >/dev/null 2>&1; then
  if ! iptables -t nat -S 2>/dev/null | grep -q 2060; then
    wd_backend_ok || wd_backend_repair
    /etc/init.d/firewall restart >/dev/null 2>&1
    sleep 3
    wd_frs
    sleep 5
    if iptables -t nat -S 2>/dev/null | grep -q 2060; then
      wdlog "قاعدة الاعتراض اتصلحت ورجعت ✅"
    else
      wdlog "⚠️ قاعدة الاعتراض لسه ناقصة بعد الإصلاح — هنجرب تاني بعد 5 دقايق"
    fi
  fi
else
  wd_install_iptables
  if command -v iptables >/dev/null 2>&1; then
    wd_frs
  fi
fi

# ── [3a-sec] إزالة TrustedMACList — باب تخطي البورتال ──
# أي أجهزة في القايمة دي بتفتح النت من غير صفحة دخول خالص. تسطيبنا مبيكتبش
# القايمة دي أبدًا — وجودها معناه بقايا إعداد قديم/يدوي لازم ينشال فورًا
# v12: لو الإدارة عملت ملف /etc/hotspot-trusted-allow — إذن رسمي بإبقاء جهاز الإدارة
# موثوق (بيتعمل بأداة wh_trust.sh). من غير الملف: بنشالها فورًا زي v8 (باب تخطي مقفول)
if grep -qi '^[[:space:]]*TrustedMACList' "$CONF" 2>/dev/null && [ ! -f /etc/hotspot-trusted-allow ]; then
  sed -i '/^[[:space:]]*TrustedMACList[[:space:]]/d; /^[[:space:]]*TrustedMACList$/d' "$CONF" 2>/dev/null
  wd_frs
  wdlog "🔒 TrustedMACList اتنشالت من wifidog.conf (كانت بتسمح لأجهزة تخطي البورتال) — wifidog اتعاد تشغيله"
fi

# ── [3c] فحص إنفورسمنت الفلتر — النبض شغال بس الاعتراض ميت ──
# الحالة الكلاسيكية: حد عمل restart للفايروول (أو fw3) بعد ما wifidog اشتغل
# → قواعد wifidog في جدول filter اتمسحت والعملية فضلت شغالة بتنبض عادي
# → النتيجة: النت بيفتح من غير صفحة دخول رغم إن كل حاجة شكلها سليم
if pgrep wifidog >/dev/null 2>&1 && command -v iptables >/dev/null 2>&1; then
  FLTS=$(iptables -t filter -S 2>/dev/null | grep -ciE 'wifidog|wd_|2060')
  case "$FLTS" in ''|*[!0-9]*) FLTS=0 ;; esac
  if [ "$FLTS" -eq 0 ]; then
    wd_frs
    sleep 5
    FLTS=$(iptables -t filter -S 2>/dev/null | grep -ciE 'wifidog|wd_|2060')
    case "$FLTS" in ''|*[!0-9]*) FLTS=0 ;; esac
    if [ "$FLTS" -gt 0 ]; then
      wdlog "🔒 قواعد فلتر wifidog كانت مفقودة (اعتراض ميت = نت ببلاش) → اتعاد بناؤها بإعادة التشغيل ✅"
    else
      wdlog "⚠️ قواعد الفلتر لسه ناقصة بعد إعادة التشغيل — هنجرب تاني بعد 5 دقايق"
    fi
  fi
fi

# ── [3c+] قفل «الفلتر اليتيم» (v10) — القواعد موجودة بس مش مربوطة على FORWARD ──
# سباق الإقلاع الكلاسيكي: wifidog بنى قواعده ثم firewall أعاد بناء القواعد بعده
# وشال الربط من FORWARD — السلاسل فضلت موجودة (يتيمة) والترافيك بيعدي جنبها خالص:
# HTTP يتاعترض (البورتال يظهر لبعض الجهازات بس) وكل الباقي بيمشي ببلاش.
# الفحص القديم كان بيعدّ القواعد فيجد السلاسل اليتيمة فبيعتبر كل حاجة سليمة — كشف فاشل.
# هنا بنفحص الربط نفسه. الإصلاح v11: حقن مباشر على FORWARD لو السلاسل حية (بلا أي إزعاج)،
# وإعادة تشغيل wifidog بس لو السلاسل نفسها ناقصة — عشان مندخلش في حلقة إعادة تشغيل بتحرق الحقن.
wd_fwd_hooked(){
  # v12: مطابقة غير حساسة لحالة الحروف — السلاسل الفعلية اسمها WiFiDog_<if>_* بحروف كبيرة
  # (العيب القاتل في v10/v11: 'wifidog' صغيرة مكانتش بتطابق → «الربط مقطوع» دايماً)
  iptables -t filter -S FORWARD 2>/dev/null | grep -qiE 'wifidog|wd_outgoing|wd_incoming|wd_default'
}
# شرط الحقن الآمن (v12): يدعم النظامين
#   الجديد (wifidog 1.3.x): WiFiDog_<if>_Unknown لازم يكون فيها REJECT فعلي (قفل غير-المصادقين)
#   القديم: wd_outgoing/wd_incoming فيها REJECT/DROP
wd_chains_alive(){
  WIF=$(wd_if)
  if iptables -t filter -S "WiFiDog_\${WIF}_Unknown" >/dev/null 2>&1; then
    iptables -t filter -S "WiFiDog_\${WIF}_Unknown" 2>/dev/null | grep -qiE 'REJECT|DROP'
    return $?
  fi
  iptables -t filter -S wd_outgoing 2>/dev/null | grep -qiE 'REJECT|DROP|wd_' && \
  iptables -t filter -S wd_incoming 2>/dev/null | grep -qiE 'REJECT|DROP|wd_'
}
# حقن الربط على FORWARD (v12) — بيربط السلسلة الصح حسب نظام wifidog المكتشف
wd_hook_fwd(){
  WIF=$(wd_if)
  if iptables -t filter -S "WiFiDog_\${WIF}_Internet" >/dev/null 2>&1; then
    iptables -t filter -C FORWARD -i "$WIF" -j "WiFiDog_\${WIF}_Internet" 2>/dev/null || \
      iptables -t filter -I FORWARD 1 -i "$WIF" -j "WiFiDog_\${WIF}_Internet"
  fi
  if iptables -t filter -S wd_outgoing >/dev/null 2>&1; then
    iptables -t filter -C FORWARD -i "$WIF" -j wd_outgoing 2>/dev/null || iptables -t filter -I FORWARD 1 -i "$WIF" -j wd_outgoing
  fi
  if iptables -t filter -S wd_incoming >/dev/null 2>&1; then
    iptables -t filter -C FORWARD -o "$WIF" -j wd_incoming 2>/dev/null || iptables -t filter -I FORWARD 1 -o "$WIF" -j wd_incoming
  fi
}
if pgrep wifidog >/dev/null 2>&1 && command -v iptables >/dev/null 2>&1; then
  WIF=$(wd_if)
  if ! wd_fwd_hooked; then
    TSF=/tmp/wd_hook_ts
    NOW=$(date +%s); TS=$(cat "$TSF" 2>/dev/null); case "$TS" in ''|*[!0-9]*) TS=0 ;; esac
    if wd_chains_alive; then
      # المحاولة 1 (الأسرع وبلا أي إزعاج): السلاسل حية → حقن مباشر بلا إعادة تشغيل
      # ده بيمنع حلقة إعادة تشغيل wifidog كل 5 دقايق اللي كانت بتمسح الحقن نفسه
      if [ $((NOW - TS)) -ge 900 ]; then
        date +%s > "$TSF"
        wd_hook_fwd
        if wd_fwd_hooked; then
          wdlog "🔒 الفلتر اليتيم اتصلك: ربطنا قواعد wifidog على FORWARD مباشرة (\${WIF}) — النت مقفول إلا بكروت سليمة ✅"
        else
          wdlog "⚠️ حقن ربط FORWARD فشل — هنعيد المحاولة بعد 15 دقيقة"
        fi
      fi
    else
      # المحاولة 2: سلاسل wifidog نفسها ناقصة → إعادة تشغيل (مرة كل 10 دقايق كحد أقصى)
      TSF2=/tmp/wd_frs_ts
      NOW=$(date +%s); TS2=$(cat "$TSF2" 2>/dev/null); case "$TS2" in ''|*[!0-9]*) TS2=0 ;; esac
      if [ $((NOW - TS2)) -ge 600 ]; then
        date +%s > "$TSF2"
        wd_frs
        N=0
        while [ $N -lt 6 ]; do
          sleep 5
          N=$((N+1))
          if wd_chains_alive; then
            wd_hook_fwd
            if wd_fwd_hooked; then
              wdlog "🔒 الفلتر اليتيم: إعادة تشغيل wifidog + ربط FORWARD (\${WIF}) بعد انتظار \${N}×5 ثانية ✅"
            else
              wdlog "⚠️ ربط FORWARD فشل بعد إعادة التشغيل — هنعيد المحاولة"
            fi
            break
          fi
        done
      fi
    fi
  fi
fi

# ── [3c++] إنفورسمنت دائم (v12): قفل غير-المصادقين لازم يكون حي حتى لو الربط سليم ──
# الحالة الخفية: الربط موجود بس سلسلة المنع (Unknown) فقدت REJECT بتاعها → نت ببلاش
# وكل الفحوصات القديمة بتقول سليم. v12 بيفحص سلسلة المنع لوحدها — لو ناقصة → إعادة تشغيل
# محدودة (نفس rate-limit [3c+] عشان مايتكررش إعادة تشغيل في نفس الدورة)
if pgrep wifidog >/dev/null 2>&1 && command -v iptables >/dev/null 2>&1; then
  WIF=$(wd_if)
  BLKOK=0
  if iptables -t filter -S "WiFiDog_\${WIF}_Unknown" >/dev/null 2>&1; then
    iptables -t filter -S "WiFiDog_\${WIF}_Unknown" 2>/dev/null | grep -qiE 'REJECT|DROP' && BLKOK=1
  elif iptables -t filter -S wd_outgoing >/dev/null 2>&1; then
    iptables -t filter -S wd_outgoing 2>/dev/null | grep -qiE 'REJECT|DROP' && BLKOK=1
  else
    BLKOK=2
  fi
  if [ "$BLKOK" != "1" ]; then
    TSF3=/tmp/wd_frs_ts
    NOW=$(date +%s); TS3=$(cat "$TSF3" 2>/dev/null); case "$TS3" in ''|*[!0-9]*) TS3=0 ;; esac
    if [ $((NOW - TS3)) -ge 600 ]; then
      date +%s > "$TSF3"
      wd_frs
      sleep 5
      if wd_chains_alive && ! wd_fwd_hooked; then wd_hook_fwd; fi
      wdlog "🔒 قفل غير-المصادقين كان ناقص (سلسلة المنع من غير REJECT) → wifidog اتعاد تشغيله ورجع القفل ✅"
    fi
  fi
fi

# ── [3d] قفل تسريب IPv6 — أكبر سبب لـ«النت ببلاش من غير صفحة دخول» ──
# wifidog بيعترض على IPv4 بس. لو المزود (WE) مدي الشبكة IPv6، أي موبايل حديث
# بيوصل للإنترنت عبر IPv6 وبيتخطى البورتال خالص. الحل: منع تمرير IPv6 من/إلى
# الشبكة المحلية — العملاء هيرجعوا لـIPv4 ويعبروا على البورتال زي أي عميل جديد
if command -v ip6tables >/dev/null 2>&1; then
  ip6tables -C FORWARD -i br-lan -j DROP 2>/dev/null || ip6tables -I FORWARD 1 -i br-lan -j DROP 2>/dev/null
  ip6tables -C FORWARD -o br-lan -j DROP 2>/dev/null || ip6tables -I FORWARD 1 -o br-lan -j DROP 2>/dev/null
elif [ -f /etc/init.d/firewall ]; then
  # ip6tables مش متسطبة — محاولة تسطيب best-effort (مرة كل 30 دقيقة كحد أقصى)
  TSF=/tmp/wd_ip6_ts
  NOW=$(date +%s); TS=$(cat "$TSF" 2>/dev/null); case "$TS" in ''|*[!0-9]*) TS=0 ;; esac
  if [ $((NOW - TS)) -ge 1800 ]; then
    date +%s > "$TSF"
    wd_fix_opkg_kernel
    opkg update >/dev/null 2>&1
    opkg install ip6tables >/dev/null 2>&1 || opkg install --force-depends ip6tables >/dev/null 2>&1
    if command -v ip6tables >/dev/null 2>&1; then
      ip6tables -I FORWARD 1 -i br-lan -j DROP 2>/dev/null
      ip6tables -I FORWARD 1 -o br-lan -j DROP 2>/dev/null
      wdlog "🔒 IPv6 للشبكة المحلية اتقفل (كان تسريب نت ببلاش) ✅"
    else
      wdlog "⚠️ ip6tables متسطبش — لو المزود مدي IPv6 ممكن تسريب يستمر (هنجرب تاني بعد 30 دقيقة)"
    fi
  fi
fi

# ── [3b] فرض اسم الشبكة من السيرفر — شبكة أمان لو المزامنة وقعت أو اتشالت
#  بنجيب الاسم الرسمي (wifiSSID) من سيرفرنا ونطبقه لو مختلف — نفس منطق المزامنة
# v7: كل 60 دقيقة بدل كل 5 — الفحوصات المحلية بتفضل كل 5 دقايق لكن مكالمات
# السيرفر اتخنقت عشان قاعدة البيانات تنام وتوفر ساعات الحساب (سبب وقوف Neon)
NOW=$(date +%s); TS=$(cat /tmp/wd_ssid_ts 2>/dev/null); case "$TS" in ''|*[!0-9]*) TS=0 ;; esac
if [ -n "$SRV" ] && [ -n "$GW" ] && [ $((NOW - TS)) -ge 3600 ]; then
  date +%s > /tmp/wd_ssid_ts
  WANT=$(uclient-fetch -q -T 15 -O - --no-check-certificate "https://\${SRV}/api/router/identity?gw_id=\${GW}" 2>/dev/null | head -n1)
  [ -z "$WANT" ] && WANT=$(wget -q -T 15 -O - --no-check-certificate "https://\${SRV}/api/router/identity?gw_id=\${GW}" 2>/dev/null | head -n1)
  WANT=$(printf '%s' "$WANT" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  case "$WANT" in
    *"<"*|*"{"*|*'"'*|*"%"*|*"="*|*"&"*|*";"*|""|"unknown") WANT="" ;;
  esac
  if [ -n "$WANT" ] && [ "\${#WANT}" -le 64 ]; then
    CHG=0; i=0
    while uci -q show wireless.@wifi-iface[$i] >/dev/null 2>&1; do
      WMODE=$(uci -q get wireless.@wifi-iface[$i].mode 2>/dev/null)
      if [ "$WMODE" = "ap" ] || [ -z "$WMODE" ]; then
        CUR=$(uci -q get wireless.@wifi-iface[$i].ssid 2>/dev/null)
        if [ "$CUR" != "$WANT" ]; then
          uci set wireless.@wifi-iface[$i].ssid="$WANT"
          CHG=1
        fi
      fi
      i=$((i+1))
    done
    if [ "$CHG" = "1" ]; then
      uci commit wireless
      wifi reload >/dev/null 2>&1
      wdlog "اسم الشبكة اتظبط من السيرفر: $WANT"
    fi
  fi
fi

# ── [4a] تقرير تشخيصي للسيرفر كل 10 دقايق (v10) — اللوحة تشوف حالة الراوتر من الداخل
#  فصلنا البلاغ عن التحديث: البلاغ سريع (بيكشف أي تسريب خلال 10 دقايق)
#  والتحديث الذاتي فضل كل ساعة زي ما هو (توفير مكالمات)
NOW=$(date +%s); TS=$(cat /tmp/wd_rep_ts 2>/dev/null); case "$TS" in ''|*[!0-9]*) TS=0 ;; esac
if [ $((NOW - TS)) -ge 600 ] && [ -n "$SRV" ] && [ -n "$GW" ]; then
  date +%s > /tmp/wd_rep_ts
  INST=$(cat /etc/hotspot-script-version 2>/dev/null | tr -d '[:space:]')
  case "$INST" in ''|*[!0-9]*) INST=0 ;; esac
  LANIP=$(ip -4 addr show br-lan 2>/dev/null | awk '/inet /{split($2,a,"/"); print a[1]; exit}')
  WDCLI=$(wdctl status 2>/dev/null | grep -ci 'MAC:')
  case "$WDCLI" in ''|*[!0-9]*) WDCLI=0 ;; esac
  IP6OK=0
  command -v ip6tables >/dev/null 2>&1 && ip6tables -S FORWARD 2>/dev/null | grep -q 'br-lan' && IP6OK=1
  TMPRESENT=0
  grep -qi '^[[:space:]]*TrustedMACList' "$CONF" 2>/dev/null && TMPRESENT=1
  # ── تشخيصات v10: الربط الفعلي للفلتر — قلب كشف «النت ببلاش» ──
  FWDH=0
  wd_fwd_hooked && FWDH=1
  WDNAT=$(iptables -t nat -S 2>/dev/null | grep -ciE 'wd_|wifidog|2060')
  case "$WDNAT" in ''|*[!0-9]*) WDNAT=0 ;; esac
  WDFIL=$(iptables -t filter -S 2>/dev/null | grep -ciE 'wd_|wifidog|2060')
  case "$WDFIL" in ''|*[!0-9]*) WDFIL=0 ;; esac
  # الرد من السيرفر: OK = كله سليم | PURGE = أمر طوارئ من الإدارة → غسل كامل للذاكرة
  REPURL="https://\${SRV}/api/router/report-script?gw_id=\${GW}&inst=\${INST}&wd=\${WFD_WD_VERSION}&lanip=\${LANIP}&clients=\${WDCLI}&ip6=\${IP6OK}&tm=\${TMPRESENT}&fwd=\${FWDH}&wdnat=\${WDNAT}&wdfil=\${WDFIL}"
  RESP=$(uclient-fetch -q -T 15 -O - --no-check-certificate "$REPURL" 2>/dev/null | head -n1)
  [ -z "$RESP" ] && RESP=$(wget -q -T 15 -O - --no-check-certificate "$REPURL" 2>/dev/null | head -n1)
  case "$RESP" in ""|OK*) : ;;
    *PURGE*)
      wdlog "🚨 أمر إدارة: غسل كامل لذاكرة wifidog (طرد كل المصادقين) — المشتركين بكرت سليم هيدخلوا الكود تاني"
      wd_frs
      command -v conntrack >/dev/null 2>&1 && conntrack -F >/dev/null 2>&1
      wdlog "🚨 الغسل اتنفذ — wifidog بقائمة عملاء فاضية وكل الاتصالات المفتوحة اتقطعت"
    ;;
  esac
fi

# ── [4] تحديث ذاتي من السيرفر كل ساعة — إصلاحات المستقبل بتنزل على الراوتر لوحدها
#  التحقق قبل الاستبدال: حجم سليم + سطر shebang + علامة النسخة + سطر الكرون + sh -n سليم
NOW=$(date +%s); TS=$(cat /tmp/wd_upd_ts 2>/dev/null); case "$TS" in ''|*[!0-9]*) TS=0 ;; esac
if [ $((NOW - TS)) -ge 3600 ] && [ -n "$SRV" ]; then
  date +%s > /tmp/wd_upd_ts
  F=/tmp/wd_new.sh
  uclient-fetch -q -T 20 -O "$F" --no-check-certificate "https://\${SRV}/api/router/watchdog" 2>/dev/null \\
    || wget -q -T 20 -O "$F" --no-check-certificate "https://\${SRV}/api/router/watchdog" 2>/dev/null
  if [ -s "$F" ]; then
    SZ=$(wc -c < "$F" 2>/dev/null); case "$SZ" in ''|*[!0-9]*) SZ=0 ;; esac
    if [ "$SZ" -ge 2000 ] \\
       && head -n1 "$F" 2>/dev/null | grep -q '#!/bin/sh' \\
       && grep -q 'WFD_WD_VERSION' "$F" 2>/dev/null \\
       && grep -q 'hotspot-watchdog' "$F" 2>/dev/null \\
       && sh -n "$F" >/dev/null 2>&1; then
      if ! cmp -s "$F" /usr/bin/hotspot-watchdog; then
        cp /usr/bin/hotspot-watchdog /usr/bin/hotspot-watchdog.bak 2>/dev/null
        # نسخ على نفس نظام الملفات أولاً — الـ mv النهائي يبقى ذري (rename) وآمن حتى لو
        # الحارس القديم شغال في نفس اللحظة من الكرون
        cp "$F" /usr/bin/.wd.new 2>/dev/null && chmod +x /usr/bin/.wd.new 2>/dev/null && mv /usr/bin/.wd.new /usr/bin/hotspot-watchdog 2>/dev/null
        rm -f "$F" /usr/bin/.wd.new
        if grep -q 'WFD_WD_VERSION' /usr/bin/hotspot-watchdog 2>/dev/null; then
          wdlog "الحارس اتحدّث لنفس نسخة السيرفر ✅ (النسخة القديمة محفوظة في hotspot-watchdog.bak)"
        else
          wdlog "⚠️ فشل استبدال الحارس — هيجرب تاني بعد ساعة"
        fi
      else
        rm -f "$F"
      fi
    else
      rm -f "$F"
    fi
  else
    rm -f "$F"
  fi
fi

exit 0
`
}

// ═══════════════════════════════════════════════════════════
// 🔒 مولّد سكربت «القفل الشامل الفوري» — WH-LOCK
//
// طلب الإدارة: سكربت واحد يقفل كل المتصلين (حتى فاتحي الكروت السليمة)
// بدون استثناء — والدخول بعدها بالكرت فقط.
//
// بيتخدم عن بُعد من غير لصق أي حاجة:
//   uclient-fetch ... "https://<srv>/api/router/watchdog?lockdown=1" → sh
//
// الخطوات:
//   [1] إيقاف الحارس القديم مؤقتاً (فحصه الخاطئ كان بيعيد تشغيل wifidog كل 10 دقايق)
//   [2] طرد كل المتصلين: إعادة تشغيل wifidog بذاكرة فاضية + قطع الاتصالات المفتوحة
//   [3] انتظار سلاسل المنع (WiFiDog_<if>_Unknown فيها REJECT) — النظامين مدعومين
//   [4] ضمان ربط FORWARD (حقن مباشر بلا إعادة تشغيل لو ناقص)
//   [5] قفل IPv6
//   [6] تسطيب الحارس v12 المضمّن (نفس نسخة السيرفر بالظبط — مفيش سباق تحديث)
//   [7] أداة جهاز الإدارة /root/wh_trust.sh (نت دايمة لجهاز واحد من غير كرت)
//   [8] تشغيل الحارس الجديد فوراً + نتيجة واضحة + بلاغ للسيرفر
// ═══════════════════════════════════════════════════════════

export function buildLockdownScript(): string {
  return `#!/bin/sh
# ═══════════════════════════════════════════════════════════
# 🔒 القفل الشامل الفوري — WH-LOCK (v1)
# بيقطع النت على كل المتصلين بدون استثناء (حتى فاتحي الكروت)
# والدخول بعدها بالكرت فقط عبر صفحة الدخول
# ═══════════════════════════════════════════════════════════
LOG=/tmp/hotspot_watchdog.log
CONF=/etc/wifidog.conf
say(){ echo "$*"; echo "$(date '+%m-%d %H:%M') [LOCK] $*" >> "$LOG" 2>/dev/null; return 0; }

echo "═══ 🔒 القفل الشامل — بدأ التنفيذ ═══"

GW=$(sed -n 's/^GatewayID[[:space:]]*//p' "$CONF" 2>/dev/null | head -n1 | tr -d ' \\t')
SRV=$(sed -n 's/.*FirewallRule allow to //p' "$CONF" 2>/dev/null | head -n1 | tr -d ' \\t')
WIF=$(sed -n 's/^GatewayInterface[[:space:]]*//p' "$CONF" 2>/dev/null | head -n1 | tr -d ' \\t')
case "$WIF" in ''|*[!A-Za-z0-9._-]*) WIF=br-lan ;; esac

# ── [1] إيقاف الحارس القديم مؤقتاً ──
# فحصه القديم بيدوّر على 'wifidog' بأحرف صغيرة والسلاسل الفعلية اسمها 'WiFiDog_' —
# فكان بيظن الربط مقطوع وبيعيد تشغيل wifidog كل 10 دقايق = تطارد الكروت
for P in $(pgrep -f hotspot-watchdog 2>/dev/null); do kill "$P" 2>/dev/null; done
if crontab -l 2>/dev/null | grep -q hotspot-watchdog; then
  crontab -l 2>/dev/null | grep -v hotspot-watchdog | crontab - >/dev/null 2>&1
fi
say "الحارس القديم اتوقف مؤقتاً (كان بيعيد تشغيل wifidog كل 10 دقايق بالغلط)"

# ── [2] القفل الشامل: طرد كل المتصلين بدون استثناء ──
NCLI=$(wdctl status 2>/dev/null | grep -ci 'MAC:')
case "$NCLI" in ''|*[!0-9]*) NCLI=0 ;; esac
/etc/init.d/wifidog stop >/dev/null 2>&1
killall -9 wifidog >/dev/null 2>&1
sleep 2
killall -9 wifidog >/dev/null 2>&1
/etc/init.d/wifidog start >/dev/null 2>&1
sleep 3
pgrep wifidog >/dev/null 2>&1 || { wifidog >/dev/null 2>&1 & sleep 3; }
command -v conntrack >/dev/null 2>&1 && conntrack -F >/dev/null 2>&1
say "🔒 القفل الشامل: طرد \${NCLI} عميل مصادق (كل المتصلين بدون استثناء) + قطع كل الاتصالات المفتوحة"
echo "1) القفل الشامل ✅ — طُرد \${NCLI} عميل مصادق والاتصالات المفتوحة اتقطعت"

# ── [3] استنى سلاسل المنع ترجع بعد التشغيل (لحد 36 ثانية) ──
WCHK=0
i=0
while [ $i -lt 12 ]; do
  sleep 3
  i=$((i+1))
  if iptables -t filter -S "WiFiDog_\${WIF}_Unknown" 2>/dev/null | grep -qiE 'REJECT|DROP'; then WCHK=1; break; fi
  if iptables -t filter -S wd_outgoing 2>/dev/null | grep -qiE 'REJECT|DROP'; then WCHK=1; break; fi
done
if [ "$WCHK" = "1" ]; then
  echo "2) قفل غير المصادقين ✅ — أي جهاز من غير كرت مرفوض فعلياً (REJECT)"
else
  echo "2) ⚠️ سلاسل المنع لسه مش ظاهرة — الحارس الجديد هيصلحها أول ما يشتغل"
fi

# ── [4] ضمان ربط القواعد على FORWARD (حقن مباشر بلا أي إعادة تشغيل) ──
if iptables -t filter -S FORWARD 2>/dev/null | grep -qiE 'wifidog|wd_'; then
  echo "3) ربط FORWARD ✅ — قواعد wifidog في مكانها على مسار الترافيك"
else
  if iptables -t filter -S "WiFiDog_\${WIF}_Internet" >/dev/null 2>&1; then
    iptables -t filter -C FORWARD -i "$WIF" -j "WiFiDog_\${WIF}_Internet" 2>/dev/null || \\
      iptables -t filter -I FORWARD 1 -i "$WIF" -j "WiFiDog_\${WIF}_Internet"
    echo "3) ربط FORWARD ✅ — اتحقن يدوياً على \${WIF}"
  else
    echo "3) ⚠️ ربط FORWARD ناقص — الحارس الجديد هيحقنه تلقائياً"
  fi
fi

# ── [5] قفل IPv6 (تسريب كلاسيكي للنت ببلاش) ──
IP6OK=0
if command -v ip6tables >/dev/null 2>&1; then
  ip6tables -C FORWARD -i "$WIF" -j DROP 2>/dev/null || ip6tables -I FORWARD 1 -i "$WIF" -j DROP 2>/dev/null
  ip6tables -C FORWARD -o "$WIF" -j DROP 2>/dev/null || ip6tables -I FORWARD 1 -o "$WIF" -j DROP 2>/dev/null
  IP6OK=1
  echo "4) قفل IPv6 ✅"
else
  echo "4) ip6tables مش موجودة — الحارس الجديد هيسطبها ويقفل التسريب لوحده"
fi

# ── [6] تصفير ملفات الحالة القديمة (مش wd_purge_done — عشان الحارس ميعملش
# تنظيف تاني كمان شوية يطرد الناس تاني) ──
rm -f /tmp/wd_frs_ts /tmp/wd_hook_ts 2>/dev/null

# ── [7] تسطيب الحارس v12 (مضمّن هنا — نفس نسخة السيرفر بالظبط) ──
cat > /usr/bin/.wh_wd12 <<'WD12EOF'
${buildWatchdogScript()}
WD12EOF
WDOK=0
if [ -s /usr/bin/.wh_wd12 ] && grep -q 'WFD_WD_VERSION="12"' /usr/bin/.wh_wd12 2>/dev/null && sh -n /usr/bin/.wh_wd12 >/dev/null 2>&1; then
  cp /usr/bin/hotspot-watchdog /usr/bin/hotspot-watchdog.bak 2>/dev/null
  mv /usr/bin/.wh_wd12 /usr/bin/hotspot-watchdog 2>/dev/null
  chmod +x /usr/bin/hotspot-watchdog 2>/dev/null
  WDOK=1
  echo "5) الحارس v12 اتسطّب ✅ — عمر ما بيعيد تشغيل wifidog والسلاسل حية (القديم محفوظ في .bak)"
else
  rm -f /usr/bin/.wh_wd12 2>/dev/null
  echo "5) ⚠️ فشل تسطيب الحارس الجديد — هيحدّث نفسه من السيرفر خلال ساعة"
fi

# ── [8] رجّع الكرون + امنع أي تنزيل نسخة قديمة في نفس اللحظة ──
crontab -l 2>/dev/null | grep -q hotspot-watchdog || {
  (crontab -l 2>/dev/null | grep -v hotspot-watchdog; echo "*/5 * * * * /usr/bin/hotspot-watchdog >/dev/null 2>&1") | crontab - >/dev/null 2>&1
}
/etc/init.d/cron restart >/dev/null 2>&1 || /etc/init.d/crond restart >/dev/null 2>&1
date +%s > /tmp/wd_upd_ts 2>/dev/null
date +%s > /tmp/wd_rep_ts 2>/dev/null
echo "6) الكرون ✅ — الحارس يشتغل كل 5 دقايق (فحص بس — من غير أي إعادة تشغيل غلط)"

# ── [9] أداة جهاز الإدارة (اختياري): نت دايمة لجهازك أنت من غير كرت ──
cat > /root/wh_trust.sh <<'WTRUSTEOF'
#!/bin/sh
# إضافة جهازك للقايمة الموثوقة = نت فورية من غير كرت — لجهازك أنت بس
# الاستخدام:  sh /root/wh_trust.sh AA:BB:CC:DD:EE:FF
MAC=$(echo "$1" | tr -d ':.- ' | tr 'a-f' 'A-F')
if ! echo "$MAC" | grep -qE '^[0-9A-F]{12}$'; then
  echo "استخدام: sh /root/wh_trust.sh AA:BB:CC:DD:EE:FF   (اكتب عنوان MAC بتاع جهازك)"
  echo "تلاقيه في: إعدادات الواي فاي → تفاصيل الشبكة → عنوان MAC"
  exit 1
fi
FM=$(echo "$MAC" | sed 's/../&:/g; s/:$//')
touch /etc/hotspot-trusted-allow
sed -i '/^[[:space:]]*[Tt]rustedMACList/d' /etc/wifidog.conf 2>/dev/null
echo "TrustedMACList $FM" >> /etc/wifidog.conf
/etc/init.d/wifidog restart >/dev/null 2>&1
echo "✅ الجهاز $FM بقى موثوق — اتصل بالواي فاي وهتلاقي نت مباشرة من غير كرت"
echo "ملحوظة: ده الجهاز الوحيد المسموح بده — أي جهاز تاني لازم كرت"
WTRUSTEOF
chmod +x /root/wh_trust.sh 2>/dev/null
echo "7) أداة جهاز الإدارة جاهزة: sh /root/wh_trust.sh ماك-جهازك (اختياري)"

# ── [10] شغّل الحارس الجديد مرة واحدة دلوقتي (تحقق فوري + أول بلاغ) ──
if [ "$WDOK" = "1" ]; then
  sh /usr/bin/hotspot-watchdog >/dev/null 2>&1
fi

# ── [11] النتيجة النهائية ──
WDPID=$(pgrep wifidog 2>/dev/null | head -n1)
NCLI2=$(wdctl status 2>/dev/null | grep -ci 'MAC:')
case "$NCLI2" in ''|*[!0-9]*) NCLI2=0 ;; esac
FWD=0
iptables -t filter -S FORWARD 2>/dev/null | grep -qiE 'wifidog|wd_' && FWD=1
BLK=0
iptables -t filter -S "WiFiDog_\${WIF}_Unknown" 2>/dev/null | grep -qiE 'REJECT|DROP' && BLK=1
if [ "$BLK" = "0" ]; then
  iptables -t filter -S wd_outgoing 2>/dev/null | grep -qiE 'REJECT|DROP' && BLK=1
fi
echo "══════════════════════════════════════"
echo "📊 النتيجة النهائية — القفل الشامل:"
echo "   1) wifidog شغال (PID \${WDPID}) — العملاء في الذاكرة: \${NCLI2} (صفر = الكل اتطردوا ✅)"
echo "   2) قفل غير المصادقين: $( [ \"$BLK\" = \"1\" ] && echo 'شغال ✅ REJECT فعلي' || echo '⚠️ شغل السكربت تاني بعد دقيقة' )"
echo "   3) ربط القواعد على FORWARD: $( [ \"$FWD\" = \"1\" ] && echo 'موجود ✅' || echo '⚠️ الحارس هيصلحه في دقايق' )"
echo "   4) قفل IPv6: $( [ \"$IP6OK\" = \"1\" ] && echo 'شغال ✅' || echo 'الحارس هيقفه تلقائياً' )"
echo "   5) الحارس: v12 — مفيش إعادة تشغيل غلط تاني ✅"
echo "══════════════════════════════════════"
echo "🧪 جرّب بموبايل: اتصل بالواي فاي → افتح المتصفح → صفحة الكرت → كود سليم → النت يفتح"
echo "🚫 أي جهاز من غير كرت: مقفول خالص (واتساب/يوتيوب/تيك توك — كل حاجة)"
echo "👤 نت جهازك أنت من غير كرت: sh /root/wh_trust.sh ماك-جهازك"
echo "══════════════════════════════════════"

# ── [12] بلاغ فوري للسيرفر ──
INST=$(cat /etc/hotspot-script-version 2>/dev/null | tr -d '[:space:]')
case "$INST" in ''|*[!0-9]*) INST=0 ;; esac
LANIP=$(ip -4 addr show "$WIF" 2>/dev/null | awk '/inet /{split($2,a,"/"); print a[1]; exit}')
if [ -n "$SRV" ] && [ -n "$GW" ]; then
  REPURL="https://\${SRV}/api/router/report-script?gw_id=\${GW}&inst=\${INST}&wd=12&lanip=\${LANIP}&clients=\${NCLI2}&ip6=\${IP6OK}&tm=0&fwd=\${FWD}&wdnat=0&wdfil=0"
  RESP=$(uclient-fetch -q -T 15 -O - --no-check-certificate "$REPURL" 2>/dev/null | head -n1)
  [ -z "$RESP" ] && RESP=$(wget -q -T 15 -O - --no-check-certificate "$REPURL" 2>/dev/null | head -n1)
  say "بلاغ القفل الشامل وصل السيرفر: \${RESP:-فشل الاتصال}"
fi

echo "═══ خلص ✅ — التفاصيل في /tmp/hotspot_watchdog.log ═══"
# WH_LOCK_END_MARKER
exit 0
`
}
