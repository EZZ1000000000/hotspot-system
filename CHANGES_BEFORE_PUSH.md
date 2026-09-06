# سجل التغييرات — قبل الرفع
**آخر تحديث:** 7 مارس 2026  
**الحالة:** لم يُرفع بعد ⏳

---

## التغيير ١ — redirect بعد login في البورتال

### الملف
`src/app/portal/page.tsx`

### اللي اتغير
سطر واحد فقط في دالة `doLogin` — الـ URL اللي بنبعته لـ wifidog بعد نجاح الـ login.

**قبل:**
```js
const wifidogUrl = `http://${gw}:${port}/wifidog/auth?token=${token}`
```
**بعد:**
```js
const wifidogUrl = `http://${gw}:${port}/wifidog/auth?token=${token}&url=${encodeURIComponent(sessionUrl)}`
```

### لو عايز ترجع
احذف `&url=${encodeURIComponent(sessionUrl)}` من السطر ده بس.

### خطورة التغيير
🟡 منخفضة — بيأثر بس على الـ redirect بعد فتح النت.

---

## التغيير ٢ — منطق الوقت في auth-handler

### الملف
`src/wifidog/auth-handler.ts`

### اللي اتغير
في `stage=login` — أضفنا فحص انتهاء الوقت/الداتا لما المستخدم يرجع بعد غياب.

### السلوك المطلوب
```
كارت ساعتين، فتح الساعة 12:00
  ↓ المستخدم خرج الساعة 1:00
  ↓ الساعتين خلصوا الساعة 2:00 وهو برة
  ↓ حاول يرجع الساعة 2:30  → Auth: 0 ❌ (خلص الوقت)

كارت ساعتين + داتا، الداتا خلصت الساعة 1:30
  ↓ المستخدم خرج بعدها
  ↓ حاول يرجع بأي وقت     → Auth: 0 ❌ (خلصت الداتا)

مستخدم موجود طول الوقت
  ↓ wifidog بيبعت counters كل دقيقة
  ↓ stage=counters يقفل عند 2:00  ✅ (كان شغال قبل)
