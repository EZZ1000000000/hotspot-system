// ═══════════════════════════════════════════════════════════════════
// 🔄 db-sync — المزامنة التلقائية بين قواعد البيانات
//
// نوعين من النسخ الاحتياطي بيشتغلوا مع بعض:
//  1) لقطات كاملة (snapshots) بترفع كل 30 دقيقة على باقي سيرفرات الأسطول
//     (بتتخزن في قواعدهم هي — عزل كامل: لو قاعدة السيرفر ماتت بكل حاجة،
//      آخر نسخة لسه قاعدة على سيرفرات تانية شغالة)
//  2) مزامنة تدريجية مباشرة لأي قاعدة احتياطية مسجلة برابط postgres
//     (STANDBY_DB_URLS أو من اللوحة) — بس الصفوف المتغيرة من آخر مزامنة
//
// التشغيل: /api/cron/db-sync (بالسِر) — من GitHub Actions كل 30 دقيقة
//          أو زر «مزامنة الآن» من لوحة السوبر أدمن
// ═══════════════════════════════════════════════════════════════════
import { Prisma } from '@prisma/client'
import { prisma } from './db-cluster'
import { FLEET, serverKey, cronSecret, maskDbUrl } from './fleet'

// ترتيب الجداول يحترم مفاتيح الربط (FK) عند الزرع
const TABLE_ORDER = [
  'superAdmin','plan','hotspotAdmin','device','saleRecord','voucher','session',
  'groupQRCard','groupQRVoucher','rewardTask','rewardEarning','auditLog',
  'wifiChangeLog','notification','planRequest','keyValueStore','cpaOffer','cpaSource',
] as const

// حقل العلامة المائية لكل جدول (الصفوف اللي اتغيرت بعد آخر مزامنة) + حد أقصى للنسخ
const TABLE_META: Record<string, { wm?: string; cap?: number }> = {
  superAdmin:     { wm: 'updatedAt' },
  plan:           { wm: 'updatedAt' },
  hotspotAdmin:   { wm: 'updatedAt' },
  device:         { wm: 'updatedAt' },
  saleRecord:     { wm: 'updatedAt' },
  voucher:        { wm: 'updatedAt', cap: 40_000 },
  session:        { wm: 'lastPingAt', cap: 1500 },
  groupQRCard:    { wm: 'updatedAt' },
  groupQRVoucher: {},
  rewardTask:     { wm: 'updatedAt' },
  rewardEarning:  { wm: 'createdAt', cap: 1000 },
  auditLog:       { wm: 'createdAt', cap: 500 },
  wifiChangeLog:  { wm: 'createdAt', cap: 200 },
  notification:   { wm: 'createdAt', cap: 300 },
  planRequest:    { wm: 'createdAt' },
  keyValueStore:  {},
  cpaOffer:       { wm: 'updatedAt' },
  cpaSource:      { wm: 'updatedAt' },
}

// الأعمدة السكالر لكل موديل — من DMMF (عشان نطلع أي علاقات قبل الحفظ)
const colCache = new Map<string, string[]>()
function scalarCols(model: string): string[] {
  const cached = colCache.get(model)
  if (cached) return cached
  const dm = (Prisma.dmmf.datamodel.models as any[]).find(m => m.name === model)
  const cols: string[] = dm ? dm.fields.filter((f: any) => f.kind === 'scalar').map((f: any) => f.name) : []
  colCache.set(model, cols)
  return cols
}

function sanitize(row: any, model: string): any {
  const cols = scalarCols(model)
  const out: any = {}
  for (const c of cols) if (row[c] !== undefined) out[c] = row[c]
  return out
}

// ── تصدير لقطة كاملة ──
export async function exportFull(): Promise<any> {
  const tables: Record<string, any[]> = {}
  const counts: Record<string, number> = {}
  for (const model of TABLE_ORDER) {
    const meta = TABLE_META[model] || {}
    const args: any = { take: meta.cap || 50_000 }
    if (meta.cap) {
      args.orderBy = { [meta.wm || 'createdAt']: 'desc' }
    }
    const rows = await (prisma as any)[model].findMany(args)
    tables[model] = rows
    counts[model] = rows.length
  }
  return { server: serverKey(), exportedAt: new Date().toISOString(), counts, tables }
}

// ── مزامنة قاعدة احتياطية مباشرة (برابط postgres) ──
async function syncDirectStandby(url: string, hostId: string): Promise<any> {
  const { PrismaClient } = await import('@prisma/client')
  const client = new PrismaClient({ log: ['error'], datasources: { db: { url } } })
  try {
    await client.$queryRaw`SELECT 1`
  } catch (e: any) {
    await client.$disconnect().catch(() => {})
    return { url: maskDbUrl(url), mode: 'unreachable', error: String(e?.message || e).slice(0, 120) }
  }

  // العلامة المائية مخزنة عند المصدر
  const wmKey = 'cluster:syncwm:' + hostId
  const wmRow = await prisma.keyValueStore.findUnique({ where: { key: wmKey } }).catch(() => null)
  const since = wmRow?.value ? new Date(wmRow.value) : null
  const mode = since ? 'incremental' : 'full'
  const startedAt = new Date()
  let inserted = 0, updated = 0

  for (const model of TABLE_ORDER) {
    const meta = TABLE_META[model] || {}
    const cols = scalarCols(model)
    let rows: any[] = []
    if (!since || !meta.wm) {
      const args: any = { take: meta.cap || 50_000 }
      if (meta.cap) args.orderBy = { [meta.wm || 'createdAt']: 'desc' }
      rows = await (prisma as any)[model].findMany(args)
    } else {
      rows = await (prisma as any)[model].findMany({
        where: { [meta.wm]: { gt: since } },
        orderBy: { [meta.wm]: 'asc' },
        take: 20_000,
      })
    }
    if (rows.length === 0) continue

    if (mode === 'full') {
      // زرع سريع: createMany + تخطي الموجود
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200).map(r => sanitize(r, model))
        await client.$transaction(
          chunk.map(r => (client as any)[model].createMany({ data: r, skipDuplicates: true })),
        ).catch(() => {
          for (const r of chunk) {
            (client as any)[model].createMany({ data: r, skipDuplicates: true }).catch(() => null)
          }
        })
        inserted += chunk.length
      }
    } else {
      // مزامنة تدريجية: upsert للصفوف المتغيرة
      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50).map(r => sanitize(r, model))
        await client.$transaction(
          chunk.map(r => (client as any)[model].upsert({
            where: { id: r.id },
            update: Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'id')),
            create: r,
          })),
        )
        updated += chunk.length
      }
    }
    // الأعمدة اللي مش في السكالر مش بتنساب — بس نتأكد إن كل الجداول عندها عمود id
    if (!cols.includes('id')) continue
  }

  await prisma.keyValueStore.upsert({
    where: { key: wmKey },
    update: { value: startedAt.toISOString() },
    create: { key: wmKey, value: startedAt.toISOString() },
  })
  await client.$disconnect().catch(() => {})
  return { url: maskDbUrl(url), mode, inserted, updated }
}

