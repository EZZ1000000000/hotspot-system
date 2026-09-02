import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://babreizk.online'

  const mac  = params.get('mac')   || ''
  const gwId = params.get('gw_id') || ''
  const ip   = params.get('ip')    || ''

  let session = null

  // دور على session نشطة بالـ MAC
  if (mac) {
    session = await prisma.session.findFirst({
      where: { macAddress: mac, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    }).catch(() => null)
  }

  // لو مفيش بالـ MAC، دور بالـ IP
  if (!session && ip) {
    session = await prisma.session.findFirst({
      where: { ipAddress: ip, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    }).catch(() => null)
  }

  // لو مفيش بالـ IP، دور بآخر session على الجهاز
  if (!session && gwId) {
    const device = await prisma.device.findUnique({
      where: { gatewayId: gwId },
    }).catch(() => null)

    if (device) {
      session = await prisma.session.findFirst({
        where: {
          deviceId: device.id,
          status: 'ACTIVE',
          // آخر session اتعملت في آخر 5 دقايق
          startedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
        orderBy: { startedAt: 'desc' },
      }).catch(() => null)
    }
  }

  if (session?.token) {
    // نرجع HTML بدل redirect عشان نتجنب mixed-content HTTP→HTTPS issue
    // wifidog بيوجه للـ portal عبر HTTP ، والـ JS redirect هو اللي ينقله لـ HTTPS
    const sessionUrl = `${serverUrl}/session?token=${session.token}`
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${sessionUrl}">
<script>window.location.replace(${JSON.stringify(sessionUrl)})<\/script>
</head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#070B12;color:#00D4FF">
<p>جاري توجيهك... النت بيتفتح الآن ✅</p>
</body></html>`
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // مفيش session — وجّهه للـ portal (HTML خالص = سريع جداً)
  const portalUrl = new URL('/api/portal/page', serverUrl)
  params.forEach((v, k) => portalUrl.searchParams.set(k, v))
  return Response.redirect(portalUrl.toString(), 302)
}
