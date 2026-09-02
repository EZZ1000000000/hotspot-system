#!/bin/sh
# =============================================
# speed-control.sh - تحديد السرعة لكل مستخدم
# يتحط على الراوتر في /usr/bin/speed-control.sh
# chmod +x /usr/bin/speed-control.sh
# =============================================
# الاستخدام:
#   speed-control.sh add <mac> <speed_mbps> <br-lan>
#   speed-control.sh remove <mac> <br-lan>
# =============================================

ACTION=$1
MAC=$2
SPEED_MBPS=$3
IFACE=${4:-br-lan}

# تحويل Mbps لـ kbps
SPEED_KBPS=$((SPEED_MBPS * 1024))

case "$ACTION" in
  add)
    # إضافة قيد السرعة لجهاز معين بالـ MAC
    # Download limit (incoming للعميل)
    tc qdisc add dev $IFACE root handle 1: htb default 10 2>/dev/null || true
    
    # احسب handle ID من الـ MAC (آخر byte)
    HANDLE=$(echo $MAC | awk -F: '{print $6}' | tr '[:lower:]' '[:upper:]')
    
    tc class add dev $IFACE parent 1: classid 1:$HANDLE htb rate ${SPEED_KBPS}kbit ceil ${SPEED_KBPS}kbit 2>/dev/null || true
    
    # ربط الـ MAC بالـ class
    tc filter add dev $IFACE parent 1: protocol ip u32 match ether dst $MAC flowid 1:$HANDLE 2>/dev/null || true
    
    echo "Speed limit ${SPEED_MBPS}Mbps applied to $MAC"
    ;;
    
  remove)
    # إزالة قيد السرعة لما تنتهي الجلسة
    HANDLE=$(echo $MAC | awk -F: '{print $6}' | tr '[:lower:]' '[:upper:]')
    tc filter del dev $IFACE parent 1: 2>/dev/null || true
    tc class del dev $IFACE parent 1: classid 1:$HANDLE 2>/dev/null || true
    echo "Speed limit removed from $MAC"
    ;;
    
  *)
    echo "Usage: $0 add <mac> <speed_mbps> [interface]"
    echo "       $0 remove <mac> [interface]"
    exit 1
    ;;
esac
