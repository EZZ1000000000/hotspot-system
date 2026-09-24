// ═══════════════════════════════════════════════════════════════════
// 🛡️ db-cluster — طبقة قاعدة بيانات ذاتية الشفاء
//
// الفكرة: بدل ما النظام يموت لو القاعدة الأساسية واقفة (زي ما حصل لليالينا)،
// البروكسي ده بيكتشف الموت تلقائياً ويقلب على قاعدة احتياطية:
//   1) بيجرّب كل روابط احتياطية مسجلة (env STANDBY_DB_URLS + مسجلة في اللوحة)
//   2) لو القاعدة الاحتياطية فاضية من غير سكيما → بيزرع السكيما لوحده (SCHEMA_SQL)
//   3) لو القاعدة الاحتياطية فاضية بيانات → بيسحب آخر نسخة احتياطية كاملة
//      من باقي سيرفرات الأسطول (الشعلة/السرايا/البرنس) ويرجّعها لوحده
//   4) بيكمل يخدم من القاعدة الاحتياطية فوراً — بدون تدخل أي حد
//
// الروابط الاحتياطية بتتخزن في: env STANDBY_DB_URLS (للطوارئ القصوى)
//                               + KeyValueStore cluster:standby_urls (من اللوحة)
// ═══════════════════════════════════════════════════════════════════
import { PrismaClient } from '@prisma/client'
import { SCHEMA_SQL } from '../generated/schema-sql'
import { FLEET, serverKey, cronSecret, maskDbUrl } from './fleet'

type AnyClient = any

const g = globalThis as any
// ── حالة الكلستر (على مستوى العملية) ──
g.__dbClients   = g.__dbClients || new Map<string, AnyClient>()   // url → raw client
g.__dbActiveUrl = g.__dbActiveUrl || null                          // الرابط النشط حالياً
g.__dbSwitching = g.__dbSwitching || null                          // promise قفل التبديل
g.__dbAllDeadUntil = g.__dbAllDeadUntil || 0                       // cooldown لو كل المرشحين ماتوا
g.__dbLastEvent = g.__dbLastEvent || null                          // آخر حدث تبديل (للعرض)

function baseUrl(): string {
  return process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || ''
}

function rawClientFor(url: string): AnyClient {
  let c = g.__dbClients.get(url)
  if (!c) {
    c = new PrismaClient({ log: ['error'], datasources: { db: { url } } })
    g.__dbClients.set(url, c)
  }
  return c
}

// فك غلاف cause واستخراج كود الخطأ الحقيقي
function unwrap(e: any): { code: string; msg: string } {
  let cur = e
  for (let i = 0; i < 5 && cur?.cause; i++) cur = cur.cause
  const msg = String(cur?.message || e || '')
  const code = String(cur?.code || cur?.error_code || msg.match(/P1\d{3}/)?.[0] || '')
  return { code, msg }
}

