// POST /api/superadmin/remote
// ─── البروكسي الموحد: لوحة السوبر أدمن بتتحكم في كل السيرفرات من مكان واحد ───
//
// الجسم: { server: 'gamma'|'kappa'|'dun'|'seven', path: '/api/...', method?, body? }
// - gamma = السيرفر الحالي (fetch داخلي)
// - الباقي = fetch سيرفر-سايد للنشرات التانية (مفيش CORS من السيرفر)
//
// حماية: whitelist للمسارات المسموحة + methods محددة بس
// خاصية: superAdminId:'__SERVER_SA__' بيترجم تلقائياً لـ id السوبر أدمن بتاع السيرفر الهدف

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SERVERS: Record<string, string> = {
  gamma: process.env.NEXT_PUBLIC_SERVER_URL || 'https://hotspot-system-gamma.vercel.app',
  kappa: 'https://hotspot-system-kappa.vercel.app',
  dun:   'https://hotspot-system-dun.vercel.app',
  seven: 'https://hotspot-system-seven.vercel.app',
}

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const ALLOWED_PREFIXES = ['/api/superadmin/', '/api/admin/', '/api/rewards/', '/api/portal/']
const ALLOWED_PATHS = ['/api/vouchers/generate', '/api/cron/sync-offers']

function pathAllowed(path: string): boolean {
  if (ALLOWED_PATHS.includes(path)) return true
  return ALLOWED_PREFIXES.some(p => path.startsWith(p))
}

// كاش بسيط لـ id السوبر أدمن بتاع كل سيرفر (5 دقايق)
const saIdCache: Record<string, { id: string; at: number }> = {}
async function resolveServerSA(base: string): Promise<string> {
  const cached = saIdCache[base]
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.id
  const res = await fetch(`${base}/api/superadmin/admins`, { cache: 'no-store', signal: AbortSignal.timeout(25_000) })
  const admins = await res.json()
  if (!Array.isArray(admins) || admins.length === 0 || !admins[0].superAdminId)
    throw new Error('مفيش سوبر أدمن على السيرفر الهدف')
  saIdCache[base] = { id: admins[0].superAdminId, at: Date.now() }
  return saIdCache[base].id
}

export async function POST(req: NextRequest) {
  try {
    const { server, path, method = 'GET', body } = await req.json()

    if (!server || !SERVERS[server])
      return NextResponse.json({ error: `سيرفر غير معروف: ${server}` }, { status: 400 })
    if (!path || typeof path !== 'string' || !path.startsWith('/api/'))
      return NextResponse.json({ error: 'مسار غير صالح' }, { status: 400 })
    if (!pathAllowed(path.split('?')[0]))
      return NextResponse.json({ error: 'المسار غير مسموح' }, { status: 403 })
    if (!ALLOWED_METHODS.includes(method))
      return NextResponse.json({ error: 'method غير مسموح' }, { status: 403 })

    const base = SERVERS[server]
    let payload = body

    // ترجمة __SERVER_SA__ → id السوبر أدمن الحقيقي بتاع السيرفر الهدف
    if (payload && typeof payload === 'object' && payload.superAdminId === '__SERVER_SA__') {
      try {
        payload = { ...payload, superAdminId: await resolveServerSA(base) }
      } catch (e: any) {
        return NextResponse.json({ error: 'فشل تحديد السوبر أدمن للسيرفر الهدف: ' + e.message }, { status: 502 })
      }
    }

    const res = await fetch(`${base}${path}`, {
      method,
      headers: payload !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
    })

    const ct = res.headers.get('content-type') || ''
    let data: unknown
    if (ct.includes('application/json')) data = await res.json().catch(() => null)
    else data = await res.text()

    // { __proxy, status, data } — العميل يفك الغلاف تلقائياً
    return NextResponse.json({ __proxy: true, status: res.status, data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'فشل الاتصال بالسيرفر الهدف' }, { status: 502 })
  }
}
