import { NextRequest } from 'next/server'
import { buildWatchdogScript, WATCHDOG_VERSION } from '@/wifidog/watchdog-script'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════
// GET /api/router/watchdog
// بيرجع سكربت الحارس الذاتي (hotspot-watchdog v2) لكل الراوترات
//
// ده مصدر التحديث الذاتي: الحارس على كل راوتر بيجيب النسخة دي
// كل ساعة ويقارنها بنسخته — لو مختلفة يستبدل نفسه (بعد تحقق
// صارم: shebang + علامة النسخة + sh -n) ويسجل في
// /tmp/hotspot_watchdog.log
//
// يعني أي إصلاح مستقبلي في السكربت ده — أول ما يترفع على
// السيرفر بيوصل لكل الراوترات الشغالة لوحده خلال ساعة
// من غير لصق أي أوامر على أي راوتر.
//
// ?version=1 → JSON بسيط برقم النسخة (للمراقبة/التشخيص)
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get('version')) {
    return Response.json({ version: WATCHDOG_VERSION })
  }

  return new Response(buildWatchdogScript(), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline; filename="hotspot-watchdog.sh"',
      'Cache-Control': 'no-store',
    },
  })
}
