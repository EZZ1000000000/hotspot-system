// GET  /api/superadmin/cluster — حالة الحماية على السيرفر الحالي + النسخ المحفوظة
// POST { action: 'sync' | 'restore' | 'switch' | 'addStandby' | 'removeStandby' }
//
// المسار ده هو اللي اللوحة بتكلمه (محلياً أو عن طريق بروكسي remote) —
// مفيهوش بيانات حساسة، والإجراءات كلها آمنة (مزامنة/استرجاع بيانات ناقصة)

import { NextRequest, NextResponse } from 'next/server'
import { clusterStatus, forceSwitch, emergencyRestoreNow, addStandby, removeStandby, getActiveClient } from '@/lib/db-cluster'
import { runSync, storedBackupsMeta } from '@/lib/db-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    const status = await clusterStatus()
    let backups: any[] = []
    try { backups = await storedBackupsMeta() } catch {}
    // آخر مزامنة
    let lastSync: any = null
    try {
      const row = await getActiveClient().keyValueStore.findUnique({ where: { key: 'cluster:lastsync' } })
      lastSync = row?.value ? JSON.parse(row.value) : null
    } catch {}
    return NextResponse.json({ ...status, backups, lastSync })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200), selfKey: 'unknown' }, { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, url } = await req.json().catch(() => ({}))
    switch (action) {
      case 'sync': {
        const report = await runSync()
        return NextResponse.json({ success: true, report })
      }
      case 'restore': {
        const r = await emergencyRestoreNow()
        return NextResponse.json({ success: !!r.restored, ...r })
      }
      case 'switch': {
        const st = await forceSwitch()
        return NextResponse.json({ success: true, status: st })
      }
      case 'addStandby': {
        if (!url || !String(url).startsWith('postgres'))
          return NextResponse.json({ success: false, error: 'رابط قاعدة غير صالح' })
        const r = await addStandby(String(url).trim())
        return NextResponse.json({ success: true, ...r })
      }
      case 'removeStandby': {
        const total = await removeStandby(String(url || '').trim())
        return NextResponse.json({ success: true, total })
      }
      default:
        return NextResponse.json({ error: 'action غير معروف' }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e).slice(0, 200) }, { status: 200 })
  }
}
