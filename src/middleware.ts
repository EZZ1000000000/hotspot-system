import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════
// 1) wifidog بيبعت كل الـ requests بـ trailing slash
//    مثلاً: /api/wifidog/ping/ و /api/wifidog/auth/
//    Next.js بيعمل 308 redirect لإزالة الـ slash لكن wifidog
//    مش بيعمل follow للـ redirects - فبيفشل
//    الحل: نشيل الـ trailing slash في الـ middleware قبل ما Next.js يشوفه
//
// 2) سيرفر gamma القديم (الرئيسي): صفحات الموقع بتتحول تلقائياً
//    على الاستضافة الجديدة الشغالة layalina-cafe.vercel.app —
//    مع إبقاء كل الـ /api/* على نفس الدومين (الراوترات والسيرفرات
//    بتتكلم بروتوكول ثابت ومش بتعمل follow للـ redirects)
// ═══════════════════════════════════════════════════════════════════

const NEW_HOST = 'https://layalina-cafe.vercel.app'

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // ── مسارات wifidog: إصلاح trailing slash فقط ──
  if (pathname.startsWith('/api/wifidog')) {
    if (pathname !== '/api/wifidog' && pathname.endsWith('/')) {
      const url = req.nextUrl.clone()
      url.pathname = pathname.slice(0, -1)
      // rewrite مش redirect - الـ URL في الـ browser مش بيتغير
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }

  // ── باقي الـ API: عدّي زي ما هو (راوترات + مزامنة السيرفرات) ──
  if (pathname.startsWith('/api')) return NextResponse.next()

  // ── العنوان القديم (gamma): حوّل أي صفحة على الاستضافة الجديدة ──
  const host = (req.headers.get('host') || '').toLowerCase()
  if (host.includes('gamma')) {
    return NextResponse.redirect(new URL(pathname + search, NEW_HOST), 302)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon).*)'],
}
