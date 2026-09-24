// ═══ مخزن لقطات النسخ الاحتياطي المتبادل بين سيرفرات الأسطول ═══
// كل سيرفر بيرفع لقطة كاملة من بياناته على باقي السيرفرات كل 30 دقيقة
// (db-sync → PUT هنا) — واللقطات بتتخزن في KeyValueStore المحلي
//
// GET  ?server=gamma  → إرجاع آخر لقطة محفوظة لسيرفر gamma (بيستخدمها
//                        db-cluster في الاسترجاع الذاتي وقت الطوارئ)
// PUT  body = snapshot → تخزين لقطة جديدة
//
// 🔒 الحماية: x-cron-secret مطلوب في الحالتين — المسار ده بيعبّر بيانات كاملة

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronSecret } from '@/lib/fleet'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  return req.headers.get('x-cron-secret') === cronSecret()
}

function safe(v: string): any {
  try { return JSON.parse(v) } catch { return {} }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const server = req.nextUrl.searchParams.get('server') || ''
    if (!server) {
      // بدون server → قايمة اللي محفوظ عندنا فقط (metadata)
      const rows = await prisma.keyValueStore.findMany({ where: { key: { startsWith: 'cluster:backupmeta:' } } })
      return NextResponse.json({ stored: rows.map(r => ({ server: r.key.replace('cluster:backupmeta:', ''), ...safe(r.value) })) })
    }
    const row = await prisma.keyValueStore.findUnique({ where: { key: `cluster:backup:${server}` } })
    if (!row?.value) return NextResponse.json({ error: 'no-snapshot' }, { status: 404 })
    return NextResponse.json(JSON.parse(row.value))
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const snap = await req.json()
    const server = String(snap?.server || 'unknown').replace(/[^a-z0-9_-]/gi, '')
    if (!server || !snap?.tables || !snap?.exportedAt)
      return NextResponse.json({ error: 'بيانات اللقطة ناقصة (server/tables/exportedAt)' }, { status: 400 })

    const value = JSON.stringify(snap)
    const meta = JSON.stringify({ exportedAt: snap.exportedAt, counts: snap.counts, storedAt: new Date().toISOString(), bytes: value.length })
    await prisma.keyValueStore.upsert({
      where: { key: `cluster:backup:${server}` },
      update: { value },
      create: { key: `cluster:backup:${server}`, value },
    })
    await prisma.keyValueStore.upsert({
      where: { key: `cluster:backupmeta:${server}` },
      update: { value: meta },
      create: { key: `cluster:backupmeta:${server}`, value: meta },
    })
    return NextResponse.json({ ok: true, server, bytes: value.length })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 500 })
  }
}
