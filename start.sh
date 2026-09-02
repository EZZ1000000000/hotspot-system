#!/bin/bash
# ══════════════════════════════════════════════════════════════
# start.sh — HF Space runtime entry
# 1) DB على /data (persistent) لو متاح، وإلا داخل الحاوية
# 2) prisma db push (إنشاء الجداول تلقائياً)
# 3) seed السوبر أدمن لو مش موجود
# 4) تشغيل سيرفر الإنتاج
# ══════════════════════════════════════════════════════════════
set -e
cd /app

# ── اختيار مسار قاعدة البيانات ──
if [ -d "/data" ] && [ -w "/data" ]; then
  export DATABASE_URL="file:/data/hotspot.db"
  echo "> DB: /data/hotspot.db (persistent)"
else
  export DATABASE_URL="file:/app/prisma/hotspot.db"
  echo "> DB: /app/prisma/hotspot.db (ephemeral — بياض على restart)"
fi
mkdir -p "$(dirname "${DATABASE_URL#file:}")"

# ── إنشاء الجداول ──
echo "> prisma db push..."
npx prisma db push --skip-generate

# ── seed السوبر أدمن (idempotent) ──
echo "> seeding super admin..."
node scripts/seed-runtime.js

# ── تشغيل ──
echo "> starting server on port ${PORT}..."
exec node server.js
