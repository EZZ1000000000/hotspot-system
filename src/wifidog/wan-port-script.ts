// ═══════════════════════════════════════════════════════════════
// 🔀 أداة مدخل الإنترنت (LAN 1 ↔ WAN) — سكربتات مستقلة صغيرة
//
// المستخدم بيسأل عنها كتير: "الكابل راكب في LAN 1 وحايز أمر ثابت
// يحوّله يبقى هو مدخل الـ WAN — وأقدر أرجّع كل حاجة زي ما كانت".
//
// السكربتين دول:
//   1) buildLan1ToWanScript  → يحوّل منفذ LAN 1 يبقى هو مدخل WAN
//   2) buildWanRestoreScript → يرجّع إعدادات الشبكة الأصلية بالظبط
//
// بيغطوا 3 أنواع راوترات بالكشف التلقائي:
//   • DSA (OpenWrt 21.02+)   — المنافذ ظاهرة كواجهات lan1/lan2...
//   • swconfig (القديم)      — الفلانات في network.@switch_vlan
//   • منفذ واحد بدون سويتش   — eth0 نفسه يتحول WAN
//
// الأمان:
//   • أول تشغيل بيحفظ نسخة أصلية من network + firewall في
//     /etc/config/*.wfd-orig — والتكرار مبتلوّظش النسخة الأصلية
//   • الاسترجاع بيرجّع الملفات دي زي ما كانت حرفياً
//   • إعادة تشغيل الشبكة في الخلفية — اتصال SSH مايقطعش نص سكربت
//
// السكربتات دي عامة (مفيهاش بيانات جهاز) — تتخدم من أي سيرفر.
// ═══════════════════════════════════════════════════════════════

export const WAN_TOOL_VERSION = '1'

