# 🆓 دليل النشر المجاني — بدون فيزا أو بطاقة ائتمان

> المشروع: نظام إدارة الهوتسبوت (Next.js 14 + Prisma/SQLite + wifidog)
> الحل المعتمد: **GitHub (مستودع الكود) + Render.com (تشغيل التطبيق)** — كله مجاني 100%

---

## 1) لماذا GitHub وحده لا يكفي؟ (إجابة صريحة)

| خدمة GitHub | تشغّل المشروع ده؟ | السبب |
|---|---|---|
| **GitHub Pages** | ❌ لا | يستضيف صفحات **ثابتة فقط** — لا يشغّل Node.js ولا API ولا قاعدة بيانات. المشروع فيه سيرفر كامل (wifidog/auth/DB) فمستحيل يعمل عليه |
| **GitHub Codespaces** | ⚠️ للتجربة فقط | بيئة تطوير تعطي ~60 ساعة/شهر، بتقف تلقائيًا، ورابط المنفذ يتغير — ليست استضافة حقيقية |
| **GitHub كمستودع كود** | ✅ هذا دوره الصحيح | GitHub يخزن الكود، وRender يسحب منه وينشر تلقائيًا مع كل تحديث (auto-deploy) |

**الخلاصة:** GitHub = مخزن الكود + مشغل النشر التلقائي. التشغيل الفعلي على Render.

## 2) لماذا ليس Hugging Face؟ (مؤكد بالتجربة الفعلية)

حاولنا الإنشاء بـ API الرسمي وكان الرد الحاسم:

```
HTTP 402 — "Static Spaces are free for everyone, but hosting Gradio and
Docker Spaces on free cpu-basic requires a PRO subscription"
```

يعني حساب HF المجاني يشغّل صفحات ثابتة فقط، وأي سيرفر حقيقي يتطلب اشتراك Pro بـ 9$/شهر.

## 3) مقارنة الاستضافات المجانية (بدون فيزا) — من بحث الإنترنت الفعلي

| المنصة | بدون فيزا؟ | تشغّل المشروع؟ | ملاحظات |
|---|---|---|---|
| **Render.com** ✅ المعتمد | ✅ نعم | ✅ Docker/Node كامل | تنام بعد 15 دقيقة بلا زيارات (قابل للحل بالكامل — انظر §6) |
| Koyeb | ✅ نعم | ✅ Docker | نسخة مجانية أضعف (0.1 vCPU / 512MB) |
| Vercel | ✅ نعم | ⚠️ بعد تعديلات | يحتاج تحويل قاعدة البيانات لـ Turso/Neon (Serverless لا يشغّل SQLite ملفات) |
| Railway | ⚠️ | ✅ | رصيد تجريبي ينتهي ثم يدفع |
| Fly.io / Oracle / AWS / GCP | ❌ تطلب بطاقة | — | مستبعدة حسب شرطك |
| Hugging Face Spaces | ✅ | ❌ بدون Pro | مؤكد بالتجربة أعلاه |
| Glitch / Cyclic / Deta | — | — | أوقفت الخدمة نهائيًا |

---

## 4) خطوات النشر على Render (مرة واحدة — ~10 دقائق)

### المتطلبات
1. حساب **GitHub** مجاني (بدون فيزا): https://github.com/signup
2. حساب **Render** مجاني (بدون فيزا): سجّل بنفس حساب GitHub من https://dashboard.render.com

### الخطوات
1. **ارفع الكود على GitHub** (أو ابعتلنا توكن GitHub ونرفعه عنك):
   - أنشئ مستودعًا جديدًا اسمه مثل `hotspot-system`
   - ثم:
     ```bash
     cd hotspot-system-main
     git remote add github https://github.com/USERNAME/hotspot-system.git
     git push -u github master:main
     ```
2. **في Render:** لوحة التحكم → **New +** → **Blueprint**
   - اختر مستودع `hotspot-system`
   - Render سيقرأ ملف `render.yaml` الجاهز تلقائيًا (Docker + health check + الإعدادات)
3. **املأ المتغيرات التي تظهر لك** (`sync: false` في render.yaml):
   | المتغير | القيمة |
   |---|---|
   | `SUPER_ADMIN_USERNAME` | `superadmin` |
   | `SUPER_ADMIN_PASSWORD` | كلمة سر قوية تختارها |
   | `SUPER_ADMIN_EMAIL` | بريدك |
   | `S3_BUCKET` | `gdnjd123/hotspot-backup` |
   | `S3_ACCESS_KEY_ID` | مفتاح S3 الخاص بك (HFAK...) |
   | `S3_SECRET_ACCESS_KEY` | المفتاح السري |
4. اضغط **Apply** — سيبني Docker وينشر (~5-8 دقائق)
5. الرابط النهائي سيكون مثل: `https://hotspot-system-xxxx.onrender.com`

> ✨ بدائل سريعة: يمكن أيضًا **New + → Web Service** واختيار المستودع — نفس النتيجة.

## 5) حماية البيانات من الضياع (مُنفذة جاهزة في الكود)

قرص الخطة المجانية مؤقت (يُمسح عند إعادة النشر)، لذلك الكود يحتوي الآن:

- **`scripts/s3-sync.js`** — نسخ/استعادة قاعدة البيانات عبر S3 (بدون أي مكتبات خارجية، توقيع SigV4)
- عند كل **تشغيل**: يستعيد آخر نسخة تلقائيًا (`restore`)
- كل **10 دقائق**: يرفع نسخة متسقة (VACUUM INTO) إلى `s3://gdnjd123/hotspot-backup/hotspot.db`
- لو لم تُضبط مفاتيح S3: يعمل عاديًا مع تجاهل المزامنة

## 6) منع النوم بعد 15 دقيقة (مُنفذ جاهز في الكود)

- **مرة واحدة على GitHub:** Settings → Secrets and variables → Actions → **Variables** → أضف:
  - الاسم: `RENDER_URL` — القيمة: رابط Render النهائي
- الـ workflow الجاهز `.github/workflows/keep-warm.yml` سيربط الخدمة كل 10 دقائق تلقائيًا
- إضافةً: راوترات wifidog الحقيقية ترسل ping كل بضع دقائق — فالخدمة عمليًا مستيقظة أثناء الاستخدام الفعلي

## 7) بعد النشر — تحقق سريع

```bash
curl https://YOUR-APP.onrender.com/api/health
# {"status":"ok","db":"up",...}
curl "https://YOUR-APP.onrender.com/api/wifidog/ping?gw_id=TEST"
# Pong
```

ثم افتح الموقع: لوحة السوبر أدمن `/superadmin` — لوحة الأدمن `/dashboard` — البورتال `/portal`

## 8) إعدادات الراوتر (OpenWrt/wifidog) بعد النشر

في `wifidog.conf` على الراوتر:

```
AuthServerHostname YOUR-APP.onrender.com
AuthServerPort 443
AuthServerPath /api/wifidog/
```
