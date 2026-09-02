# 🗺️ ROADMAP — Hotspot System
> آخر تحديث: 2026-03-06
> المشروع الأساسي: hotspot-system-main  ← اشتغل هنا دايماً
> السيرفر: ubuntu@16.16.159.119 — /home/ubuntu/hotspot2
> Domain: babreizk.online

---

## ✅ المرحلة 1 — الأساس (الأولوية القصوى)

### [1.1] ✅ login-handler — نظيف وصح
- مفيش `entryMethod` في session.create
- الوقت بيحسب من `voucher.usedAt` (أول ضربة)
- الملف: `src/wifidog/login-handler.ts`

### [1.2] 🔄 portal/page.tsx — redirect لـ wifidog صح
- بعد نجاح login → redirect مباشر لـ `http://gw:port/wifidog/auth?token=TOKEN`
- wifidog يفتح النت ويرجع لـ session page
- الملف: `src/app/portal/page.tsx`
- **المشكلة الحالية:** `sessionUrl` بيستخدم IP مباشر — لازم يستخدم `window.location.origin`

### [1.3] ✅ auth-handler — شغال
- بيرد `Auth: 1` صح
- بيحدث الداتا في background

### [1.4] ⏳ generate/route.ts — INT4 protection
- إضافة `safeInt()` لمنع overflow
- الملف: `src/app/api/vouchers/generate/route.ts`

### [1.5] ⏳ codeMinLength = 8
- الملف: `src/app/portal/page.tsx` في DEFAULTS

---

## 🔄 المرحلة 2 — تحسينات

### [2.1] ⏳ نوع الجلسة في dashboard
- إظهار QR أو VOUCHER في الجلسات النشطة

### [2.2] ⏳ صفحة المبيعات (sales landing page)
- تسجيل حساب جديد للأدمن
- طلب شراء أجهزة/كروت
- فترة تجريبية: 1 جهاز + 30 كارت

### [2.3] ⏳ صفحة الحسابات
- جدول بيانات قابل للتعديل في السوبر أدمن

### [2.4] ⏳ SSH Keygen لكل جهاز
- مفتاح فريد لكل راوتر
- يظهر في السوبر أدمن

---

## 📋 حالة كل ملف

| الملف | الحالة |
|-------|--------|
| `src/wifidog/login-handler.ts` | ✅ نظيف |
| `src/wifidog/auth-handler.ts` | ✅ نظيف |
| `src/app/portal/page.tsx` | ⚠️ sessionUrl يحتاج تعديل |
| `src/app/api/vouchers/generate/route.ts` | ⚠️ INT4 |
| `src/app/api/admin/config/route.ts` | ✅ نظيف |
| `src/app/session/page.tsx` | ✅ نظيف |
| `src/app/dashboard/page.tsx` | ✅ نظيف |
| `src/app/superadmin/page.tsx` | ✅ نظيف |
| `prisma/schema.prisma` | ✅ نظيف |

---

## 🚀 أوامر Deploy

```bash
# 1. على جهازك — من مجلد hotspot-system-main
git add -A
git commit -m "وصف التغيير"
git push origin main

# 2. على السيرفر
ssh ubuntu@16.16.159.119
cd /home/ubuntu/hotspot2 && git pull origin main && npm run build && pm2 restart hotspot
```

## ⚠️ قواعد مهمة
1. اشتغل على `hotspot-system-main` بس — مش على `hs`
2. عدّل ملف واحد في كل مرة وجرب قبل ما تكمل
3. لو حصل خطأ في build — ابحث عن الـ field الزيادة أو الناقص من الـ schema
4. الـ schema لا يتغير إلا بـ migration على السيرفر