/** سكربت التحويل: LAN 1 → WAN */
export function buildLan1ToWanScript(): string {
  return `#!/bin/sh
# ═══════════════════════════════════════════════════════════════
#  🔀 أداة مدخل الإنترنت — HOTSPOT SYSTEM — WFD_WAN_TOOL v${WAN_TOOL_VERSION}
#  الوظيفة: تحويل منفذ LAN 1 يبقى هو مدخل الـ WAN (كابل النت في LAN 1)
#  بيدعم: DSA الحديث + سويتش swconfig القديم + الراوترات بمنفذ واحد
#  الأمان: بيحفظ نسخة أصلية من الإعدادات أول مرة بس — والرجوع
#          بسكربت الاسترجاع (wan-restore)
#  تلميح: تقدر تغير المنفذ بكتابة  PORT=lan2  قبل تشغيل السكربت
# ═══════════════════════════════════════════════════════════════

WFD_WAN_TOOL_VERSION="${WAN_TOOL_VERSION}"

say(){ echo "$*"; }

PORT_LAN="$PORT"
[ -z "$PORT_LAN" ] && PORT_LAN="lan1"

BK_NET="/etc/config/network.wfd-orig"
BK_FW="/etc/config/firewall.wfd-orig"

command -v uci >/dev/null 2>&1 || { say "❌ ده مش راوتر OpenWrt — الأداة دي مش هتشتغل هنا"; exit 1; }

# ── 0) نسخة أصلية من الإعدادات (أول مرة بس — التكرار مبيلوّظهاش)
if [ ! -f "$BK_NET" ]; then
  cp /etc/config/network "$BK_NET" 2>/dev/null && say "💾 حفظنا نسخة أصلية من إعدادات الشبكة — تقدر ترجع لها أي وقت بسكربت الاسترجاع"
fi
[ -f "$BK_FW" ] || cp /etc/config/firewall "$BK_FW" 2>/dev/null

# ── 1) كشف نوع الراوتر
MODE="plain"
if [ -e "/sys/class/net/$PORT_LAN" ]; then
  MODE="dsa"
elif uci -q get network.@switch_vlan[0] >/dev/null 2>&1; then
  MODE="sw"
fi

# ستايل الكونفيج: قديم (ifname) ولا جديد (device/br-lan)
NEWSTYLE=0
uci -q show network.@device[0] >/dev/null 2>&1 && NEWSTYLE=1

# واجهة WAN على منفذ معين — بنفس ستايل الكونفيج الموجود
set_wan_dev(){
  uci -q get network.wan >/dev/null 2>&1 || { uci set network.wan=interface; uci set network.wan.proto='dhcp'; }
  if [ "$NEWSTYLE" = "1" ]; then
    uci -q delete network.wan.ifname 2>/dev/null
    uci set network.wan.device="$1"
  else
    uci -q delete network.wan.device 2>/dev/null
    uci set network.wan.ifname="$1"
  fi
  uci -q delete network.wan6.ifname 2>/dev/null
  if [ "$NEWSTYLE" = "1" ]; then
    uci -q set network.wan6.device="$1" 2>/dev/null
  else
    uci -q set network.wan6.ifname="$1" 2>/dev/null
  fi
  return 0
}

# نتأكد إن شبكة wan جوه zone بتاعها في الجدار الناري
fix_wan_zone(){
  FOUND=0
  i=0
  while uci -q get firewall.@zone[$i] >/dev/null 2>&1; do
    if [ "$(uci -q get firewall.@zone[$i].name 2>/dev/null)" = "wan" ]; then
      FOUND=1
      uci -q del_list firewall.@zone[$i].network="wan" 2>/dev/null
      uci add_list firewall.@zone[$i].network="wan"
    fi
    i=$((i+1))
  done
  if [ "$FOUND" = "0" ]; then
    uci -q add firewall zone >/dev/null 2>&1 && {
      uci set firewall.@zone[-1].name='wan'
      uci set firewall.@zone[-1].input='REJECT'
      uci set firewall.@zone[-1].output='ACCEPT'
      uci set firewall.@zone[-1].forward='REJECT'
      uci set firewall.@zone[-1].masq='1'
      uci add_list firewall.@zone[-1].network='wan'
    }
  fi
  uci -q commit firewall
  return 0
}

# شيل منفذ من جسر الشبكة الداخلية (يدعم الجديد @device/br-lan والقديم lan.ifname)
port_out_of_lan(){
  i=0
  while uci -q show network.@device[$i] >/dev/null 2>&1; do
    [ "$(uci -q get network.@device[$i].name 2>/dev/null)" = "br-lan" ] && uci -q del_list network.@device[$i].ports="$1"
    i=$((i+1))
  done
  OLIF="$(uci -q get network.lan.ifname 2>/dev/null)"
  if printf '%s\\n' $OLIF | tr ' ' '\\n' | grep -qx "$1"; then
    uci set network.lan.ifname="$(printf '%s\\n' $OLIF | tr ' ' '\\n' | grep -vx "$1" | tr '\\n' ' ' | sed 's/ $//')"
  fi
  return 0
}

case "$MODE" in

dsa)
  if [ "$(uci -q get network.wan.wfd_lan1wan 2>/dev/null)" = "1" ]; then
    say "✅ التحويل متظبط من قبل — مفيش حاجة نعملها (للرجوع: سكربت الاسترجاع wan-restore)"
    exit 0
  fi
  say "🔎 الراوتر نوعه حديث (DSA) — بحوّل المنفذ $PORT_LAN يبقى هو مدخل الإنترنت"
  set_wan_dev "$PORT_LAN"
  uci set network.wan.wfd_lan1wan='1'
  port_out_of_lan "$PORT_LAN"
  fix_wan_zone
  uci commit network
  ;;

sw)
  if [ "$(uci -q get network.wan.wfd_lan1wan 2>/dev/null)" = "1" ]; then
    say "✅ التحويل متظبط من قبل — مفيش حاجة نعملها (للرجوع: سكربت الاسترجاع wan-restore)"
    exit 0
  fi
  say "🔎 الراوتر نوعه قديم (سويتش swconfig) — هحرك منفذ LAN 1 من فلان الشبكة الداخلية لفلان الإنترنت"
  LAN_IF="$(uci -q get network.lan.ifname 2>/dev/null)"
  WAN_IF="$(uci -q get network.wan.ifname 2>/dev/null)"
  LV="$(echo "$LAN_IF" | sed -n 's/.*\\.\\([0-9][0-9]*\\).*/\\1/p')"
  WV="$(echo "$WAN_IF" | sed -n 's/.*\\.\\([0-9][0-9]*\\).*/\\1/p')"
  [ -z "$LV" ] && LV=1
  if [ -z "$WV" ]; then
    say "⚠️  مفيش واجهة WAN أصلاً — هعمل واحدة جديدة على فلان إضافي"
    ETH="$(echo "$LAN_IF" | sed -n 's/^\\(eth[0-9][0-9]*\\)\\..*/\\1/p')"
    [ -z "$ETH" ] && ETH="eth0"
    WV=$((LV+1))
    uci set network.wan=interface
    uci set network.wan.proto='dhcp'
    uci set network.wan.ifname="$ETH.$WV"
    # منفذ الـ CPU: المنفذ المتاج عليه (t) في فلان الشبكة، أو 0 كتقدير
    CPU="$(uci -q get network.@switch_vlan[0].ports 2>/dev/null | tr ' ' '\\n' | grep 't$' | head -n1 | tr -d 't')"
    [ -z "$CPU" ] && CPU="0"
    uci add network switch_vlan
    uci set network.@switch_vlan[-1].device="$(uci -q get network.@switch[0].name 2>/dev/null || echo switch0)"
    uci set network.@switch_vlan[-1].vlan="$WV"
    uci set network.@switch_vlan[-1].ports="$CPU"
    uci commit network
  fi
  # دوّر على سيكشنات الفلانات
  i=0; LSEC=""; WSEC=""
  while uci -q get network.@switch_vlan[$i] >/dev/null 2>&1; do
    V="$(uci -q get network.@switch_vlan[$i].vlan 2>/dev/null)"
    [ "$V" = "$LV" ] && LSEC="$i"
    [ "$V" = "$WV" ] && WSEC="$i"
    i=$((i+1))
  done
  if [ -z "$LSEC" ] || [ -z "$WSEC" ]; then
    say "❌ مش لاقي VLANات الشبكة في الكونفيج — انقل الكابل لمنفذ WAN وشغّل سكربت التسطيب العادي"
    exit 1
  fi
  LP="$(uci -q get network.@switch_vlan[$LSEC].ports 2>/dev/null)"
  WP="$(uci -q get network.@switch_vlan[$WSEC].ports 2>/dev/null)"
  # منفذ الـ CPU = المنفذ المشترك بين فلان الشبكة الداخلية وفلان الإنترنت
  CPU=""
  for p in $LP; do
    pp="$(echo "$p" | tr -d 't')"
    for q in $WP; do
      [ "$pp" = "$(echo "$q" | tr -d 't')" ] && CPU="$pp"
    done
  done
  [ -z "$CPU" ] && CPU="$(echo $WP | awk '{print $1}')"
  # أول منفذ فعلي في فلان الشبكة الداخلية = منفذ LAN 1
  L1=""
  for p in $LP; do
    pp="$(echo "$p" | tr -d 't')"
    [ "$pp" = "$CPU" ] && continue
    [ -z "$L1" ] && L1="$pp"
  done
  if [ -z "$L1" ]; then
    say "❌ مفيش منافذ LAN في فلان الشبكة الداخلية — الكونفيج شكله مختلف، راجع الدعم"
    exit 1
  fi
  # لو المنفذ متحول من قبل — مفيش حاجة نعملها
  ALREADY=0
  for q in $WP; do [ "$(echo "$q" | tr -d 't')" = "$L1" ] && ALREADY=1; done
  if [ "$ALREADY" = "1" ]; then
    say "✅ منفذ LAN 1 (سويتش بورت $L1) متحول لـ WAN من قبل — مفيش حاجة نعملها"
    exit 0
  fi
  N=""
  for p in $LP; do
    pp="$(echo "$p" | tr -d 't')"
    [ "$pp" = "$L1" ] && continue
    N="$N $p"
  done
  uci set network.@switch_vlan[$LSEC].ports="$(echo $N)"
  uci set network.@switch_vlan[$WSEC].ports="$WP $L1"
  uci set network.wan.wfd_lan1wan='1'
  uci commit network
  say "🔀 السويتش بورت $L1 (اللي هو LAN 1) بقى في فلان الإنترنت (vlan $WV)"
  ;;

plain)
  if [ "$(uci -q get network.wan.wfd_lan1wan 2>/dev/null)" = "1" ]; then
    say "✅ التحويل متظبط من قبل — مفيش حاجة نعملها (للرجوع: سكربت الاسترجاع wan-restore)"
    exit 0
  fi
  say "🔎 الراوتر منفذ واحد بدون سويتش — هخلي المنفذ الوحيد (eth0) يبقى هو مدخل الإنترنت"
  say "   ⚠️  بعد كده هتدخل على الراوتر عن طريق الواي فاي بس"
  set_wan_dev "eth0"
  uci set network.wan.wfd_lan1wan='1'
  port_out_of_lan "eth0"
  fix_wan_zone
  uci commit network
  ;;

*)
  say "❌ مش قادر أحدد نوع الراوتر — انقل الكابل لمنفذ WAN وشغّل سكربت التسطيب العادي"
  exit 1
  ;;
esac

say "⚙️  جاري تطبيق الإعدادات وإعادة تشغيل الشبكة في الخلفية..."
( sleep 2
  /etc/init.d/network restart >/dev/null 2>&1
  sleep 5
  /etc/init.d/wifidog restart >/dev/null 2>&1
) >/dev/null 2>&1 &

echo ""
say "══════════════════════════════════════════"
say "✅ تم! كابل النت بقى شغال على مدخل $PORT_LAN"
say "   → استنى حوالي 30 ثانية والإنترنت هيرجع يشتغل"
say "   → لو كنت داخل بكيبل على الراوتر الاتصال هيفصل"
say "     (المنفذ بقى WAN) — ادخل عن طريق الواي فاي"
say "   → الرجوع زي الأول: شغّل سكربت الاسترجاع wan-restore"
say "══════════════════════════════════════════"
exit 0
`
}

