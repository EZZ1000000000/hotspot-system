#!/bin/bash
# ══════════════════════════════════════════════════════════════
# start.sh — نقطة تشغيل موحدة (HF Space / Render / Koyeb / أي Docker)
# 1) استعادة قاعدة البيانات من S3 (لو موجودة) — تضمن عدم فقدان البيانات
# 2) prisma db push (إنشاء الجداول تلقائياً)
# 3) seed السوبر أدمن لو مش موجود
# 4) حلقة نسخ احتياطي كل 10 دقائق إلى S3 (خلفية)
# 5) تشغيل سيرفر الإنتاج على $PORT
# ══════════════════════════════════════════════════════════════
set -e
cd /app

# ── اختيار مسار قاعدة البيانات ──
if [ -d "/data" ] && [ -w "/data" ]; then
  export DATABASE_URL="file:/data/hotspot.db"
  echo "> DB: /data/hotspot.db (persistent)"
else
  export DATABASE_URL="${DATABASE_URL:-file:/app/data/hotspot.db}"
  echo "> DB: ${DATABASE_URL#file:} (ephemeral + S3 sync)"
fi
mkdir -p "$(dirname "${DATABASE_URL#file:}")"

# ── استعادة من S3 (فقط لو الملف المحلي غير موجود) ──
node scripts/s3-sync.js restore || echo "⚠ تعذر الاستعادة — الاستمرار بقاعدة جديدة"

# ── إنشاء الجداول ──
echo "> prisma db push..."
npx prisma db push --skip-generate

# ── seed السوبر أدمن (idempotent) ──
echo "> seeding super admin..."
node scripts/seed-runtime.js

# ── حلقة النسخ الاحتياطي إلى S3 (كل 10 دقائق افتراضياً) ──
if [ -n "$S3_BUCKET" ] && [ -n "$S3_ACCESS_KEY_ID" ]; then
  BACKUP_INTERVAL="${BACKUP_INTERVAL:-600}"
  (
    while true; do
      sleep "$BACKUP_INTERVAL"
      node scripts/s3-sync.js backup || echo "⚠ فشل رفع النسخة الاحتياطية — سيعاد بعد $BACKUP_INTERVAL ثانية"
    done
  ) &
  echo "> auto-backup إلى S3 كل ${BACKUP_INTERVAL}s (خلفية) ✓"
else
  echo "> S3 غير مُعد — تشغيل بدون نسخ احتياطي (البيانات تُمس عند إعادة النشر)"
fi

# ── تشغيل ──
echo "> starting server on port ${PORT:-7860}..."
exec node server.js
