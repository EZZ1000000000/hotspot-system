/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── إصلاح حاسم لمشكلة wifidog ──
  // wifidog 1.3.0 بيبعت كل الطلبات بـ trailing slash (/api/wifidog/auth/?stage=...)
  // Next.js بيعمل 308 redirect قبل ما الـ middleware يشوف الطلب،
  // و wifidog مش بيتابع الـ redirects → "We did not get a valid answer"
  // skipTrailingSlashRedirect بيلغي الـ 308 التلقائي ويسيب الـ middleware يعمل rewrite
  skipTrailingSlashRedirect: true,
  // ssh2/node-ssh فيها binary files — لازم تكون external في السيرفر
  experimental: {
    serverComponentsExternalPackages: ['ssh2', 'node-ssh', 'bcryptjs'],
  },
  // لازم يكون شغال مع external wifidog requests
  async headers() {
    return [
      {
        source: '/api/wifidog/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Content-Type', value: 'text/plain' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      // الـ portal page مش محتاج cache — كل طلب يجيب آخر HTML
      {
        source: '/api/portal/page',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]
  },

  // redirect /portal → /api/portal/page مباشرة (بدون Next.js bundle)
  // ده بيخلي الراوتر يشوف HTML فوري بدون أي JS تقيل
  async redirects() {
    return [
      {
        source: '/portal',
        destination: '/api/portal/page',
        permanent: false,   // 302 — مش 301 عشان ممكن نغير التوجيه مستقبلاً
      },
    ]
  },
}

module.exports = nextConfig
