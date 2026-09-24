// GET|POST /api/cron/db-sync
// المزامنة الدورية: لقطات كاملة على سيرفرات الأسطول + مزامنة أي قواعد احتياطية مباشرة
// بيتنده عليها GitHub Actions كل 30 دقيقة (وركفلو db-sync) أو من لوحة السوبر أدمن
// 🔒 الحماية: x-cron-secret (نفس آلية expire-sessions)

import { NextRequest, NextResponse } from 'next/server'
import { runSync } from '@/lib/db-sync'
import { cronSecret } from '@/lib/fleet'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const runtime = 'nodejs'

async function handle(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== cronSecret()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const report = await runSync()
    return NextResponse.json({ ok: true, ...report })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200) }, { status: 500 })
  }
}

export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
