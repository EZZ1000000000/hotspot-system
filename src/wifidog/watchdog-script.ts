// ═══════════════════════════════════════════════════════════
// 🛡️ مولّد سكربت الحارس الذاتي v2 — hotspot-watchdog
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

export const WATCHDOG_VERSION = '3'

export function buildWatchdogScript(): string {
  return `#!/bin/sh
# 🛡️ الحارس الذاتي v3 (WFD_WD_VERSION=3) — شغال كل 5 دقايق من الكرون
# يصلح لوحده: uhttpd / wifidog / قاعدة الاعتراض / باك-إند iptables المعطوب
# وبيحدّث نفسه من السيرفر كل ساعة — أي إصلاح جديد بيوصل لكل الراوترات لوحده
# وبيبلّغ عن نسخة السكربت المركّبة كل ساعة — عشان اللوحة تعرف مين محدّث ومين لأ
WFD_WD_VERSION="3"
LOG=/tmp/hotspot_watchdog.log
CONF=/etc/wifidog.conf

wdlog(){
  echo "$(date '+%m-%d %H:%M') $*" >> "$LOG" 2>/dev/null
  L=$(wc -l < "$LOG" 2>/dev/null)
  case "$L" in ''|*[!0-9]*) L=0 ;; esac
  [ "$L" -gt 200 ] && { tail -n 80 "$LOG" > "$LOG.t" 2>/dev/null; mv "$LOG.t" "$LOG" 2>/dev/null; }
  return 0
}

# ── هوية الجهاز من wifidog.conf (نسخة واحدة للحارس على أي راوتر)
GW=$(sed -n 's/^GatewayID[[:space:]]*//p' "$CONF" 2>/dev/null | head -n1 | tr -d ' \\t')
SRV=$(sed -n 's/.*FirewallRule allow to //p' "$CONF" 2>/dev/null | head -n1 | tr -d ' \\t')

# ── حماية: سطر الكرون موجود دايماً (لو حد مسحه بالغلط يرجع لوحده)
crontab -l 2>/dev/null | grep -q hotspot-watchdog || {
  (crontab -l 2>/dev/null | grep -v hotspot-watchdog; echo "*/5 * * * * /usr/bin/hotspot-watchdog >/dev/null 2>&1") | crontab - >/dev/null 2>&1
}

# ── [1] الجسر المحلي (uhttpd)
if ! pgrep uhttpd >/dev/null 2>&1; then
  /etc/init.d/uhttpd start >/dev/null 2>&1
  wdlog "uhttpd كان واقف → اتشغّل"
fi

# ── [2] خدمة wifidog
if ! pgrep wifidog >/dev/null 2>&1; then
  /etc/init.d/wifidog restart >/dev/null 2>&1 || /etc/init.d/wifidog start >/dev/null 2>&1
  wdlog "wifidog كان واقف → اتشغّل"
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
    /etc/init.d/wifidog restart >/dev/null 2>&1
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
    /etc/init.d/wifidog restart >/dev/null 2>&1
  fi
fi

# ── [4] تحديث ذاتي من السيرفر كل ساعة — إصلاحات المستقبل بتنزل على الراوتر لوحدها
#  التحقق قبل الاستبدال: حجم سليم + سطر shebang + علامة النسخة + سطر الكرون + sh -n سليم
NOW=$(date +%s); TS=$(cat /tmp/wd_upd_ts 2>/dev/null); case "$TS" in ''|*[!0-9]*) TS=0 ;; esac
if [ $((NOW - TS)) -ge 3600 ] && [ -n "$SRV" ]; then
  date +%s > /tmp/wd_upd_ts
  # ── [4a] تقرير النسخ للسيرفر — اللوحة تعرف إن الراوتر شغال وأي نسخة عنده
  #  inst = نسخة سكربت التسطيب (من /etc/hotspot-script-version) — 0 = قديم/غير معروف
  INST=$(cat /etc/hotspot-script-version 2>/dev/null | tr -d '[:space:]')
  case "$INST" in ''|*[!0-9]*) INST=0 ;; esac
  uclient-fetch -q -T 15 -O /dev/null --no-check-certificate "https://\${SRV}/api/router/report-script?gw_id=\${GW}&inst=\${INST}&wd=\${WFD_WD_VERSION}" 2>/dev/null \
    || wget -q -T 15 -O /dev/null --no-check-certificate "https://\${SRV}/api/router/report-script?gw_id=\${GW}&inst=\${INST}&wd=\${WFD_WD_VERSION}" 2>/dev/null
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
