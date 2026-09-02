# 🔥 Hotspot Management System - شرح كامل

## نظرة عامة
نظام إدارة هوتسبوت متكامل يعمل مع OpenWrt + wifidog
يتيح التحكم في الإنترنت عن طريق كروت شحن (vouchers)

---

## هيكل المستويات
```
Super Admin (أنت)
    └── Hotspot Admin (صاحب الكافيه/المطعم)
            ├── حد أقصى لعدد الأجهزة
            ├── حد أقصى لعدد الكروت
            └── Device (الراوتر OpenWrt)
                    └── Voucher (كارت الشحن)
                            └── Session (جلسة المستخدم)
```

---

## المسار الكامل لتدفق البيانات

```
1. مستخدم يتصل بـ WiFi
2. wifidog يحوله لـ: GET /api/wifidog/login?gw_address=...&gw_port=...&gw_id=...&ip=...&mac=...
3. السيرفر يحوله لـ: /portal (صفحة إدخال الكود)
4. المستخدم يدخل الكود
5. POST /api/portal/login → { code, mac, ip, gatewayId }
6. السيرفر يتحقق من الكود ويرجع token
7. المتصفح يروح لـ: http://192.168.1.1:2060/wifidog/auth?token=XXX
8. wifidog يسأل السيرفر: GET /api/wifidog/auth?stage=login&token=XXX
9. السيرفر يرد: "Auth: 1" → wifidog يفتح النت
10. كل دقيقة: GET /api/wifidog/auth?stage=counters&token=XXX&incoming=BYTES&outgoing=BYTES
11. السيرفر يحدث الاستهلاك ويفحص لو الكارت خلص
12. لو خلص: "Auth: 0" → wifidog يقطع النت
13. wifidog يحول المستخدم لـ: /api/wifidog/portal → /portal عشان يشحن كود جديد
```

---

## ملفات المشروع

```
hs/
├── prisma/
│   ├── schema.prisma       ← قاعدة البيانات (PostgreSQL)
│   └── seed.ts             ← إنشاء السوبر أدمن الأول
│
├── src/
│   ├── lib/
│   │   ├── prisma.ts       ← Prisma client
│   │   └── voucher.ts      ← توليد الكودات + فحص الاستهلاك
│   │
│   ├── wifidog/
│   │   ├── auth-handler.ts ← منطق التحقق + تحديث الاستهلاك
│   │   └── login-handler.ts← تفعيل الكارت + إنشاء الجلسة
│   │
│   └── app/
│       ├── portal/         ← صفحة إدخال الكود للمستخدم
│       ├── superadmin/     ← لوحة السوبر أدمن
│       ├── dashboard/      ← لوحة Hotspot Admin
│       └── api/
│           ├── wifidog/
│           │   ├── auth/   ← GET - التحقق من التوكن
│           │   ├── ping/   ← GET - Heartbeat
│           │   ├── login/  ← GET - Redirect للـ portal
│           │   └── portal/ ← GET - Redirect بعد انتهاء الجلسة
│           ├── portal/
│           │   └── login/  ← POST - تفعيل الكارت
│           ├── vouchers/
│           │   └── generate/← POST - توليد كروت
│           ├── admin/
│           │   ├── devices/ ← GET/POST - إدارة الأجهزة
│           │   └── sessions/← GET/DELETE - الجلسات الحالية
│           └── superadmin/
│               └── admins/ ← GET/POST/PATCH - إدارة الحسابات
│
└── configs/
    ├── wifidog.conf        ← إعداد wifidog على الراوتر
    └── speed-control.sh   ← script تحديد السرعة
```

---

## قاعدة البيانات

### جداول رئيسية:
| جدول | الوظيفة |
|------|---------|
| SuperAdmin | حساب المدير العام |
| HotspotAdmin | أصحاب الكافيهات (بتحدد لهم الحدود) |
| Device | الراوترات (لكل راوتر GatewayID فريد) |
| Voucher | كروت الشحن (DATA_ONLY/TIME_ONLY/BOTH) |
| Session | الجلسات النشطة (توكن + استهلاك) |

---

## API Endpoints

### wifidog (بيستخدمها الراوتر تلقائياً)
```
GET /api/wifidog/auth?stage=login&token=XXX
    → "Auth: 1" (مسموح) | "Auth: 0" (مرفوض)

GET /api/wifidog/auth?stage=counters&token=XXX&incoming=BYTES&outgoing=BYTES
    → "Auth: 1" (مازال شغال) | "Auth: 0" (انتهى الرصيد)

GET /api/wifidog/ping
    → "Pong" (السيرفر شغال)

GET /api/wifidog/login?gw_address=X&gw_port=X&gw_id=X&ip=X&mac=X
    → Redirect لـ /portal

GET /api/wifidog/portal
    → Redirect لـ /portal (بعد انتهاء الجلسة)
```

### Portal
```
POST /api/portal/login
Body: { code, mac, ip, gatewayId }
Response: { success: true, token: "XXX", voucher: { dataLimitMB, timeLimitMin, ... } }
         | { success: false, message: "الكود غير صحيح" }
```

### Admin
```
GET  /api/admin/devices?adminId=XXX       ← قائمة الأجهزة
POST /api/admin/devices                   ← إضافة جهاز
GET  /api/admin/sessions?deviceId=XXX    ← الجلسات النشطة
DELETE /api/admin/sessions { sessionId } ← قطع جلسة
POST /api/vouchers/generate               ← توليد كروت
```

