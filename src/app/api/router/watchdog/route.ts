import { NextRequest } from 'next/server'
import { buildWatchdogScript, buildLockdownScript, WATCHDOG_VERSION } from '@/wifidog/watchdog-script'

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
  const sp = new URL(req.url).searchParams
  if (sp.get('version')) {
    return Response.json({ version: WATCHDOG_VERSION })
  }

  // ?lockdown=1 → سكربت «القفل الشامل الفوري» WH-LOCK:
  // طرد كل المتصلين بدون استثناء + تسطيب الحارس v12 + قفل الكروت فقط
  // الاستخدام من الراوتر: uclient-fetch ... "https://<srv>/api/router/watchdog?lockdown=1" ثم sh
  if (sp.get('lockdown')) {
    return new Response(buildLockdownScript(), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'inline; filename="wh-lock.sh"',
        'Cache-Control': 'no-store',
      },
    })
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