```

### لو عايز ترجع
في `stage=login` بـ `auth-handler.ts`، ارجع لـ:
```ts
const session = await prisma.session.findUnique({ where: { token } })
if (!session) return 'Auth: 0'
if (session.status === 'ACTIVE') {
  prisma.session.update({ where: { token }, data: { lastPingAt: new Date() } }).catch(() => {})
  return 'Auth: 1'
}
if (session.status === 'ENDED') return 'Auth: 0'
return 'Auth: 0'
```

### خطورة التغيير
🟡 منخفضة-متوسطة — بيأثر فقط على حالة رجوع المستخدم بعد الغياب.

---

## التغيير ٣ — SSH Reverse Tunnel في سكريبت التثبيت

### الملف
`src/app/api/admin/config/route.ts`

### اللي اتغير
الدالة `buildScript()` — أضفنا قسم كامل للـ SSH Reverse Tunnel.

**الجديد في السكريبت المُولَّد:**
1. يولد SSH keypair على الراوتر (`/etc/ssh/hotspot_rsa`)
2. يطبع الـ Public Key عشان تضيفه على السيرفر
3. يعمل سكريبت `/usr/bin/hotspot-tunnel` للتحكم في الـ tunnel
4. يضيف cron job يشيك كل دقيقتين ويعيد تشغيل الـ tunnel لو وقع

**الدخول للراوتر من أي مكان:**
```bash
ssh -J ubuntu@babreizk.online -p [tunnelPort] root@localhost
```

### لو عايز ترجع
الـ tunnel بس بيتفعل لو `tunnelPort` محدد في إعدادات الجهاز.
لو `tunnelPort = 0` أو فاضي → السكريبت بيتجاهل الـ tunnel تماماً.

### خطورة التغيير
🟢 منخفضة جداً — ما فيش تأثير على أجهزة موجودة.

---

## التغيير ٤ — شيتس الحسابات تتحفظ على السيرفر

### الملفات
- `src/app/superadmin/page.tsx`
- `src/app/api/superadmin/sheets/route.ts` ← جديد
- `prisma/schema.prisma` ← إضافة `KeyValueStore`

### اللي اتغير
البيانات بتتحفظ في DB على السيرفر + localStorage كـ backup.

### لو عايز ترجع
**١.** ارجع دالة `save()` لـ localStorage فقط
**٢.** ارجع الـ `useState` للـ lazy initializer القديم
**٣.** امسح `useEffect` الـ fetch
**٤.** امسح `src/app/api/superadmin/sheets/route.ts`
**٥.** امسح model `KeyValueStore` من schema ثم `npx prisma migrate dev`

### خطورة التغيير
🟢 منخفضة — fallback على localStorage موجود.

---

## التغيير ٥ — حد أدنى الكود في البورتال: 8 → 6

### الملفات
- `src/app/portal/page.tsx`
- `src/app/api/portal/settings/route.ts`

### اللي اتغير
```
قبل: codeMinLength = 8,  codeMaxLength = 19
بعد: codeMinLength = 6,  codeMaxLength = 100
```

لماذا 100؟ — لأن الأكواد من السيستم التاني ممكن تكون بأي طول.
البورتال بيقبل أي كود من 6 حروف للأعلى بدون حد عملي.

### لو عايز ترجع
في الملفين الاتنين:
```
codeMinLength: 6  → 8
codeMaxLength: 100 → 19
```

### خطورة التغيير
🟢 منخفضة جداً — بس بيوسّع نطاق القبول.

---

## التغيير ٦ — استيراد كروت من CSV (جديد تماماً)

### الملفات
- `src/app/api/superadmin/import-vouchers/route.ts` ← جديد
- `src/app/superadmin/page.tsx` ← إضافة `ImportTab` + تاب جديد

### اللي اتغير
تاب جديد "📥 استيراد CSV" في السوبر أدمن.

**الميزات:**
- رفع ملف CSV أو الصق نص مباشرة
- اختيار الأدمن والجهاز اللي هيتضافلهم الكروت
- إعدادات باقة افتراضية (داتا/وقت/نوع)
- معاينة أول 5 أكواد قبل الاستيراد
- الأكواد المكررة بتتخطى تلقائياً بدون error
- دعم CSV بعمود واحد أو متعدد

**صيغة CSV المدعومة:**
```csv
code
ABC123
XYZ789
```
أو متقدمة:
```csv
code,dataLimitMB,timeLimitMin,packageType
ABC123,1024,120,BOTH
XYZ789,512,60,DATA_ONLY
```

### لو عايز ترجع
**١.** امسح ملف `src/app/api/superadmin/import-vouchers/route.ts`
**٢.** في `superadmin/page.tsx`:
  - امسح `{ key:'import', icon:'📥', label:'استيراد CSV' }` من مصفوفة `TABS`
  - امسح `function ImportTab(...)` بالكامل
  - امسح السطر `{tab==='import' && <ImportTab sa={sa}/>}`

### خطورة التغيير
🟢 منخفضة جداً — إضافة جديدة لا تؤثر على أي شيء موجود.

---

## أوامر الرفع

```bash
# ── محلياً ──────────────────────────────────────────────────────
git add -A
git commit -m "feat: portal min 6 chars + CSV import + time logic + SSH tunnel + sheets DB"
git pull origin main --rebase
git push origin main

# ── على السيرفر ─────────────────────────────────────────────────
cd /home/ubuntu/hotspot2
git pull origin main
npx prisma db push          # ← بدل migrate dev (مش محتاج صلاحية shadow DB)
npm run build
pm2 restart hotspot
```

> **ملاحظة:** `prisma db push` بيعمل نفس الشغل بدون ما يحتاج صلاحية إنشاء shadow database على السيرفر.

---

## لو حبيت ترجع كل حاجة دفعة واحدة

```bash
# شوف الـ commits الأخيرة
git log --oneline -5

# عكس آخر commit (آمن — بيعمل commit جديد بالعكس)
git revert HEAD
npm run build && pm2 restart hotspot