// خطأ قاتل = القاعدة نفسها مش متاحة (مش خطأ منطق زي unique constraint)
export function isFatalDbError(e: any): boolean {
  const { code, msg } = unwrap(e)
  if (['P1001', 'P1002'].includes(code)) return true                 // مش واصلة / تايم آوت
  if (/\b(ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EAI_AGAIN)\b/.test(msg)) return true
  if (/Can't reach database server/i.test(msg)) return true
  if (/Server has closed the connection|Connection terminated/i.test(msg)) return true
  return false
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
}

// ── السجل: روابط احتياطية من env + من اللوحة (KV) ──
export async function standbyUrls(): Promise<string[]> {
  const out: string[] = []
  const envList = (process.env.STANDBY_DB_URLS || '')
    .split(/[,\n]+/).map(s => s.trim()).filter(s => s.startsWith('postgres'))
  out.push(...envList)
  try {
    const kv = rawClientFor(g.__dbActiveUrl || baseUrl())
    const row: any = await withTimeout(kv.keyValueStore.findUnique({ where: { key: 'cluster:standby_urls' } }), 8000)
    if (row?.value) {
      const list = JSON.parse(row.value)
      if (Array.isArray(list)) out.push(...list.filter((s: unknown) => typeof s === 'string' && s.startsWith('postgres')))
    }
  } catch { /* القاعدة واقفة — env فقط */ }
  const active = g.__dbActiveUrl || baseUrl()
  return [...new Set(out)].filter(u => u && u !== active)
}

export async function saveStandbyList(list: string[]): Promise<void> {
  const c = rawClientFor(g.__dbActiveUrl || baseUrl())
  await c.keyValueStore.upsert({
    where: { key: 'cluster:standby_urls' },
    update: { value: JSON.stringify(list) },
    create: { key: 'cluster:standby_urls', value: JSON.stringify(list) },
  })
}

// ── زرع السكيما ذاتياً على قاعدة فاضية ──
async function applySchema(client: AnyClient): Promise<number> {
  const stmts = SCHEMA_SQL
    .split(/;\s*(?:\r?\n|$)/)
    .map((s: string) => s.replace(/--[^\n]*/g, '').trim())
    .filter((s: string) => s.length > 0)
  let ok = 0
  for (let i = 0; i < stmts.length; i += 8) {
    const chunk = stmts.slice(i, i + 8)
    await client.$transaction(chunk.map((s: string) => client.$executeRawUnsafe(s)))
    ok += chunk.length
  }
  return ok
}

// القاعدة جاهزة؟ (اتصال + سكيما موجودة) — ولو ناقصة سكيما بيزرعها
async function probeAndHeal(client: AnyClient): Promise<{ ok: boolean; schemaPlanted?: boolean; err?: string }> {
  try {
    await withTimeout(client.$queryRaw`SELECT 1`, 15000)
  } catch (e: any) {
    return { ok: false, err: unwrap(e).code || unwrap(e).msg.slice(0, 80) }
  }
  try {
    await withTimeout(client.$queryRaw`SELECT 1 FROM "Voucher" LIMIT 1`, 10000)
    return { ok: true }
  } catch (e: any) {
    const { code, msg } = unwrap(e)
    if (code === 'P2021' || code === 'P2022' || /does not exist/i.test(msg)) {
      try {
        await applySchema(client)
        return { ok: true, schemaPlanted: true }
      } catch (e2: any) {
        return { ok: false, err: 'schema-plant-failed: ' + unwrap(e2).msg.slice(0, 80) }
      }
    }
    return { ok: false, err: code || msg.slice(0, 80) }
  }
}

// ── سحب آخر نسخة احتياطية من سيرفرات الأسطول وزرعها في القاعدة الحالية ──
// النسخ الكاملة بتكون محفوظة على السيرفرات التانية في KeyValueStore عن طريق
// المزامنة الدورية (db-sync) — فلو القاعدة ماتت، آخر نسخة موجودة على سيرفر شغال
export async function emergencyRestore(targetClient: AnyClient, selfKey: string): Promise<{ restored: boolean; source?: string; exportedAt?: string; counts?: Record<string, number>; err?: string }> {
  const secret = cronSecret()
  const candidates: { key: string; url: string }[] = Object.entries(FLEET)
    .filter(([k]) => k !== selfKey)
    .map(([k, v]) => ({ key: k, url: v.url }))

  for (const sib of candidates) {
    try {
      const res = await fetch(`${sib.url}/api/cluster/snapshot?server=${encodeURIComponent(selfKey)}`, {
        headers: { 'x-cron-secret': secret },
        cache: 'no-store',
        signal: AbortSignal.timeout(45_000),
      })
      if (!res.ok) continue
      const snap = await res.json()
      if (!snap?.tables) continue
      const order = [
        'superAdmin','plan','hotspotAdmin','device','saleRecord','voucher','session',
        'groupQRCard','groupQRVoucher','rewardTask','rewardEarning','auditLog',
        'wifiChangeLog','notification','planRequest','keyValueStore','cpaOffer','cpaSource',
      ]
      const counts: Record<string, number> = {}
      for (const model of order) {
        const rows = snap.tables[model]
        if (!Array.isArray(rows) || rows.length === 0) continue
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200)
          await targetClient.$transaction(
            chunk.map((r: any) => targetClient[model].createMany({ data: r, skipDuplicates: true }).catch(() => null)),
          ).catch(async () => {
            for (const r of chunk) {
              await targetClient[model].createMany({ data: r, skipDuplicates: true }).catch(() => null)
            }
          })
        }
        counts[model] = rows.length
      }
      return { restored: true, source: sib.key, exportedAt: snap.exportedAt, counts }
    } catch { /* جرّب السيرفر التالي */ }
  }
  return { restored: false, err: 'no-snapshot-found' }
}

