---
title: HotSpot Manager
emoji: 📡
colorFrom: blue
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# Hotspot Management System
## نظام ادارة الهوتسبوت مع OpenWrt + wifidog

## هيكل المستويات
Super Admin (انت)
  -> Hotspot Admin (صاحب الكافيه)
       -> maxDevices: عدد الاجهزة المسموحة
       -> maxVouchersTotal: عدد الكروت الاجمالي
       -> Device (الراوتر)
            -> Voucher -> Session

## خطوات التشغيل

### 1. إعداد قاعدة البيانات
cp .env.example .env.local
npm install
npx prisma db push
npx ts-node prisma/seed.ts

### 2. تشغيل السيرفر
npm run dev
# يشتغل على http://localhost:3000

### 3. OpenWrt Setup
opkg update && opkg install wifidog
cp configs/wifidog.conf /etc/wifidog.conf
# عدّل: GATEWAY_ID_HERE و YOUR_SERVER_IP
/etc/init.d/wifidog start

## API Endpoints

wifidog (بيستخدمها OpenWrt تلقائياً):
  GET  /api/wifidog/auth  - التحقق من التوكن وتحديث الاستهلاك
  GET  /api/wifidog/ping  - Heartbeat

Portal:
  POST /api/portal/login  - تفعيل الكارت والحصول على توكن

Admin:
  GET/POST   /api/admin/devices
  GET/DELETE /api/admin/sessions
  POST       /api/vouchers/generate

Super Admin:
  GET/POST  /api/superadmin/admins
  PATCH     /api/superadmin/admins/update

## تدفق العمل
1. مستخدم يتصل بالـ WiFi
2. wifidog يحوله لـ Captive Portal
3. المستخدم يدخل الكود
4. POST /api/portal/login -> يرجع token
5. wifidog يفتح النت ويبعت /api/wifidog/auth كل دقيقة
6. السيرفر يحدث الاستهلاك
7. لو الكارت خلص -> Auth: 0 -> wifidog يقطع النت
