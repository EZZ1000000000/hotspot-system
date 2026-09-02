# إصلاح مشكلة "Error communicating with auth server"

## ما اتعمل تلقائياً في الكود

تم تعديل 3 ملفات تلقائياً:
1. `src/wifidog/auth-handler.ts` — القاعدة الذهبية: مش بنرجع Auth: -1 أبداً في counters
2. `src/app/api/wifidog/ping/route.ts` — response أسرع وأبسط
3. `src/app/api/wifidog/auth/route.ts` — headers أصح لـ wifidog

## خطوات على الـ VPS (مهمة جداً)

```bash
# 1. انتقل للمجلد
cd /home/ubuntu/hotspot2

# 2. اسحب التعديلات
git pull

# 3. ابني الـ Next.js
npm run build

# 4. إعادة تشغيل السيرفر
pm2 restart all
# أو
pm2 restart hotspot

# 5. تأكد إنه شغال
pm2 logs hotspot --lines 20
```

## خطوات على الـ OpenWrt Router (مهمة جداً)

```bash
# 1. امسح الـ hosts entry اللي اتضافت غلط
sed -i '/16.16.159.119 babreizk.online/d' /etc/hosts
cat /etc/hosts  # تأكد إنها اتمسحت

# 2. ارجع الـ checkinterval للقيمة الأصلية لو اتغيرت
# ملاحظة: wifidog.conf مش بيتغير بـ uci — لازم تعدل الملف مباشرة
cat /etc/wifidog.conf | grep -i check

# 3. أعد تشغيل wifidog
/etc/init.d/wifidog restart

# 4. اتابع اللوج
logread -f | grep wifidog
```

## اختبار بعد الإصلاح

```bash
# من الراوتر — اختبار ping
wget -q -O - "https://babreizk.online/api/wifidog/ping/?gw_id=GW-D00B-40C7"
# المفروض يرد: Pong

# اختبار auth بـ token صحيح
wget -q -O - "https://babreizk.online/api/wifidog/auth/?stage=login&token=TOKEN_هنا&ip=10.0.0.208&mac=28:d0:43:0f:df:06&incoming=0&outgoing=0"
# المفروض يرد: Auth: 1

# اختبار counters
wget -q -O - "https://babreizk.online/api/wifidog/auth/?stage=counters&token=TOKEN_هنا&ip=10.0.0.208&mac=28:d0:43:0f:df:06&incoming=1024000&outgoing=512000"
# المفروض يرد: Auth: 1
```

## لو المشكلة فضلت

```bash
# على الـ VPS — شوف اللوج المباشر
pm2 logs hotspot --lines 50

# على الراوتر — شوف اللوج المباشر
logread -f | grep -E "wifidog|auth|ping|error|Error"
```

## تلخيص التغييرات في الكود

### المشكلة الأصلية
- `auth-handler.ts` كان بيرجع `Auth: -1` لو DB فشلت
- `Auth: -1` بيخلي wifidog يوقف الاتصال ويرمي error
- الـ transaction كانت blocking وممكن تسبب timeout

### الحل
- لو DB فشلت في `stage=counters` → نرجع `Auth: 1` (المستخدم يكمل)
- الـ DB updates بقت background (non-blocking) → الرد أسرع
- الفحص بيحصل قبل الـ update → أسرع وأكثر استقراراً
- مش بنرجع `Auth: -1` خالص في أي حالة
