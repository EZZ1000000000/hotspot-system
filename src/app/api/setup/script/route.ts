// GET /api/setup/script?server=kappa&deviceId=xxx
// بروكسي بسيط — صفحة سكريبتات الإعداد بتجيب سكربت أي جهاز من سيرفه مباشرة
// (server-side fetch — مفيش CORS من المتصفح على النشرات التانية)

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SERVERS: Record<string, string> = {
  gamma: 'https://hotspot-system-gamma.vercel.app',
  kappa: 'https://hotspot-system-kappa.vercel.app',
  dun:   'https://hotspot-system-dun.vercel.app',
  seven: 'https://hotspot-system-seven.vercel.app',
}

export async function GET(req: NextRequest) {
  const p        = new URL(req.url).searchParams
  const server   = p.get('server') || 'gamma'
  const deviceId = p.get('deviceId')

  if (!SERVERS[server]) return NextResponse.json({ error: `سيرفر غير معروف: ${server}` }, { status: 400 })
  if (!deviceId)        return NextResponse.json({ error: 'deviceId مطلوب' }, { status: 400 })

  try {
    const res = await fetch(`${SERVERS[server]}/api/admin/config?deviceId=${encodeURIComponent(deviceId)}&type=script`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
    const text = await res.text()
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'فشل الاتصال بالسيرفر'
    return NextResponse.json({ error: `تعذر جلب السكربت من ${server}: ${msg}` }, { status: 502 })
  }
}