// ── التبديل: جرب كل المرشحين بالترتيب ──
async function doSwitch(reason: string): Promise<string> {
  const selfKey = serverKey()
  const candidates = await standbyUrls()
  if (candidates.length === 0) throw new Error('no-standby-configured')

  for (const url of candidates) {
    const client = rawClientFor(url)
    const probe = await probeAndHeal(client)
    if (!probe.ok) {
      console.log(`[db-cluster] standby failed: ${maskDbUrl(url)} → ${probe.err}`)
      continue
    }
    // قاعدة فاضية؟ اسحب آخر نسخة احتياطية من الأسطول
    let restoreInfo: any = null
    try {
      const cnt = await withTimeout(client.voucher.count(), 10000)
      if (cnt === 0) {
        restoreInfo = await emergencyRestore(client, selfKey)
      }
    } catch { /* مش هيرجعنا عن التبديل */ }

    const prev = g.__dbActiveUrl || baseUrl()
    g.__dbActiveUrl = url
    g.__dbLastEvent = {
      at: new Date().toISOString(), reason,
      from: maskDbUrl(prev), to: maskDbUrl(url),
      schemaPlanted: !!probe.schemaPlanted,
      restored: restoreInfo?.restored || false,
      restoreSource: restoreInfo?.source, restoreExportedAt: restoreInfo?.exportedAt,
    }
    console.log(`[db-cluster] ⚡ FAILOVER: ${maskDbUrl(prev)} → ${maskDbUrl(url)} (${reason})`, JSON.stringify(g.__dbLastEvent))
    // سجل الحدث في القاعدة الجديدة (أفضل جهد)
    try {
      await client.auditLog.create({ data: {
        action: 'DB_FAILOVER', entityType: 'database', actorType: 'system',
        details: JSON.stringify(g.__dbLastEvent),
      } })
    } catch {}
    return url
  }
  throw new Error('all-standbys-dead')
}

// التبديل مع قفل + cooldown
export async function switchIfPossible(reason: string): Promise<string | null> {
  if (Date.now() < g.__dbAllDeadUntil) return null
  if (g.__dbSwitching) return g.__dbSwitching
  g.__dbSwitching = (async () => {
    try {
      return await doSwitch(reason)
    } catch (e: any) {
      g.__dbAllDeadUntil = Date.now() + 60_000
      console.log('[db-cluster] switch failed:', e?.message)
      return null
    } finally {
      g.__dbSwitching = null
    }
  })()
  return g.__dbSwitching
}

// العميل النشط الحالي (بدون غلاف failover — للاستخدام الداخلي)
export function getActiveClient(): AnyClient {
  if (!g.__dbActiveUrl) g.__dbActiveUrl = baseUrl() || null
  if (!g.__dbActiveUrl) throw new Error('no database url configured')
  return rawClientFor(g.__dbActiveUrl)
}

export function getActiveUrl(): string { return g.__dbActiveUrl || baseUrl() }

// ── البروكسي: نفس واجهة PrismaClient لكن بيحوّل على العميل النشط + failover تلقائي ──
// مهم: عمليات الموديلات بترجع Lazy-thenable عشان $transaction([...]) يفضل شغال،
// وعشان نقدر نعيد بناء نفس العملية على القاعدة الجديدة بعد التبديل
function activeClient(): AnyClient { return getActiveClient() }

function lazyOp(invoke: (c: AnyClient) => any): any {
  const obj: any = {
    [Symbol.toStringTag]: 'PrismaClientPromise',
    __invoke: invoke,   // أعِد بناء العملية على عميل محدد (بتستخدمها الـ transaction بعد التبديل)
  }
  obj.then = (onF: any, onR: any) => invoke(activeClient()).then(onF, onR)
  obj.catch = (onR: any) => invoke(activeClient()).catch(onR)
  obj.finally = (f: any) => invoke(activeClient()).finally(f)
  return obj
}

async function withFailover<T>(fn: (client: AnyClient) => Promise<T>): Promise<T> {
  try {
    return await fn(getActiveClient())
  } catch (e: any) {
    if (!isFatalDbError(e)) throw e
    const switched = await switchIfPossible(String(unwrap(e).code || unwrap(e).msg.slice(0, 60)))
    if (!switched) throw e
    return fn(getActiveClient())   // إعادة محاولة واحدة على القاعدة الجديدة
  }
}