### Super Admin
```
GET   /api/superadmin/admins             ← كل الحسابات
POST  /api/superadmin/admins             ← إنشاء حساب جديد
PATCH /api/superadmin/admins/update      ← تعديل الحدود
```

---

## إعداد OpenWrt

### 1. تثبيت wifidog
```bash
opkg update
opkg install wifidog
```

### 2. ملف الإعداد /etc/wifidog.conf
```
GatewayID TESTGW01          ← لازم يتطابق مع الداتابيز
ExternalInterface eth0.1    ← انترفيس الإنترنت
GatewayInterface br-lan     ← الشبكة الداخلية

AuthServer {
    Hostname 192.168.1.208  ← IP الكمبيوتر بتاعك
    HTTPPort 3000
    SSLAvailable no
    Path /api/wifidog/
}
```

### 3. تشغيل wifidog
```bash
/etc/init.d/wifidog start
/etc/init.d/wifidog enable  ← عشان يشتغل تلقائي مع الراوتر
```

### 4. تحديد السرعة (اختياري)
```bash
# ارفع الملف على الراوتر
scp configs/speed-control.sh root@192.168.1.1:/usr/bin/
ssh root@192.168.1.1 "chmod +x /usr/bin/speed-control.sh"

# تحديد سرعة لجهاز
speed-control.sh add AA:BB:CC:DD:EE:FF 5 br-lan  ← 5 Mbps
speed-control.sh remove AA:BB:CC:DD:EE:FF br-lan  ← إزالة القيد
```

---

## إعداد السيرفر (Windows)

### 1. متطلبات
- Node.js 18+
- PostgreSQL 14+
- npm

### 2. التشغيل الأول
```cmd
cd C:\Users\احمد\Documents\projects\h\hotspot-system\hs
copy .env.example .env.local
copy .env.local .env
npm install
npx prisma db push
npx tsx prisma/seed.ts
```

### 3. التشغيل اليومي
```cmd
cd C:\Users\احمد\Documents\projects\h\hotspot-system\hs
npm run dev
```
السيرفر بيشتغل على: http://localhost:3000

### 4. لو غير IP الكمبيوتر
```cmd
ipconfig
```
خد الـ IPv4 Address وحدّث wifidog.conf

---

## الصفحات

| الصفحة | الرابط | الوظيفة |
|--------|--------|---------|
| Captive Portal | /portal | المستخدم بيدخل الكود |
| Super Admin | /superadmin | إدارة كل الحسابات |
| Hotspot Admin | /dashboard | إدارة الجهاز والكروت |

### بيانات الدخول الافتراضية
- Super Admin: `superadmin` / `changeme123`

---

## إضافة بيانات تجريبية (psql)

```sql
-- شوف ID السوبر أدمن
SELECT id FROM "SuperAdmin";

-- أضف Hotspot Admin
INSERT INTO "HotspotAdmin" (id, username, password, email, name,
  "maxDevices", "maxVouchersTotal", "totalVouchersGenerated",
  "isActive", "superAdminId", "createdAt", "updatedAt")
VALUES ('admin1', 'admin', 'hashed', 'admin@cafe.com', 'كافيه تست',
  5, 1000, 0, true, 'ID_هنا', NOW(), NOW());

-- أضف Device
INSERT INTO "Device" (id, name, "gatewayId", "gatewayInterface",
  "externalInterface", "clientTimeout", "httpMaxConn",
  "isActive", "hotspotAdminId", "createdAt", "updatedAt")
VALUES ('dev1', 'راوتر تست', 'TESTGW01', 'br-lan', 'eth0.1',
  10, 253, true, 'admin1', NOW(), NOW());

-- أضف Voucher تجريبي (500MB / 30 دقيقة)
INSERT INTO "Voucher" (id, code, "packageType", "dataLimitMB",
  "timeLimitMin", "dataUsedMB", "timeUsedMin", status,
  "hotspotAdminId", "createdAt", "updatedAt")
VALUES ('v1', 'TEST-1234-ABCD-5678', 'BOTH', 500, 30, 0, 0,
  'UNUSED', 'admin1', NOW(), NOW());
```

---

## استكشاف الأخطاء

### السيرفر مش بيرد من الراوتر
```cmd
netsh advfirewall firewall add rule name="Hotspot" dir=in action=allow protocol=TCP localport=3000
```

### الداتابيز مش بتشتغل
```cmd
net start postgresql
```

### wifidog مش بيشتغل
```bash
# على الراوتر
wifidog -f -d 7  ← debug mode
cat /var/log/wifidog.log
```

### إعادة تعيين الجلسات
```sql
DELETE FROM "Session";
UPDATE "Voucher" SET status='UNUSED', "dataUsedMB"=0,
  "timeUsedMin"=0, "usedAt"=NULL, "deviceId"=NULL
WHERE id = 'v1';
```

---

## الخطوات الجاية

1. ✅ wifidog + Captive Portal (مكتمل)
2. ✅ التحقق من الكود + توليد Token (مكتمل)
3. ✅ عداد الميجابايت والوقت (مكتمل)
4. ⏳ تحديد السرعة (speed-control.sh جاهز - محتاج رفع على الراوتر)
5. ⏳ Super Admin Dashboard (واجهة كاملة)
6. ⏳ Hotspot Admin Dashboard (واجهة كاملة)
7. ⏳ صفحة طباعة الكروت
8. ⏳ رفع على VPS
