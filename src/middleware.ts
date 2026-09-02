import { NextRequest, NextResponse } from 'next/server'

// wifidog بيبعت كل الـ requests بـ trailing slash
// مثلاً: /api/wifidog/ping/ و /api/wifidog/auth/
// Next.js بيعمل 308 redirect لإزالة الـ slash
// لكن wifidog مش بيعمل follow للـ redirects - فبيفشل
// الحل: نشيل الـ trailing slash في الـ middleware قبل ما Next.js يشوفه

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // لو الـ path فيه trailing slash وهو مش الـ root
  if (pathname !== '/' && pathname.endsWith('/')) {
    const newPath = pathname.slice(0, -1)
    const url = req.nextUrl.clone()
    url.pathname = newPath
    // rewrite مش redirect - الـ URL في الـ browser مش بيتغير
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/wifidog/:path*',
}