// ── رفع لقطة كاملة على كل سيرفرات الأسطول التانية ──
async function pushSnapshotToSiblings(): Promise<any[]> {
  const self = serverKey()
  const snap = await exportFull()
  const body = JSON.stringify(snap)
  const results: any[] = []
  await Promise.all(Object.entries(FLEET).filter(([k]) => k !== self).map(async ([key, v]) => {
    try {
      const res = await fetch(`${v.url}/api/cluster/snapshot`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret() },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(60_000),
      })
      const d = await res.json().catch(() => ({}))
      results.push({ key, ok: res.ok && d?.ok !== false, bytes: body.length, error: d?.error })
    } catch (e: any) {
      results.push({ key, ok: false, error: String(e?.message || e).slice(0, 100) })
    }
  }))
  return results
}

// ── التشغيل الكامل: مزامنة مباشرة + لقطات ──
export async function runSync(): Promise<any> {
  const report: any = { at: new Date().toISOString(), server: serverKey(), direct: [], siblings: [], errors: 0 }

  // 1) قواعد احتياطية مباشرة (روابط postgres)
  let urls: string[] = []
  try {
    const envList = (process.env.STANDBY_DB_URLS || '').split(/[,\n]+/).map(s => s.trim()).filter(s => s.startsWith('postgres'))
    const kvRow = await prisma.keyValueStore.findUnique({ where: { key: 'cluster:standby_urls' } }).catch(() => null)
    const kvList = kvRow?.value ? JSON.parse(kvRow.value) : []
    urls = [...new Set([...envList, ...(Array.isArray(kvList) ? kvList : [])])]
  } catch {}
  for (const url of urls) {
    if (url === (process.env.DATABASE_URL || '')) continue
    try {
      const hostId = new URL(url).host + new URL(url).pathname
      const r = await syncDirectStandby(url, hostId)
      report.direct.push(r)
      if (r.error) report.errors++
    } catch (e: any) {
      report.direct.push({ url: maskDbUrl(url), error: String(e?.message || e).slice(0, 120) })
      report.errors++
    }
  }

  // 2) لقطات كاملة على السيرفرات التانية
  try {
    report.siblings = await pushSnapshotToSiblings()
    if (report.siblings.some((s: any) => !s.ok)) report.errors++
  } catch (e: any) {
    report.siblings.push({ error: String(e?.message || e).slice(0, 120) })
    report.errors++
  }

  // سجل آخر مزامنة
  try {
    await prisma.keyValueStore.upsert({
      where: { key: 'cluster:lastsync' },
      update: { value: JSON.stringify({ at: report.at, siblings: report.siblings, direct: report.direct.length, errors: report.errors }) },
      create: { key: 'cluster:lastsync', value: JSON.stringify({ at: report.at, siblings: report.siblings, direct: report.direct.length, errors: report.errors }) },
    })
  } catch {}

  return report
}

// بيانات النسخ المحفوظة على سيرفر (metadata فقط — للعرض في اللوحة)
export async function storedBackupsMeta(): Promise<any[]> {
  const rows = await prisma.keyValueStore.findMany({
    where: { key: { startsWith: 'cluster:backupmeta:' } },
  })
  return rows.map(r => {
    try { return { server: r.key.replace('cluster:backupmeta:', ''), ...JSON.parse(r.value) } }
    catch { return { server: r.key, bad: true } }
  })
}

// ── التشغيل الذاتي: هل الاستحقاق للمزامنة جاء؟ ──
// بتتنده من مسارات الترافيك المنتظم (ping الراوتر كل دقيقة) — لو عدى 25 دقيقة
// من آخر مزامنة بتحجز قفل وتقول «شغّلني» — والشغل بيحصل بعد الرد (after)
export async function maybeSyncDue(): Promise<boolean> {
  const GAP_MS = 25 * 60 * 1000
  try {
    const row = await prisma.keyValueStore.findUnique({ where: { key: 'cluster:synclock' } })
    const last = row?.value ? Number(row.value) || 0 : 0
    if (Date.now() - last < GAP_MS) return false
    await prisma.keyValueStore.upsert({
      where: { key: 'cluster:synclock' },
      update: { value: String(Date.now()) },
      create: { key: 'cluster:synclock', value: String(Date.now()) },
    })
    return true
  } catch { return false }
}
