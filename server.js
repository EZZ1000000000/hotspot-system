// Custom server — بيعمل intercept لـ wifidog routes قبل Next.js
// ده الحل الجذري لمشكلة "invalid answer from central server"
//
// المشكلة كانت: Next.js بيبعت chunked transfer-encoding أو headers زيادة
// اللي wifidog مش بيفهمها وبيعتبر الرد غلط
//
// الحل: نرد على /api/wifidog/ping و /api/wifidog/auth مباشرةً من Node.js
// بـ raw HTTP response — بدون Next.js خالص

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

// ── Prisma (للـ auth handler) ──────────────────────────────────────────────
let prismaClient = null
function getPrisma() {
  if (!prismaClient) {
    const { PrismaClient } = require('@prisma/client')
    prismaClient = new PrismaClient()
  }
  return prismaClient
}

// ── helpers ────────────────────────────────────────────────────────────────
function bytesToMB(b) { return b / 1024 / 1024 }

function plainText(res, body) {
  const buf = Buffer.from(body, 'utf8')
  res.writeHead(200, {
    'Content-Type':   'text/plain',
    'Content-Length': buf.length,
    'Connection':     'close',          // wifidog مبيفهمش keep-alive
    'Cache-Control':  'no-store',
    'Pragma':         'no-cache',
  })
  res.end(buf)
}

// ── wifidog ping ───────────────────────────────────────────────────────────
// wifidog بيتوقع بالضبط: Pong\n
function handlePing(res) {
  plainText(res, 'Pong\n')
}

// ── wifidog auth ───────────────────────────────────────────────────────────
// wifidog بيتوقع: Auth: 1\n  أو  Auth: 0\n
async function handleAuth(query, res) {
  const token    = query.token    || ''
  const stage    = query.stage    || ''
  const incoming = parseFloat(query.incoming || '0')
  const outgoing = parseFloat(query.outgoing || '0')

  if (!token) { plainText(res, 'Auth: 0\n'); return }

  const prisma = getPrisma()

  try {
    // ── stage=login ──────────────────────────────────────────────────────
    if (stage === 'login') {
      const session = await prisma.session.findUnique({ where: { token } })
      if (!session || session.status !== 'ACTIVE') {
        plainText(res, 'Auth: 0\n'); return
      }
      // update lastPingAt في background — مش blocking
      prisma.session.update({
        where: { token },
        data:  { lastPingAt: new Date() },
      }).catch(() => {})
      plainText(res, 'Auth: 1\n')
      return
    }

    // ── stage=counters ───────────────────────────────────────────────────
    const session = await prisma.session.findUnique({
      where:   { token },
      include: { voucher: true },
    })

    if (!session || session.status !== 'ACTIVE') {
      plainText(res, 'Auth: 0\n'); return
    }

    const now          = new Date()
    const totalInMB    = bytesToMB(incoming)
    const totalOutMB   = bytesToMB(outgoing)
    const totalDataMB  = totalInMB + totalOutMB
    const totalTimeMin = (now.getTime() - new Date(session.startedAt).getTime()) / 60000
    const v            = session.voucher

    // ── فحص انتهاء الباقة ────────────────────────────────────────────────
    if (v.packageType !== 'UNLIMITED') {
      let depleted = false
      let reason   = null

      if (v.expiresAt && now > new Date(v.expiresAt)) {
        depleted = true; reason = 'TIME_EXPIRED'
      } else if (v.packageType !== 'TIME_ONLY' && v.dataLimitMB !== null && totalDataMB >= v.dataLimitMB) {
        depleted = true; reason = 'DATA_DEPLETED'
      } else if (v.packageType !== 'DATA_ONLY' && v.timeLimitMin !== null && totalTimeMin >= v.timeLimitMin) {
        depleted = true; reason = 'TIME_EXPIRED'
      }

      if (depleted) {
        // update في background
        Promise.all([
          prisma.session.update({
            where: { id: session.id },
            data:  { status: 'ENDED', endedAt: now, endReason: reason,
                     dataInMB: totalInMB, dataOutMB: totalOutMB,
                     timeUsedMin: totalTimeMin, lastPingAt: now },
          }).catch(() => {}),
          prisma.voucher.update({
            where: { id: session.voucherId },
            data:  { status: reason === 'DATA_DEPLETED' ? 'DEPLETED' : 'EXPIRED',
                     dataUsedMB: totalDataMB, timeUsedMin: totalTimeMin },
          }).catch(() => {}),
        ])
        plainText(res, 'Auth: 0\n')
        return
      }
    }

    // ── update في background ─────────────────────────────────────────────
    Promise.all([
      prisma.session.update({
        where: { id: session.id },
        data:  { dataInMB: totalInMB, dataOutMB: totalOutMB,
                 timeUsedMin: totalTimeMin, lastPingAt: now },
      }).catch(() => {}),
      prisma.voucher.update({
        where: { id: session.voucherId },
        data:  { dataUsedMB: totalDataMB, timeUsedMin: totalTimeMin },
      }).catch(() => {}),
    ])

    plainText(res, 'Auth: 1\n')

  } catch (err) {
    // لو DB فشلت — نرجع Auth: 1 (المستخدم يكمل، مش نقطعه)
    console.error('[wifidog auth error]', err)
    plainText(res, 'Auth: 1\n')
  }
}

