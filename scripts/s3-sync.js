#!/usr/bin/env node
/**
 * s3-sync.js — نسخ احتياطي / استعادة قاعدة بيانات SQLite عبر أي S3 متوافق
 * (Hugging Face S3: https://s3.hf.co) — بدون أي dependencies خارجية.
 *
 * الاستخدام:
 *   node scripts/s3-sync.js backup    → يرفع نسخة متسقة (VACUUM INTO) من قاعدة البيانات إلى S3
 *   node scripts/s3-sync.js restore   → ينزّل قاعدة البيانات من S3 إذا كانت موجودة (ولا يلمس ملف محلي أحدث)
 *
 * متغيرات البيئة:
 *   S3_ENDPOINT          default: https://s3.hf.co
 *   S3_BUCKET            مثال: gdnjd123/hotspot-backup   (namespace/bucket — path-style)
 *   S3_ACCESS_KEY_ID     مفتاح الوصول
 *   S3_SECRET_ACCESS_KEY المفتاح السري
 *   S3_REGION            default: us-east-1
 *   S3_OBJECT_KEY        default: hotspot.db
 *   DATABASE_URL         مثال: file:/app/data/hotspot.db
 *
 * لا يقوم بإعداد أي شيء إن لم تتوفر المتغيرات — يخرج بصمت (exit 0) حتى لا يعطل التشغيل.
 */
const https = require('https')
const http = require('http')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const MODE = process.argv[2] // backup | restore

const ENDPOINT = (process.env.S3_ENDPOINT || 'https://s3.hf.co').replace(/\/+$/, '')
const BUCKET = process.env.S3_BUCKET || ''
const REGION = process.env.S3_REGION || 'us-east-1'
const OBJECT_KEY = process.env.S3_OBJECT_KEY || 'hotspot.db'
const ACCESS_KEY = process.env.S3_ACCESS_KEY_ID || ''
const SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY || ''

function dbPath() {
  const url = process.env.DATABASE_URL || 'file:./dev.db'
  let p = url.startsWith('file:') ? url.slice(5) : url
  if (p.startsWith('./')) p = path.resolve(process.cwd(), p)
  return p
}
const DB_FILE = dbPath()

function log(...a) { console.log('[s3-sync]', ...a) }
function die(msg, code = 1) { console.error('[s3-sync] ✗', msg); process.exit(code) }

// ── لا مفاتيح؟ لا شيء نفعه ──
if (!BUCKET || !ACCESS_KEY || !SECRET_KEY) {
  log('S3 غير مُعد (متغيرات ناقصة) — تخطي:', MODE || 'sync')
  process.exit(0)
}
if (!['backup', 'restore'].includes(MODE)) die('الاستخدام: node scripts/s3-sync.js backup|restore')

// ── أدوات SigV4 ──
const sha256hex = (b) => crypto.createHash('sha256').update(b).digest('hex')
const hmac = (k, b) => crypto.createHmac('sha256', k).update(b).digest()

function uriEncode(str, encodeSlash = true) {
  let out = ''
  for (const ch of encodeURIComponent(str)) out += (ch === '%' ? ch : ch)
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%2F/g, encodeSlash ? '%2F' : '/')
}

