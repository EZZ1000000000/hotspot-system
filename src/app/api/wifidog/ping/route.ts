import { NextRequest } from 'next/server'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { maybeSyncDue, runSync } from '@/lib/db-sync'

export const dynamic = 'force-dynamic'
// المزامنة الدورية ممكن تشتغل جوه نفس الاستدعاء (بعد الرد) — محتاجة وقت أطول
export const maxDuration = 60

// wifidog بيتوقع بالضبط: Pong\n  (HTTP 200, text/plain)
// أي حاجة تانية = "Auth server did NOT say Pong" → الراوتر يعتبر السيرفر واقف
function makePong() {
  return new Response('Pong\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': '5',
    },
  })
}

// تسجيل heartbeat الجهاز — بيتنده كل CheckInterval (60ث) من كل راوتر
// الراوتر بيبعت: gw_id + sys_uptime + sys_memfree + sys_load + wifidog_uptime
// ملاحظة مهمة: لو تسجيل الـ heartbeat فشل لأي سبب، لازم برضه نرجّع Pong عشان الراوتر ميوقفش
// الخنق في الذاكرة لكل نسخة سيرفر — كتابة كل 15 دقيقة كافية لمتابعة حالة الراوتر
// والقاعدة تنام بين الكتابات (توفير ساعات Neon المجانية اللي خلصت ووقّفت النظام)
const HEARTBEAT_WRITE_EVERY_MS = 15 * 60 * 1000
const lastHeartbeatWrite = new Map<string, number>()

async function recordHeartbeat(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const gwId = sp.get('gw_id')
    if (!gwId) return

    // خنق الكتابة: أقصى مرة كل 5 دقايق لكل راوتر — الباقي Pong فوري بدون لمس الداتابيز
    // (كان بيكتب كل 60ث من كل راوتر على مدار الساعة → قاعدة Neon شغالة 24/7 → استهلاك ساعات الحساب)
    const nowTs = Date.now()
    if (nowTs - (lastHeartbeatWrite.get(gwId) || 0) < HEARTBEAT_WRITE_EVERY_MS) return
    lastHeartbeatWrite.set(gwId, nowTs)

    const now = new Date()
    const num = (k: string) => {
      const v = parseInt(sp.get(k) || '', 10)
      return Number.isFinite(v) ? v : null
    }

    // IP الحقيقي للراوتر (خلف Vercel → x-forwarded-for)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null

    const data: any = {
      lastPingAt: now,
      pingCount: { increment: 1 },
    }
    if (ip) data.lastPingIp = ip
    const su = num('sys_uptime');       if (su !== null) data.sysUptime = su
    const sm = num('sys_memfree');      if (sm !== null) data.sysMemfree = sm
    const sl = num('sys_load');         if (sl !== null) data.sysLoad = sl
    const wu = num('wifidog_uptime');   if (wu !== null) data.wifidogUptime = wu

    await prisma.device.updateMany({ where: { gatewayId: gwId }, data })

    // راوتر مجهول (مش موجود في القاعدة — مثلاً بعد استبدال الداتابيز) → نسيبه في سجل
    // KeyValueStore عشان المالك يشوفه ويسجله رسميًا من اللوحة (بدون إنشاء تلقائي لأن المالك مطلوب)
    const probe = sp.get('sys_uptime') || sp.get('wifidog_uptime')
    if (probe !== null) {
      const key = 'unknown_gw:' + gwId.slice(0, 64)
      const val = JSON.stringify({ ip, at: now.toISOString() })
      await prisma.keyValueStore.upsert({
        where: { key },
        create: { key, value: val },
        update: { value: val },
      }).catch(() => {})
    }
  } catch {
    // أي خطأ → نتجاهل — Pong أهم من التسجيل
  }
}

// ── التشغيل الذاتي للمزامنة: بدون الاعتماد على GitHub Actions ──
// الراوترات بتبعت ping كل دقيقة — بيتفحص (بالذاكرة الأول، مجاناً) هل عدى 25 دقيقة
// من آخر مزامنة، لو آه بيتحجز قفل في KV وتشغّل المزامنة بعد الرد على الراوتر
const SYNC_CHECK_EVERY_MS = 10 * 60 * 1000
const lastSyncCheck = { at: 0 }

function maybeKickSync() {
  const now = Date.now()
  if (now - lastSyncCheck.at < SYNC_CHECK_EVERY_MS) return
  lastSyncCheck.at = now
  maybeSyncDue()
    .then(due => { if (due) after(() => { runSync().catch(() => {}) }) })
    .catch(() => {})
}

export async function GET(req: NextRequest) {
  await recordHeartbeat(req)
  maybeKickSync()
  return makePong()
}
export async function POST(req: NextRequest) {
  await recordHeartbeat(req)
  maybeKickSync()
  return makePong()
}
