# 🚀 دليل النشر على Back4App Containers (مجاني بدون فيزا)

## ليه Back4App؟
- ✅ **مجاني فعلًا بدون كارت ائتمان** (خطة Free: 256MB RAM، 600 ساعة نشطة/شهر، حتى 5 مشاريع)
- ✅ بناء صورة Docker **على سيرفراتهم** — مش محتاج GitHub Actions
- ✅ ربط مباشر بمستودع GitHub + نشر تلقائي مع كل push

## الخطوات (3 دقائق)

### 1) افتح الداشبورد
- ادخل على **https://dashboard.back4app.com** بحسابك
- من القائمة اختر **Containers** (Container as a Service)

### 2) اربط GitHub
- اضغط **Create App** / **Import GitHub Repo**
- هتحوّلك لـ GitHub: ثبّت تطبيق **Back4App Containers**
- اختار **Only select repositories** وحدد: `EZZ1000000000/hotspot-system`
- اضغط **Install** ورجّع الداشبورد

### 3) إعدادات التطبيق
| الإعداد | القيمة |
|---|---|
| Repository | `EZZ1000000000/hotspot-system` |
| Branch | `main` |
| Dockerfile | `./Dockerfile` (بيتم اكتشافه تلقائيًا) |
| Port | `3000` (لو طلع منك الخانة) |

### 4) متغيرات البيئة (Environment Variables)
انسخها زي ما هي:

```
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD=Hot@81d918c3
SUPER_ADMIN_EMAIL=superadmin@hotspot.local
NEXTAUTH_SECRET=a29cb8fcff8dce3e4e5659ebc33dabb83c3fd3d753f7d22e
CRON_SECRET=460dc44535418487a4bf99d27b7e9559
```

> اختياري (للنسخ الاحتياطي التلقائي لقاعدة البيانات):
> `S3_ENDPOINT=https://s3.hf.co` + `S3_BUCKET=gdnjd123/hotspot-backup` + مفتاحي S3 بتوعك

### 5) اضغط Deploy ⚡
البناء بياخد 5-8 دقائق (بيبني Next.js جوه الصورة). أول ما يخلص هيديك رابط شغال.

## بعد النشر — اختبر فورًا
- `/api/health` → لازم يرجع `{"status":"ok","db":"up"}`
- سجّل دخول: `superadmin` / `Hot@81d918c3`
- راوتر wifidog: حط `AuthServerHostname = <الرابط بتاعك بدون https://>` و `Port = 443`

## ملاحظات مهمة
- **600 ساعة/شهر**: الراوترات بتبعت ping باستمرار فتخلّي التطبيق صاحي — لو خلصت الساعات هيتعلق لآخر الشهر لحد ما الساعة ترجع (حدود الخطة المجانية)
- **البيانات**: من غير مفاتيح S3، قاعدة البيانات بتتمسح مع كل إعادة نشر — اضبط S3 لو مهمة
- تعديل الكود يدفع تلقائيًا نشر جديد (auto-deploy من GitHub)