function signedHeaders(method, urlPath, headers, bodyForHash) {
  const url = new URL(ENDPOINT + urlPath)
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = sha256hex(bodyForHash || '')

  const hdrs = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...headers,
  }
  const sortedNames = Object.keys(hdrs).map((n) => n.toLowerCase()).sort()
  const canonicalHeaders = sortedNames.map((n) => {
    const real = Object.keys(hdrs).find((k) => k.toLowerCase() === n)
    return `${n}:${String(hdrs[real]).trim()}`
  }).join('\n') + '\n'
  const signedHeadersStr = sortedNames.join(';')

  const canonicalRequest = [
    method,
    url.pathname.split('/').map((s) => uriEncode(s, false) || s).join('/'),
    url.search.replace(/^\?/, ''),
    canonicalHeaders,
    signedHeadersStr,
    payloadHash,
  ].join('\n')

  const scope = `${dateStamp}/${REGION}/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n')
  const kDate = hmac('AWS4' + SECRET_KEY, dateStamp)
  const kRegion = hmac(kDate, REGION)
  const kService = hmac(kRegion, 's3')
  const kSigning = hmac(kService, 'aws4_request')
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

  hdrs['authorization'] = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`
  return { hdrs, host: url.host, pathOnly: url.pathname + url.search, port: url.port || (url.protocol === 'https:' ? 443 : 80), protocol: url.protocol }
}

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const { hdrs, host, pathOnly, port, protocol } = signedHeaders(method, urlPath, body ? { 'content-length': String(body.length) } : {}, body)
    const mod = protocol === 'https:' ? https : http
    const req = mod.request({ hostname: host, port, path: pathOnly, method, headers: hdrs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // تتبع redirect مرة واحدة (S3 يوجه إلى CDN موقّع)
        const chunks = []
        https.get(res.headers.location, (r2) => {
          r2.on('data', (c) => chunks.push(c))
          r2.on('end', () => resolve({ status: r2.statusCode, body: Buffer.concat(chunks), headers: r2.headers }))
        }).on('error', reject)
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

// ── لقطة متسقة لقاعدة البيانات (VACUUM INTO) مع fallback لنسخ عادي ──
async function makeSnapshot(snapshotPath) {
  try {
    const { PrismaClient } = require('@prisma/client')
    const prisma = new PrismaClient()
    try {
      await prisma.$executeRawUnsafe(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`)
      await prisma.$disconnect()
      return true
    } catch (e) {
      try { await prisma.$disconnect() } catch {}
      throw e
    }
  } catch (e) {
    log('VACUUM INTO فشل (' + e.message + ') — نسخ مباشر للملف (أقل أماناً)')
    fs.copyFileSync(DB_FILE, snapshotPath)
    return true
  }
}

async function main() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true })
  const objectPath = `/${BUCKET}/${OBJECT_KEY}`

  if (MODE === 'backup') {
    if (!fs.existsSync(DB_FILE)) die('قاعدة البيانات غير موجودة: ' + DB_FILE)
    const snap = DB_FILE + '.s3snap'
    try {
      await makeSnapshot(snap)
      const body = fs.readFileSync(snap)
      const res = await request('PUT', objectPath, body)
      if (res.status === 200 || res.status === 201) log(`✓ رفع النسخة الاحتياطية إلى s3://${BUCKET}/${OBJECT_KEY} (${(body.length / 1024).toFixed(0)} KB)`)
      else { console.error('[s3-sync] ✗ PUT status', res.status, res.body.toString().slice(0, 300)); process.exit(1) }
    } finally {
      try { fs.unlinkSync(snap) } catch {}
    }
  }

  if (MODE === 'restore') {
    // لا نستعيد إلا إذا الملف المحلي غير موجود (أول تشغيل بعد redeploy)
    if (fs.existsSync(DB_FILE)) { log('قاعدة البيانات موجودة محلياً — تخطي الاستعادة'); return }
    const res = await request('GET', objectPath, null)
    if (res.status === 200) {
      fs.writeFileSync(DB_FILE, res.body)
      log(`✓ استعادة قاعدة البيانات من s3://${BUCKET}/${OBJECT_KEY} (${(res.body.length / 1024).toFixed(0)} KB)`)
    } else if (res.status === 404 || res.status === 403) {
      log('لا توجد نسخة سابقة في S3 — بدء بقاعدة بيانات جديدة')
    } else {
      console.error('[s3-sync] ⚠ GET status', res.status, '— الاستمرار بقاعدة بيانات جديدة')
    }
  }
}

main().catch((e) => { console.error('[s3-sync] ✗', e.message); process.exit(MODE === 'backup' ? 1 : 0) })