// ── Next.js setup ──────────────────────────────────────────────────────────
const dev      = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOST || '0.0.0.0'
const port     = parseInt(process.env.PORT || '3000')
const app      = next({ dev, hostname, port })
const handle   = app.getRequestHandler()

// ── Cron: expire sessions every minute ───────────────────────────────────
function startCron() {
  const CRON_SECRET = process.env.CRON_SECRET || 'hotspot-cron-2024'
  const BASE_URL    = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  setInterval(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/cron/expire-sessions`, {
        headers: { 'x-cron-secret': CRON_SECRET },
      })
      const data = await res.json()
      if (data.expired || data.depleted || data.idle) {
        console.log('[cron]', JSON.stringify(data))
      }
    } catch (err) {
      // مش مهم لو فشل — هيحاول تاني بعد دقيقة
    }
  }, 60 * 1000) // كل دقيقة

  console.log('> Cron: expire-sessions every 60s')
}

// ── wifidog dedicated HTTP server (port 2080) ───────────────────
// الراوتر بيتصل على البورت ده مباشرة — بدون nginx ولا SSL
// وبكدة: مفيش chunked encoding ولا compression ولا حاجه تاني
function startWifidogServer() {
  const wdPort = parseInt(process.env.WIFIDOG_PORT || '2080')

  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || '/', true)
      let pathname    = parsedUrl.pathname || '/'
      const query     = parsedUrl.query

      if (pathname !== '/' && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1)
      }

      if (pathname === '/api/wifidog/ping' || pathname === '/ping') {
        handlePing(res)
      } else if (pathname === '/api/wifidog/auth' || pathname === '/auth') {
        await handleAuth(query, res)
      } else {
        plainText(res, 'Not Found\n')
      }
    } catch (err) {
      console.error('[wifidog-server]', err)
      plainText(res, 'Auth: 1\n') // فشل safe — خلي يكمل
    }
  }).listen(wdPort, '0.0.0.0', (err) => {
    if (err) { console.error('wifidog server error:', err); return }
    console.log(`> wifidog dedicated server on port ${wdPort} (no nginx/SSL)`)
  })
}

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      let pathname    = parsedUrl.pathname || '/'
      const query     = parsedUrl.query

      // ── شيل الـ trailing slash عشان wifidog ──
      if (pathname !== '/' && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1)
        req.url  = pathname + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '')
      }

      // ════════════════════════════════════════════════════════════════════
      // wifidog INTERCEPT — نرد مباشرة بدون Next.js
      // ════════════════════════════════════════════════════════════════════

      // PING: GET /api/wifidog/ping
      if (pathname === '/api/wifidog/ping') {
        handlePing(res)
        return
      }

      // AUTH: GET /api/wifidog/auth
      if (pathname === '/api/wifidog/auth') {
        await handleAuth(query, res)
        return
      }

      // ════════════════════════════════════════════════════════════════════
      // كل الباقي → Next.js عادي
      // ════════════════════════════════════════════════════════════════════
      await handle(req, res, parse(req.url, true))

    } catch (err) {
      console.error('Server error:', err)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }).listen(port, hostname, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log('> wifidog ping/auth handled directly (no Next.js overhead)')
    startCron()          // expire-sessions كل دقيقة
    startWifidogServer() // wifidog على port 2080 مباشرة
  })
})
