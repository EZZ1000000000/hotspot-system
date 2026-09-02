#!/bin/bash
# ══════════════════════════════════════════════════════════════
# deploy.sh — نشر المشروع على Hugging Face Space
#
# الاستخدام (مرة واحدة بعد الحصول على توكن Write):
#   HF_TOKEN=hf_xxxxxxxxxxxx bash deploy.sh [اسم-الفضاء]
#
# جلب التوكن: https://huggingface.co/settings/tokens
#   → Create new token → Type: Write
# ══════════════════════════════════════════════════════════════
set -e
: "${HF_TOKEN:?اكتب: HF_TOKEN=hf_xxx bash deploy.sh}"
SPACE_NAME="${1:-hotspot-system}"
SPACE_SDK="docker"

cd "$(dirname "$0")"

echo "── 1) التحقق من التوكن ──"
WHO=$(curl -s -H "Authorization: Bearer $HF_TOKEN" https://huggingface.co/api/whoami-v2)
USER=$(echo "$WHO" | python3 -c "import json,sys;print(json.load(sys.stdin)['name'])")
echo "   المستخدم: $USER"

echo "── 2) إنشاء Space (${SPACE_SDK}) ──"
CODE=$(curl -s -o /tmp/hs_create.json -w "%{http_code}" -X POST https://huggingface.co/api/repos/create \
  -H "Authorization: Bearer $HF_TOKEN" -H "Content-Type: application/json" \
  -d "{\"type\":\"space\",\"name\":\"$SPACE_NAME\",\"sdk\":\"$SPACE_SDK\",\"private\":false}")
if [ "$CODE" = "201" ]; then echo "   تم إنشاء Space ✓"
elif grep -q "already exists" /tmp/hs_create.json 2>/dev/null; then echo "   Space موجود بالفعل — هنعمل push عليه ✓"
else echo "   رد غير متوقع:"; cat /tmp/hs_create.json; fi

echo "── 3) تجهيز git ──"
git init -q 2>/dev/null || true
git config user.email "deploy@hotspot.local"
git config user.name "Deploy Bot"
git add -A
git commit -qm "deploy: hotspot system → HF Space" || true
git remote remove hf 2>/dev/null || true
git remote add hf "https://$USER:$HF_TOKEN@huggingface.co/spaces/$USER/$SPACE_NAME"

echo "── 4) رفع الكود ──"
git push -f hf master:main 2>&1 | grep -vE "^(remote: )?(Resolving|Writing|Counting|Compressing|Delta)" || true

echo ""
echo "════════════════════════════════════════════════"
echo "  ✅ Space URL: https://huggingface.co/spaces/$USER/$SPACE_NAME"
echo "  🌐 الموقع:     https://$USER-$SPACE_NAME.hf.space"
echo "  ⏳ البناء بياخد 5-10 دقائق أول مرة"
echo "════════════════════════════════════════════════"
