import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════
// 1) wifidog بيبعت كل الـ requests بـ trailing slash
//    مثلاً: /api/wifidog/ping/ و /api/wifidog/auth/
//    Next.js بيعمل 308 redirect لإزالة الـ slash لكن wifidog
//    مش بيعمل follow للـ redirects - فبيفشل
//    الحل: نشيل الـ trailing slash في الـ middleware قبل ما Next.js يشوفه
//
// 2) العنوان القديم gamma بقى مرور شفاف (proxy) للاستضافة الجديدة
//    layalina-cafe.vercel.app — القاعدة القديمة ماتت ومش هتترجع،
//    فبدل ما أي راوتر أو سكربت قديم يفشل:
//    - كل /api/* على gamma بيتحول داخلياً للسيرفر الجديد ويرجّع
//      نفس الرد بالظبط (Pong / Auth: 1 / السكربتات) — الراوترات
//      مش بتعمل follow للـ redirects فمحتاجين الرد يرجع من نفس
//      العنوان، وده اللي الـ proxy بيعمله
//    - صفحات الموقع بتتحول 302 للمتصفح على الاستضافة الجديدة
// ═══════════════════════════════════════════════════════════════════

const NEW_HOST = 'https://layalina-cafe.vercel.app'
const NEW_HOSTNAME = new URL(NEW_HOST).host

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const host = (req.headers.get('host') || '').toLowerCase()

  // ── مسارات wifidog: إصلاح trailing slash قبل أي حاجة ──
  let path = pathname
  if (path.startsWith('/api/wifidog') && path !== '/api/wifidog' && path.endsWith('/')) {
    path = path.slice(0, -1)
  }

  // ── العنوان القديم (gamma): مرور شفاف للسيرفر الجديد ──
  if (host.includes('gamma')) {
    if (path.startsWith('/api')) {
      try {
        const headers = new Headers(req.headers)
        headers.set('host', NEW_HOSTNAME)
        // نطلب رد غير مضغوط عشان نرجعه زي ما هو بدون مشاكل encoding
        headers.set('accept-encoding', 'identity')
        const method = req.method
        const hasBody = method !== 'GET' && method !== 'HEAD'
        const body = hasBody ? await req.text() : undefined
        const res = await fetch(NEW_HOST + path + search, {
          method,
          headers,
          body,
          redirect: 'manual',
          cache: 'no-store',
        })
        const h = new Headers(res.headers)
        h.delete('content-encoding')
        h.delete('content-length')
        h.delete('transfer-encoding')
        return new Response(res.body, { status: res.status, headers: h })
      } catch {
        return new Response('server temporarily unreachable', { status: 502 })
      }
    }
    // صفحات الموقع: تحويل المتصفح للاستضافة الجديدة
    return NextResponse.redirect(new URL(pathname + search, NEW_HOST), 302)
  }

  // ── باقي الهوستات (السيرفر الجديد): إصلاح الـ slash داخلياً ──
  if (path !== pathname) {
    const url = req.nextUrl.clone()
    url.pathname = path
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon).*)'],
}
