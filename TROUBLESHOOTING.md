# سجل المشاكل والحلول — Hotspot System

---

## المشكلة 1: "We did not get a valid answer from the central server"

### الأعراض
- wifidog بيقول `Error communicating with auth server`
- wifidog بيقول `Auth server did NOT say Pong`
- المستخدم بيدخل الكارت، بيتسجل في الداشبورد كـ ACTIVE، بس النت مش بيفتح
- الـ ping بيرد بـ `Pong` لو اختبرته يدوياً من الراوتر، بس wifidog مش بيقبله

### السبب الجذري
Next.js بيبعت الـ HTTP response بـ **chunked transfer-encoding** تلقائياً.
wifidog قديم ومش بيعرف يقرأ chunked — بيتوقع HTTP/1.1 بسيط بـ Content-Length ثابت.

بالإضافة: استخدام SSL مع `babreizk.online:443` كان بيسبب مشاكل في الـ SSL handshake مع wifidog.

### محاولات فاشلت
- تغيير headers في `NextResponse` — مش كافي، Next.js لسه بيبعت chunked
- إضافة `Content-Length` في `next.config.js` — الـ framework بيتجاهله
- إضافة `/etc/hosts` entry على الراوتر — سبب مشكلة SSL إضافية
- تغيير `Cache-Control` و `X-Accel-Buffering` — مش بيأثر على chunked encoding

### الحل النهائي ✅

**الخطوة 1 — server.js: intercept مباشر قبل Next.js**

بنرد على `/api/wifidog/ping` و `/api/wifidog/auth` مباشرة من Node.js
بدون ما Next.js يلمسهم خالص — ده بيضمن Content-Length ثابت:

```javascript
function plainText(res, body) {
  const buf = Buffer.from(body, 'utf8')
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Content-Length': buf.length,  // ← ثابت مش chunked
  })
  res.end(buf)
}

// في الـ createServer:
if (pathname === '/api/wifidog/ping') { handlePing(res); return }
if (pathname === '/api/wifidog/auth') { await handleAuth(query, res); return }
// كل الباقي → Next.js عادي
await handle(req, res, ...)
```

**الخطوة 2 — wifidog.conf: HTTP مباشر على IP بدون SSL**

```
AuthServer {
    Hostname 16.16.159.119   ← IP مباشر مش دومين
    HTTPPort 3000             ← port مباشر
    SSLAvailable no           ← بدون SSL خالص
    Path /api/wifidog/
}
```

أمر تطبيق الـ config على الراوتر:
```bash
cat > /etc/wifidog.conf << 'EOF'
GatewayID GW-D00B-40C7
ExternalInterface eth0.1
GatewayInterface br-lan
AuthServer {
    Hostname 16.16.159.119
    HTTPPort 3000
    SSLAvailable no
    Path /api/wifidog/
}
GatewayPort 2060
HTTPDMaxConn 253
ClientTimeout 10
CheckInterval 60
PopularServers kernel.org,ieee.org
FirewallRuleSet global {
    FirewallRule allow to 16.16.159.119
}
FirewallRuleSet validating-users {
    FirewallRule allow to 0.0.0.0/0
}
FirewallRuleSet known-users {
    FirewallRule allow to 0.0.0.0/0
}
FirewallRuleSet unknown-users {
    FirewallRule allow tcp to 16.16.159.119
    FirewallRule block udp port 53
    FirewallRule block tcp port 53
    FirewallRule block udp port 67
    FirewallRule block tcp port 67
}
FirewallRuleSet locked-users {
    FirewallRule block to 0.0.0.0/0
}
EOF
/etc/init.d/wifidog restart
```

---

## المشكلة 2: Auth: -1 بيقطع المستخدمين

### الأعراض
- في اللوج: `Got ERROR from central server authenticating token`
- المستخدم بيتصل وبعدين بيتقطع فجأة

### السبب
`auth-handler.ts` كان بيرجع `Auth: -1` لو الـ DB فشلت أو حصل exception.
`Auth: -1` عند wifidog = error فادح → بيوقف كل الاتصالات.

### الحل — القاعدة الذهبية
```
Auth: 1  → المستخدم متصل ✅
Auth: 0  → منتهي / غير مصرح ✅
Auth: -1 → ممنوع نرجعها أبداً ❌

لو DB فشلت في counters → ارجع Auth: 1
أفضل يكمل من إننا نقطعه بسبب مشكلة في الـ DB
```

الـ DB updates بقت background (non-blocking) عشان الرد يكون فوري:
```javascript
// بدل await → Promise بدون await
Promise.all([
  prisma.session.update(...).catch(() => {}),
  prisma.voucher.update(...).catch(() => {}),
])
plainText(res, 'Auth: 1\n')  // رد فوري
```

---

## المشكلة 3: Trailing Slash

### الأعراض
wifidog بيبعت `/api/wifidog/ping/` بـ trailing slash.
Next.js بيعمل redirect 308 لـ `/api/wifidog/ping` بدون slash.
wifidog مش بيعمل follow للـ redirects → فشل.

### الحل في server.js
```javascript
if (pathname !== '/' && pathname.endsWith('/')) {
  pathname = pathname.slice(0, -1)
  req.url = pathname + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '')
}
```

---

## المشكلة 4: /etc/hosts على الراوتر

### السبب
إضافة `16.16.159.119 babreizk.online` في `/etc/hosts`
سببت مشكلة في SSL certificate verification.

### الحل
```bash
sed -i '/16.16.159.119 babreizk.online/d' /etc/hosts
```

---

## قواعد wifidog الثابتة (مهم جداً)

| المتطلب | القيمة الصح |
|---------|-------------|
| رد الـ ping | `Pong\n` بالضبط — لا زيادة ولا نقصان |
| رد الـ auth | `Auth: 1\n` أو `Auth: 0\n` فقط |
| HTTP | HTTP/1.1 فقط |
| Transfer-Encoding | Content-Length ثابت — مش chunked |
| SSL | no في البيئة المحلية |
| Redirects | wifidog مش بيعمل follow للـ 301/302/308 |
| Auth: -1 | ممنوع — بيوقف كل الاتصالات |

---

## معلومات البنية التحتية

| العنصر | القيمة |
|--------|--------|
| VPS IP | `16.16.159.119` |
| VPS Port | `3000` |
| Domain | `babreizk.online` (للـ portal فقط) |
| Router IP | `10.0.0.1` |
| Gateway ID | `GW-D00B-40C7` |
| Router OS | OpenWrt 23.05.2 |
| wifidog path | `/api/wifidog/` |