const prismaProxy: any = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const client = getActiveClient()
    const val = (client as any)[prop]

    // $transaction — دعم القلب التلقائي حتى جوه الترانزاكشن
    if (prop === '$transaction' && typeof val === 'function') {
      return (...args: any[]) => {
        const arr = args[0]
        if (Array.isArray(arr) && arr.length > 0 && arr.every((a: any) => a && typeof a.__invoke === 'function')) {
          return withFailover(async (c: AnyClient) => {
            const run = (cl: AnyClient) => (cl as any).$transaction(arr.map((a: any) => a.__invoke(cl)), ...args.slice(1))
            try {
              return await run(c)
            } catch (e: any) {
              if (!isFatalDbError(e)) throw e
              const switched = await switchIfPossible('tx-failover')
              if (!switched) throw e
              return run(getActiveClient())
            }
          })
        }
        // الصيغة التفاعلية $transaction(fn) أو أي صيغة تانية — بدون إعادة بناء
        return withFailover((c: AnyClient) => (c as any).$transaction(...args))
      }
    }

    // عمليات الموديلات (findMany / create / update / count / ...) — lazy + failover
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      // delegate موديل — لفّ دوالّه في lazyOp
      return new Proxy(val, {
        get(_mt, method) {
          const fn = (val as any)[method]
          if (typeof fn !== 'function') return fn
          return (...margs: any[]) => lazyOp((c: AnyClient) => (c as any)[prop][method](...margs))
        },
      })
    }

    if (typeof val !== 'function') return val
    // دوال عامة ($queryRaw / $executeRaw / $disconnect / ...) — فوري + failover
    return (...args: any[]) => withFailover((c: AnyClient) => (c as any)[prop](...args))
  },
})

export const prisma: PrismaClient = prismaProxy as PrismaClient

// ── حالة الكلستر (للوحة + الـ health) ──
export async function clusterStatus(): Promise<any> {
  const active = getActiveUrl()
  const selfKey = serverKey()
  let healthy = false
  try {
    await withTimeout(rawClientFor(active).$queryRaw`SELECT 1`, 8000)
    healthy = true
  } catch {}
  const list = await standbyUrls().catch(() => [])
  return {
    selfKey,
    active: maskDbUrl(active),
    activeRaw: active,
    healthy,
    standbys: list.map(maskDbUrl),
    standbyCount: list.length,
    lastEvent: g.__dbLastEvent,
    allDeadCooldown: Date.now() < g.__dbAllDeadUntil,
  }
}

// تحويل يدوي من اللوحة
export async function forceSwitch(): Promise<any> {
  g.__dbAllDeadUntil = 0
  const url = await switchIfPossible('manual-switch')
  if (!url) throw new Error('فشل التبديل — كل القواعد الاحتياطية غير متاحة')
  return clusterStatus()
}

// استرجاع طوارئ يدوي: سحب آخر نسخة للسيرفر الحالي وزرعها في القاعدة النشطة
export async function emergencyRestoreNow(): Promise<any> {
  const client = getActiveClient()
  const r = await emergencyRestore(client, serverKey())
  try {
    await client.auditLog.create({ data: {
      action: 'DB_RESTORE', entityType: 'database', actorType: 'superadmin',
      details: JSON.stringify({ ...r, source_url: undefined }),
    } })
  } catch {}
  return r
}

// إدارة الروابط الاحتياطية من اللوحة
export async function addStandby(url: string): Promise<any> {
  if (!url.startsWith('postgres')) throw new Error('رابط غير صالح')
  const c = rawClientFor(url)
  const probe = await probeAndHeal(c)
  const list = await standbyUrls()
  const active = getActiveUrl()
  const next = [...new Set([...list, url])].filter(u => u !== active)
  await saveStandbyList(next)
  return { ok: probe.ok, schemaPlanted: !!probe.schemaPlanted, err: probe.err, total: next.length }
}

export async function removeStandby(url: string): Promise<number> {
  const list = await standbyUrls()
  const next = list.filter(u => u !== url)
  await saveStandbyList(next)
  return next.length
}
