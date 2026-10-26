import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// البورتال اللي الراوتر بيوجهله أي عميل بيحاول يتصفح
//
// ── إصلاح أمني 2026-10-26: قفل باب «ركوب الجلسات» ──────────────────
// الفحص القديم كان بيدوّر على أي جلسة ACTIVE بالـ IP، ولو مفيش بآخر
// جلسة على الجهاز في آخر 5 دقايق. النتيجة كانت كارثة:
//   • أي عميل جديد نفس الـ IP الداخلي (بيتكرر مع DHCP على طول الوقت)
//     كان بيركب على جلسة عميل تاني — من غير أي كود!
//   • أي حد يفتح البورتال خلال 5 دقايق بعد أي دخول ناجح كان بياخد
//     توكن آخر واحد دخل — برضه من غير أي كود!
// ده كان سبب بلاغ المالك: «أي حد يكتب أي رقم ويفتح — الكود مش لمرة واحدة»
//
// دلوقتي: الاستكمال بالـ MAC فقط وعلى نفس الجهاز — نفس الموبايل اللي
// فتح الكرت بيرجع لنفس جلسته، وأي جهاز جديد بياخد صفحة تسجيل الدخول
// العادية زي أي عميل جديد تماماً.
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || new URL(req.url).origin

  const mac  = params.get('mac')   || ''
  const gwId = params.get('gw_id') || ''

  // نحدد الجهاز من gw_id (مع إصلاح ذاتي لو الراوتر ماسك هوية قديمة
  // بعد التحويل — نفس منطق login-handler)
  let device = gwId
    ? await prisma.device.findUnique({ where: { gatewayId: gwId } }).catch(() => null)
    : null
  if (!device && gwId) {
    const actives = await prisma.device.findMany({ where: { isActive: true }, take: 2 })
    if (actives.length === 1) device = actives[0]
  }

  // استكمال الجلسة بالـ MAC فقط — ولسانه على نفس الجهاز اللي فتح الكرت
  let session = null
  if (mac && device) {
    session = await prisma.session.findFirst({
      where: { macAddress: mac, status: 'ACTIVE', deviceId: device.id },
      orderBy: { lastPingAt: 'desc' },
    }).catch(() => null)
  }

  if (session?.token) {
    // نرجع HTML بدل redirect عشان نتجنب mixed-content HTTP→HTTPS issue
    // wifidog بيوجه للـ portal عبر HTTP ، والـ JS redirect هو اللي ينقله لـ HTTPS
    // لو الإطار framed (البورتال بيفتح الراوتر في iframe مخفي) → نخرج الإطار كله
    // لصفحة الجلسة عشان المستخدم يشوف صفحة النجاح مش جوه إطار مخفي
    const sessionUrl = `${serverUrl}/session?token=${session.token}`
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<script>
(function(){
  var u=${JSON.stringify(sessionUrl)};
  try{
    if(window.top&&window.top!==window.self){window.top.location.replace(u);return;}
  }catch(e){}
  window.location.replace(u);
})();
<\/script>
</head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#070B12;color:#00D4FF">
<p>جاري توجيهك... النت بيتفتح الآن ✅</p>
</body></html>`
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // مفيش جلسة — وجّهه للـ portal (صفحة تسجيل الدخول العادي) (HTML خالص = سريع جداً)
  const portalUrl = new URL('/api/portal/page', serverUrl)
  params.forEach((v, k) => portalUrl.searchParams.set(k, v))
  return Response.redirect(portalUrl.toString(), 302)
}
