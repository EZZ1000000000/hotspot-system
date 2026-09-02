# ══════════════════════════════════════════════════════════════════
#  DEPLOY_GUIDE.md — خطوات الرفع على git والتشغيل على السيرفر
# ══════════════════════════════════════════════════════════════════

## 📋 ملخص التغييرات في هذا الـ commit

1. **`src/app/portal/page.tsx`** — تحويل الصفحة لـ redirect فوري نحو HTML الخالص
2. **`next.config.js`** — إضافة redirect من `/portal` → `/api/portal/page`
3. **`deploy.sh`** — سكريبت deploy جاهز للسيرفر

---

## 🔁 خطوة 1: رفع على GitHub (من جهازك)

افتح CMD أو PowerShell في مجلد المشروع:

```powershell
cd "C:\Users\احمد\Documents\projects\h\hotspot-system\hs"

# إضافة الملفات المتغيرة
git add src/app/portal/page.tsx
git add next.config.js
git add deploy.sh
git add DEPLOY_GUIDE.md

# commit بوصف واضح
git commit -m "feat: portal page instant HTML redirect - no more Next.js bundle overhead"

# رفع على GitHub
git push origin main
```

---

## 🖥️ خطوة 2: على السيرفر (SSH)

```bash
# اتصل بالسيرفر
ssh -i "C:\Users\احمد\Documents\hotspot-key.pem" ubuntu@babreizk.online

# شغّل سكريبت الـ deploy
cd /home/ubuntu/hotspot2
bash deploy.sh
```

---

## ⚡ أو كل حاجة في أمر واحد (من SSH)

```bash
cd /home/ubuntu/hotspot2 && git pull && npm install --legacy-peer-deps && npx prisma db push --accept-data-loss && npm run build && pm2 restart hotspot && pm2 save
```

---

## 🧪 اختبار بعد الـ Deploy

```bash
# اختبار إن الـ portal بيرجع HTML فوري
curl -I "https://babreizk.online/portal?gw_id=TEST"
# المفروض تشوف: Location: /api/portal/page?gw_id=TEST

# اختبار الـ HTML مباشرة
curl "https://babreizk.online/api/portal/page?gw_id=YOUR_GW_ID" | head -20
```

---

## 🌐 الـ URLs بعد التغيير

| القديم | الجديد | السبب |
|--------|--------|-------|
| `/portal` | يعمل redirect 302 → `/api/portal/page` | أسرع بكتير |
| `/api/portal/page?gw_id=XXX` | **نفس الـ URL** — HTML مباشر | بدون Next.js overhead |

---

## 🔧 تعديل الـ HTML من الـ Super Admin

1. افتح `https://babreizk.online/superadmin`
2. تاب **"🌐 صفحة البورتال"**
3. اختار الجهاز من القائمة
4. عدّل الـ HTML واضغط **حفظ**
5. التغيير فوري — مفيش حاجة تبنيها تاني

---

## ❓ لو في مشكلة في البناء

```bash
# شوف logs الـ PM2
pm2 logs hotspot --lines 50

# لو المشكلة في الـ DB
cd /home/ubuntu/hotspot2
npx prisma db push

# reset كامل لو في مشكلة في node_modules
rm -rf node_modules .next
npm install --legacy-peer-deps
npm run build
pm2 restart hotspot
```