# أو ارجع لـ commit معين (خطر — بيمسح التغييرات نهائياً)
git reset --hard [COMMIT_HASH]
npm run build && pm2 restart hotspot
```

---

## ملخص سريع للتغييرات الـ ٦

| # | الملف | التغيير | خطورة | الرجوع |
|---|-------|---------|-------|--------|
| 1 | `portal/page.tsx` | `&url=` في wifidog redirect | 🟡 | احذف `&url=...` من سطر واحد |
| 2 | `auth-handler.ts` | فحص الوقت في stage=login | 🟡 | ارجع للكود البسيط القديم |
| 3 | `api/admin/config/route.ts` | SSH tunnel في السكريبت | 🟢 | tunnelPort=0 يشيله تلقائي |
| 4 | `superadmin/page.tsx` + جديد | شيتس تتحفظ في DB | 🟢 | ارجع لـ localStorage فقط |
| 5 | `portal/page.tsx` + `settings/route.ts` | min 6, max 100 حرف | 🟢 | رجّع الأرقام القديمة |
| 6 | `import-vouchers/route.ts` + `superadmin` | استيراد CSV جديد | 🟢 | امسح الملف والـ component |

---

## التغيير ٧ — الحارس الذاتي v2: يصلح باك-إند iptables لوحده + تحديث ذاتي من السيرفر (7 مارس 2026)

### المشكلة اللي بيحلها
راجع لوكشن (KT-KM08 — كيرنل مخصص بعد فورمات): باك-إند nft في iptables بيفشل مع امتدادات
القواعد (REDIRECT/REJECT/MASQUERADE) → wifidog مش بيسجل قاعدة الاعتراض → النت بيفتح
من غير صفحة دخول. الحارس القديم كان بيعيد تشغيل wifidog بس — مش بيعرف يصلح الباك-إند نفسه.

### الملفات
- `src/wifidog/watchdog-script.ts` — **جديد**: المولّد الوحيد للحارس v2 (نسخة واحدة لكل الراوترات)
- `src/app/api/router/watchdog/route.ts` — **جديد**: بيخدم نص الحارس (مصدر التحديث الذاتي)
- `src/wifidog/install-script.ts` — الحارس القديم (14 سطر) اتبدل بالنص المولّد + الطبيب بقى يعالج الباك-إند

### قدرات الحارس v2 (كل 5 دقايق)
1. uhttpd/wifidog واقفين → تشغيل (زي الأول)
2. iptables مش متسطبة → إصلاح سجل opkg (إدخال kernel الناقص بعد الفورمات) + تسطيب
3. امتدادات nft معطوبة → تحميل الموديولات + تسطيب `iptables-zz-legacy` + تبديل الروابط
   لـ legacy + إعادة تشغيل firewall+wifidog (rate-limited كل 30 دقيقة)
4. قاعدة 2060 ناقصة → فحص الباك-إند → إصلاح → تحقق
5. **تحديث ذاتي كل ساعة**: بيجيب نسخته من `/api/router/watchdog` ويقارن — لو مختلفة
   يستبدل نفسه بعد تحقق صارم (shebang + علامة نسخة + sh -n + حجم) مع نسخة احتياطية
   `.bak` واستبدال ذري. يعني أي إصلاح مستقبلي بيوصل لكل الراوترات لوحده خلال ساعة.

### خطورة التغيير
🟢 منخفضة — الحارس مش بيلمس أي إعداد شغال؛ كل عمليات الإصلاح مقيدة ومشروطة بفشل فعلي،
والتحديث الذاتي مرفوض تلقائياً لأي محتوى مش متحقق من سلامته.

### الرجوع
```bash
git revert HEAD   # أو استرجع /usr/bin/hotspot-watchdog.bak على الراوتر
```

### ملخص الملفات المتغيرة في التغيير ٧
| الملف | نوع | الغرض |
|---|---|---|
| `src/wifidog/watchdog-script.ts` | جديد | مولّد الحارس v2 (المصدر الوحيد) |
| `src/app/api/router/watchdog/route.ts` | جديد | نقطة التحديث الذاتي للراوترات |
| `src/wifidog/install-script.ts` | تعديل | تضمين الحارس v2 + طبيب يعالج الباك-إند |

---

## التغيير ٨ — السكربت من السستم + إشعار "السكربت اتغير" + تحكم طباعة الكروت

**التاريخ:** 2026-09-06

### الطلب
1. «مش عايز الكود منك — عايزه يطلع من السستم: أدمن يدخل SSH وينسخ السكربت ويشغّله على الأكسز ويشتغل»
2. «لو أي وقت محتاج يتغير الاسكربت — يقولي انه اتغير» (إشعار في اللوحة)
3. «في صفحة توليد كروت: تحكم في عدد الأعمدة (لحد 8) + طول وعرض الكارت»
4. «تحكم في عدد أرقام الكرت»

### ما تم عمله

#### 1+2) السكربت من السستم + تتبع النسخ
- `src/wifidog/script-meta.ts` — **جديد**: `INSTALL_SCRIPT_VERSION='3'` + تاريخ آخر تعديل + ملخص التغييرات — المصدر الوحيد للرقم
- `src/app/api/router/report-script/route.ts` — **جديد**: الراوتر بيبلّغ عن نسخته (`?gw_id=&inst=&wd=`) — التخزين في **KeyValueStore** (بدون أي تعديل schema → يشتغل على الـ 4 deployments فوراً بدون db push)
- `src/wifidog/install-script.ts` (v3): في آخر السكربت يكتب `/etc/hotspot-script-version` ويبعت النسخة للسيرفر فوراً — لو السكربت وقف قبلها، الراوتر يفضل مصنّف «قديم» (مقصود)
- `src/wifidog/watchdog-script.ts` (**v3**): بيبلّغ عن نسخة السكربت + نسخة الحارس كل ساعة (داخل بوابة التحديث الذاتي) — الراوترات القديمة (v2) هتترقّى للحارس v3 **تلقائياً** خلال ساعة من الـ deploy وتبدأ التقارير بدون لصق أي حاجة
- `src/app/api/admin/devices/route.ts` + `src/app/api/setup/fleet/route.ts`: بيدمجوا `scriptReport` في كل جهاز
- **اللوحة (dashboard)**: بانر أصفر «⚠️ السكربت اتغيّر» في تاب الأجهزة وتاب الإعداد لو فيه أي راوتر نسخته أقدم + شارة على كل جهاز: 🛡️ «سكربت v3 محدّث» / ⚠️ «سكربت v2 قديم» / ⚠️ «محتاج السكربت الجديد»
- **صفحة الإعداد (setup)**: شارة نسخة على كل كارت جهاز + بانر النسخة الرسمية

> آلية «السكربت اتغير» كاملة: عدّل install-script → زوّد `INSTALL_SCRIPT_VERSION` → ارفع الكود → أول ما الراوترات تبلّغ عن نسخ أقدم، البانر يظهر في اللوحة بيقول مين محتاج التحديث بالاسم.

#### 3) تحكم طباعة الكروت
- `src/app/print/page.tsx`: الأعمدة **1→8** (كانت 4) + أزرار سريعة + **مقاس الكارت بالمليمتر** (عرض × طول، صفر = تلقائي) مع إعدادات جاهزة (كارت بنكي 54×86 / مستطيل صغير 50×30 / بوكر 63.5×88) — المقاس مطبّق في المعاينة وفي نافذة الطباعة (CSS `!important` فوق الـ inline)
- `src/app/print-qr/page.tsx`: نفس التحكم (أعمدة 1→8 كانت 3 + مقاس بالمم) في المعاينة ومنطقة الطباعة

#### 4) عدد أرقام الكرت
- الداشبورد (توليد كروت): سلايدر الكود بقى **خطوة 1** (كانت 4) + خانة رقم مباشرة (4–32) + توضيح إن «أرقام فقط» = كل الكود أرقام

### خطورة التغيير
🟢 منخفضة — مفيش تعديل schema، مفيش تغيير في منطق التفعيل؛ الحارس v3 بيضيف تقرير نسخة فقط، وأي فشل في التقرير مُتجاهَل بأمان (الراوتر يرجّع 200 OK دايماً).

### الاختبارات
- 28/28 اختبار توليد: sh -n سليم للحارس + 3 سيناريوهات تثبيت، الحارس المضمّن مطابق byte-identical، منطق قراءة النسخة صحيح (marker موجود/ناقص)
- `tsc --noEmit` نظيف بالكامل
- تشغيل فعلي: /dashboard /print /print-qr /setup كلها 200 + `/api/router/watchdog?version=1` → `{"version":"3"}` + report-script → OK

### الرجوع
```bash
git revert <commit>
```
