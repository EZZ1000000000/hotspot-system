import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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
async function recordHeartbeat(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const gwId = sp.get('gw_id')
    if (!gwId) return

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
  } catch {
    // أي خطأ → نتجاهل — Pong أهم من التسجيل
  }
}

export async function GET(req: NextRequest) {
  await recordHeartbeat(req)
  return makePong()
}
export async function POST(req: NextRequest) {
  await recordHeartbeat(req)
  return makePong()
}