/** سكربت الاسترجاع: إرجاع إعدادات الشبكة الأصلية (قبل التحويل) */
export function buildWanRestoreScript(): string {
  return `#!/bin/sh
# ═══════════════════════════════════════════════════════════════
#  ↩️  استرجاع إعدادات الشبكة الأصلية — HOTSPOT SYSTEM — WFD_WAN_TOOL v${WAN_TOOL_VERSION}
#  بيرجّع الراوتر لحالته بالظبط قبل أداة تحويل LAN 1 → WAN
#  (مدخل WAN الأساسي بيرجع هو مدخل الإنترنت، والمنافذ ترجع للشبكة الداخلية)
# ═══════════════════════════════════════════════════════════════

WFD_WAN_TOOL_VERSION="${WAN_TOOL_VERSION}"

BK_NET="/etc/config/network.wfd-orig"
BK_FW="/etc/config/firewall.wfd-orig"

if [ ! -f "$BK_NET" ]; then
  echo "❌ مفيش نسخة أصلية محفوظة على الراوتر ده — يعني أداة التحويل متشغلتش هنا قبل كده"
  echo "   → لو عايز ترجع مدخل WAN الأساسي: وصّل كابل النت في منفذ WAN وشغّل سكربت التسطيب"
  exit 1
fi

echo "↩️  بيرجّع إعدادات الشبكة الأصلية (مدخل WAN الأساسي)..."
cp "$BK_NET" /etc/config/network
[ -f "$BK_FW" ] && cp "$BK_FW" /etc/config/firewall

( sleep 2
  /etc/init.d/network restart >/dev/null 2>&1
  sleep 5
  /etc/init.d/wifidog restart >/dev/null 2>&1
) >/dev/null 2>&1 &

echo ""
echo "══════════════════════════════════════════"
echo "✅ تم الاسترجاع! الراوتر رجع زي ما كان بالظبط"
echo "   → وصّل كابل النت في منفذ WAN الأساسي تاني"
echo "   → استنى حوالي 30 ثانية والشبكة هتشتغل"
echo "   → لو كنت داخل بكيبل على الراوتر الاتصال هيفصل لحظة"
echo "══════════════════════════════════════════"
exit 0
`
}
