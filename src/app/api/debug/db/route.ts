// 🔬 GET /api/debug/db?key=dbg-2026-jawhara
// تشخيص مؤقت: نشوف الاستعلامات العالقة وحالة ذاكرة قاعدة البيانات
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const KEY = 'dbg-2026-jawhara'

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== KEY)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const activity = await prisma.$queryRaw<any[]>`
      SELECT pid, state,
             now() - query_start AS running_for,
             left(query, 120) AS query
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
      ORDER BY query_start ASC
      LIMIT 40`

    const counts = await prisma.$queryRaw<any[]>`
      SELECT state, count(*)::int AS n
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state`

    const mem = await prisma.$queryRaw<any[]>`
      SELECT name, setting FROM pg_settings
      WHERE name IN ('shared_buffers','work_mem','dynamic_shared_memory_type','max_connections')`

    const sizes = await prisma.$queryRaw<any[]>`
      SELECT relname, n_live_tup::bigint AS rows
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC LIMIT 10`

    return NextResponse.json({ ok: true, counts, activity, mem, sizes })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message, code: err?.code }, { status: 500 })
  }
}

// DELETE — قتل استعلامات عالقة أطول من دقيقة
export async function DELETE(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== KEY)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const min = parseInt(req.nextUrl.searchParams.get('min') || '1')

  try {
    const killed = await prisma.$queryRaw<any[]>`
      SELECT pg_terminate_backend(pid) AS terminated, pid,
             left(query, 100) AS query
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state <> 'idle'
        AND now() - query_start > (${min} || ' minutes')::interval
        AND query NOT ILIKE '%pg_stat_activity%'`
    return NextResponse.json({ ok: true, killed })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}

// PUT — قتل كل الجلسات (حتى الخاملة) عشان تحرير الذاكرة المشتركة
export async function PUT(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== KEY)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  try {
    const killed = await prisma.$queryRaw<any[]>`
      SELECT pg_terminate_backend(pid) AS terminated, pid, state,
             now() - state_change AS idle_for
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()`
    return NextResponse.json({ ok: true, killedCount: killed.length, killed })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
