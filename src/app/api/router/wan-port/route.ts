import { NextRequest } from 'next/server'
import { buildLan1ToWanScript, buildWanRestoreScript } from '@/wifidog/wan-port-script'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════
// GET /api/router/wan-port?mode=lan1|restore
//
// 🔀 أداة مدخل الإنترنت — سكربتات ثابتة عامة (مفيهاش بيانات جهاز):
//   mode=lan1    → يحوّل منفذ LAN 1 يبقى هو مدخل الـ WAN
//   mode=restore → يرجّع إعدادات الشبكة الأصلية بالظبط (زي ما كانت)
//
// السكربتات بتتخدم من صفحة سكربتات كل جهاز في اللوحة، وممكن
// تتسحب مباشرة بأمر wget من SSH الراوتر.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const mode = new URL(req.url).searchParams.get('mode') || 'lan1'

  const isRestore = mode === 'restore'
  const script = isRestore ? buildWanRestoreScript() : buildLan1ToWanScript()

  return new Response(script, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `inline; filename="${isRestore ? 'wan-restore' : 'lan1-to-wan'}.sh"`,
      'Cache-Control': 'no-store',
    },
  })
}
