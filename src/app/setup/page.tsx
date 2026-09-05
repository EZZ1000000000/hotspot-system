'use client'
import { useState, useEffect, useCallback } from 'react'

/* ════════════════════════════ الأنواع ════════════════════════════ */
type Device = {
  id: string; name: string; gatewayId: string
  routerIp?: string; wifiSSID?: string | null; location?: string | null
  isActive: boolean
  gatewayInterface?: string; externalInterface?: string; clientTimeout?: number
  tunnelPort?: number | null
  _count?: { sessions: number; vouchers: number }
}
type Admin = {
  id: string; name: string; username: string; email?: string | null
  isActive: boolean
  _count?: { devices?: number; vouchers?: number }
  devices?: Device[]
  devicesError?: boolean
}
type ServerInfo = {
  key: string; label: string; url: string
  ok: boolean; error?: string | null
  self: boolean
  admins: Admin[]
}
type Fleet = {
  selfKey: string
  servers: ServerInfo[]
  totalAdmins: number; totalDevices: number
  okServers: number; serverCount: number
  fetchedAt: string
}

// ألوان وشخصيات السيرفرات — ثابتة في كل الواجهة
const SERVER_META: Record<string, { short: string; color: string }> = {
  gamma: { short: 'γ الرئيسي', color: '#00E676' },
  kappa: { short: 'κ الشعلة',  color: '#f59e0b' },
  dun:   { short: 'δ السرايا', color: '#a78bfa' },
  seven: { short: '7 البرنس',  color: '#22d3ee' },
}
const serverMeta = (k: string) => SERVER_META[k] || { short: k, color: '#6B8CAE' }

const S = {
  card:  { background: '#0C1420', border: '1px solid #1C2A40', borderRadius: 14, padding: 20 } as React.CSSProperties,
  input: { width: '100%', padding: '10px 13px', background: '#070B12', border: '1px solid #1C2A40', borderRadius: 9, color: '#E2F0FB', fontFamily: 'Cairo,sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const },
  label: { display: 'block', fontSize: 11, color: '#6B8CAE', marginBottom: 5 } as React.CSSProperties,
  btn:   (bg = '#0088CC', c = '#000') => ({ padding: '9px 16px', background: bg, border: 'none', borderRadius: 9, color: c, fontFamily: 'Cairo,sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 } as React.CSSProperties),
}

const copyText = async (t: string) => {
  try { await navigator.clipboard.writeText(t) } catch {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
  }
}

/* ════════════════════════════ شارة السيرفر ════════════════════════════ */
function ServerBadge({ serverKey, ok }: { serverKey: string; ok?: boolean }) {
  const m = serverMeta(serverKey)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: `${m.color}14`, border: `1px solid ${m.color}44`, borderRadius: 20,
      padding: '2px 9px', fontSize: 10, fontWeight: 700, color: m.color, whiteSpace: 'nowrap',
    }}>
      {ok !== undefined && <span style={{ width: 6, height: 6, borderRadius: 9, background: ok ? m.color : '#FF4444', display: 'inline-block' }} />}
      {m.short}
    </span>
  )
}

/* ════════════════════════════ كارت سكربت جهاز ════════════════════════════ */
function DeviceScript({ device, serverKey, serverUrl, vpsIp }: {
  device: Device; serverKey: string; serverUrl: string; vpsIp: string
}) {
  const [copied,  setCopied]  = useState(false)
  const [script,  setScript]  = useState('')
  const [loading, setLoading] = useState(true)

  // السكربت بيتجاب من سيرفر الجهاز نفسه (بروكسي داخلي — مفيش CORS)
  useEffect(() => {
    let alive = true
    fetch(`/api/setup/script?server=${serverKey}&deviceId=${device.id}`)
      .then(r => r.text())
      .then(t => { if (alive) { setScript(t); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [device.id, serverKey])

  const installCmd = `wget -qO /tmp/i.sh "${serverUrl}/api/admin/config?deviceId=${device.id}&type=script" && sh /tmp/i.sh`
  const copy = async () => { await copyText(script); setCopied(true); setTimeout(() => setCopied(false), 2500) }
  const download = () => { const b = new Blob([script], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `install-${device.gatewayId}.sh`; a.click() }

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#E2F0FB', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {device.name} <ServerBadge serverKey={serverKey} />
          </div>
          <div style={{ fontSize: 11, color: '#6B8CAE', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>🌐 {device.routerIp || '192.168.1.1'}</span>
            {device.location && <span>📍 {device.location}</span>}
            {device.wifiSSID
              ? <span style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.25)', borderRadius: 5, padding: '1px 7px', color: '#00E676', fontSize: 10, fontWeight: 700 }}>
                  📡 SSID → {device.wifiSSID}
                </span>
              : <span style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 5, padding: '1px 7px', color: '#f59e0b', fontSize: 10 }}>
                  ⚠️ SSID غير محدد
                </span>
            }
          </div>
          <div style={{ fontSize: 10, color: '#354E6A', marginTop: 3, fontFamily: 'monospace', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>ID: {device.gatewayId}</span>
            {device.tunnelPort && <span style={{ color: '#00E676' }}>🔌 Port: {device.tunnelPort}</span>}
            {device._count && <span>🎫 {device._count.vouchers} كارت</span>}
          </div>
        </div>
        <span style={{
          padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: device.isActive ? 'rgba(0,230,118,0.1)' : 'rgba(255,68,68,0.1)',
          color: device.isActive ? '#00E676' : '#FF4444',
          border: `1px solid ${device.isActive ? 'rgba(0,230,118,0.2)' : 'rgba(255,68,68,0.2)'}`,
        }}>
          {device.isActive ? '● نشط' : '● متوقف'}
        </span>
      </div>

      {/* SSH Tunnel Info */}
      {device.tunnelPort && vpsIp && (
        <div style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#00E676', marginBottom: 6 }}>🔌 للدخول على الراوتر من أي مكان</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 2, direction: 'ltr', textAlign: 'left' }}>
            <span style={{ color: '#6B8CAE' }}># Step 1</span><br />
            <span style={{ color: '#00D4FF' }}>ssh root@{vpsIp}</span><br />
            <span style={{ color: '#6B8CAE' }}># Step 2</span><br />
            <span style={{ color: '#00D4FF' }}>ssh root@localhost -p {device.tunnelPort}</span>
          </div>
        </div>
      )}

      {/* خطوات التثبيت */}
      <div style={{ background: 'rgba(0,136,204,0.04)', border: '1px solid rgba(0,136,204,0.12)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 11, color: '#6B8CAE', lineHeight: 2 }}>
        <div style={{ fontWeight: 700, color: '#00D4FF', marginBottom: 4 }}>📋 خطوات التثبيت — طريقتين</div>
        <div style={{ fontWeight: 700, color: '#E2F0FB' }}>الأسهل — أمر واحد من SSH الراوتر:</div>
        <code style={{ color: '#7dd3fc', background: '#020608', padding: '3px 7px', borderRadius: 4, display: 'block', direction: 'ltr', textAlign: 'left', margin: '4px 0 8px', wordBreak: 'break-all' }}>
          {installCmd}
        </code>
        <div style={{ fontWeight: 700, color: '#E2F0FB' }}>أو بالتحميل:</div>
        <div>1. حمّل السكريبت ⬇️</div>
        <div>2. ارفعه: <code style={{ color: '#00D4FF', background: '#070B12', padding: '1px 5px', borderRadius: 3 }}>scp install-{device.gatewayId}.sh root@{device.routerIp || '192.168.1.1'}:/tmp/</code></div>
        <div>3. اتصل: <code style={{ color: '#00D4FF', background: '#070B12', padding: '1px 5px', borderRadius: 3 }}>ssh root@{device.routerIp || '192.168.1.1'}</code></div>
        <div>4. شغّل: <code style={{ color: '#00D4FF', background: '#070B12', padding: '1px 5px', borderRadius: 3 }}>sh /tmp/install-{device.gatewayId}.sh</code></div>
        {device.wifiSSID && (
          <div style={{ color: '#00E676', marginTop: 4 }}>✅ السكريبت سيغير اسم الشبكة تلقائياً إلى: <strong>{device.wifiSSID}</strong> (2.4GHz + 5GHz)</div>
        )}
        <div style={{ marginTop: 4 }}>🧪 في الآخر السكريبت بيقيس كل حاجة بنفسه — استنى تشوف: <strong style={{ color: '#00E676' }}>🎉 النتيجة: كل حاجة تمام</strong></div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={copy} style={{ ...S.btn(copied ? '#00E676' : '#111B2D', copied ? '#000' : '#6B8CAE'), border: '1px solid #1C2A40' }}>
          {copied ? '✅ تم النسخ' : '📋 نسخ السكريبت'}
        </button>
        <button onClick={download} style={S.btn()}>
          ⬇️ تحميل install.sh
        </button>
        <button onClick={() => copyText(installCmd)} style={{ ...S.btn('#0E2A1C', '#00E676'), border: '1px solid rgba(0,230,118,0.3)' }}>
          ⚡ نسخ أمر التثبيت السريع
        </button>
      </div>

      {/* Script Preview */}
      <pre style={{ background: '#020608', border: '1px solid #0C1420', borderRadius: 10, padding: 12, fontFamily: 'monospace', fontSize: 11, color: '#7dd3fc', lineHeight: 1.7, overflowX: 'auto', maxHeight: 350, overflowY: 'auto', direction: 'ltr', textAlign: 'left', margin: 0 }}>
        {loading ? '⏳ جاري تحميل السكريبت...' : script || '❌ مش قادر يجيب السكريبت — اتأكد إن السيرفر بتاع الجهاز شغال'}
      </pre>
    </div>
  )
}

/* ════════════════════════════ نافذة تبديل السيرفر ════════════════════════════ */
function MigrateDialog({ fleet, sourceServer, admin, onClose, onMigrated }: {
  fleet: Fleet
  sourceServer: ServerInfo
  admin: Admin
  onClose: () => void
  onMigrated: () => void
}) {
  const mainDevice: Device | undefined = admin.devices?.[0]
  const others = fleet.servers.filter(s => s.key !== sourceServer.key)

  const [target,      setTarget]      = useState('')
  const [username,    setUsername]    = useState(admin.username)
  const [password,    setPassword]    = useState('')
  const [name,        setName]        = useState(admin.name)
  const [devName,     setDevName]     = useState(mainDevice?.name || admin.name)
  const [ssid,        setSsid]        = useState(mainDevice?.wifiSSID || '')
  const [location,    setLocation]    = useState(mainDevice?.location || '')
  const [withVouchers, setWithVouchers] = useState(true)
  const [busy,        setBusy]        = useState(false)
  const [vBusy,       setVBusy]       = useState(false)
  const [err,         setErr]         = useState('')
  const [result,      setResult]      = useState<{ adminId: string; device: { id: string; gatewayId: string; tunnelPort: number }; targetUrl: string; installCommand: string; existedAlready: boolean } | null>(null)
  const [vResult,     setVResult]     = useState<{ total: number; created: number; updated: number; remaining: number } | null>(null)
  const [copiedKey,   setCopiedKey]   = useState('')

  const voucherCount = admin._count?.vouchers || 0
  const targetUrl = fleet.servers.find(s => s.key === target)?.url || ''

  const doMigrate = async () => {
    setErr(''); setBusy(true)
    try {
      const r = await fetch('/api/setup/migrate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetServer: target,
          admin: { username, password, name, email: admin.email || undefined },
          device: { name: devName, location, wifiSSID: ssid },
        }),
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'فشل التبديل'); setBusy(false); return }
      setResult(d)
      setBusy(false)
    } catch { setErr('فشل الاتصال'); setBusy(false) }
  }

  const doVouchers = async () => {
    if (!result) return
    setErr(''); setVBusy(true)
    try {
      const r = await fetch('/api/setup/migrate-vouchers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetServer: target,
          targetAdminId: result.adminId,
          targetDeviceId: result.device.id,
          fromServer: sourceServer.key,
          fromAdminId: admin.id,
        }),
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'فشل نقل الكروت'); setVBusy(false); return }
      setVResult({ total: d.total, created: d.created, updated: d.updated, remaining: d.remaining })
      setVBusy(false)
    } catch { setErr('فشل الاتصال أثناء نقل الكروت'); setVBusy(false) }
  }

  const cp = async (key: string, t: string) => { await copyText(t); setCopiedKey(key); setTimeout(() => setCopiedKey(''), 2000) }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,12,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ ...S.card, width: 560, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#00D4FF' }}>🔁 تبديل سيرفر الكافيه</div>
          <button onClick={onClose} style={{ ...S.btn('#111B2D', '#6B8CAE'), border: '1px solid #1C2A40', padding: '5px 12px' }}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: '#6B8CAE', marginBottom: 16, lineHeight: 1.9 }}>
          بينقل <b style={{ color: '#E2F0FB' }}>{admin.name}</b> (@{admin.username}) من <ServerBadge serverKey={sourceServer.key} ok={sourceServer.ok} /> لسيرفر تاني
          <b> بنفس بيانات الدخول </b> — والحساب القديم بيفضل موجود زي ما هو (مش هيتلمس).
          بعد التبديل بتثبت السكربت الجديد على الراوتر فيبقى شغال على السيرفر الجديد فوراً.
        </div>

        {!result ? (
          <>
            {/* اختيار السيرفر الهدف */}
            <label style={S.label}>السيرفر الجديد (الهدف)</label>
            <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
              {others.map(sv => {
                const m = serverMeta(sv.key)
                return (
                  <button key={sv.key} disabled={!sv.ok} onClick={() => setTarget(sv.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: sv.ok ? 'pointer' : 'not-allowed',
                    background: target === sv.key ? `${m.color}12` : '#070B12',
                    border: target === sv.key ? `1px solid ${m.color}66` : '1px solid #1C2A40',
                    textAlign: 'right', fontFamily: 'Cairo,sans-serif', opacity: sv.ok ? 1 : 0.45,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 9, background: sv.ok ? '#00E676' : '#FF4444', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: target === sv.key ? m.color : '#E2F0FB' }}>{sv.label} <span style={{ color: '#354E6A', fontFamily: 'monospace', fontSize: 10 }}>({sv.url.replace('https://', '')})</span></div>
                      <div style={{ fontSize: 10, color: '#6B8CAE' }}>{sv.ok ? `شغال — ${sv.admins.length} كافيه` : `واقف: ${sv.error || 'غير متاح'}`}</div>
                    </div>
                    {target === sv.key && <span style={{ color: m.color, fontSize: 14 }}>✓</span>}
                  </button>
                )
              })}
            </div>

            {/* بيانات الكافيه — نفس البيانات القديمة */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={S.label}>اسم المستخدم (نفس القديم)</label>
                <input style={S.input} dir="ltr" value={username} onChange={e => setUsername(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>كلمة المرور (نفس القديم) *</label>
                <input style={S.input} dir="ltr" type="text" placeholder="مثال: Location@2024" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>اسم الكافيه</label>
                <input style={S.input} value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>اسم الجهاز</label>
                <input style={S.input} value={devName} onChange={e => setDevName(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>اسم شبكة الواي فاي (SSID)</label>
                <input style={S.input} dir="ltr" value={ssid} onChange={e => setSsid(e.target.value)} placeholder="مثال: Shola-WiFi" />
              </div>
              <div>
                <label style={S.label}>الموقع (اختياري)</label>
                <input style={S.input} value={location} onChange={e => setLocation(e.target.value)} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#E2F0FB', background: '#070B12', border: '1px solid #1C2A40', borderRadius: 10, padding: '10px 12px', marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={withVouchers} onChange={e => setWithVouchers(e.target.checked)} style={{ accentColor: '#00E676', width: 16, height: 16 }} />
              🎫 نقل كل كروت الكافيه كمان مع الحفاظ على حالتها ({voucherCount.toLocaleString('ar-EG')} كارت)
            </label>

            {err && <div style={{ color: '#f87171', fontSize: 12, background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.25)', borderRadius: 9, padding: '9px 12px', marginBottom: 12 }}>⚠️ {err}</div>}

            <button disabled={!target || !password || busy} onClick={doMigrate} style={{ ...S.btn(busy ? '#123' : '#0088CC'), width: '100%', justifyContent: 'center', padding: 12, opacity: !target || !password ? 0.5 : 1 }}>
              {busy ? '⏳ جاري الإنشاء على السيرفر الجديد...' : '🔁 ابدأ التبديل'}
            </button>
          </>
        ) : (
          <>
            {/* نجاح الإنشاء */}
            <div style={{ background: 'rgba(0,230,118,0.07)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#00E676', marginBottom: 8 }}>
                ✅ الكافيه اتعلم على السيرفر الجديد {result.existedAlready && '(الحساب كان موجود هناك — اتستخدم زي ما هو)'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#E2F0FB' }}>
                <div style={{ background: '#070B12', borderRadius: 8, padding: '8px 10px' }}>👤 <span style={{ color: '#6B8CAE' }}>اليوزر:</span> <code dir="ltr">{username}</code></div>
                <div style={{ background: '#070B12', borderRadius: 8, padding: '8px 10px' }}>🔑 <span style={{ color: '#6B8CAE' }}>الباسورد:</span> <code dir="ltr">{password}</code></div>
                <div style={{ background: '#070B12', borderRadius: 8, padding: '8px 10px' }}>🆔 <span style={{ color: '#6B8CAE' }}>GW جديد:</span> <code dir="ltr">{result.device.gatewayId}</code></div>
                <div style={{ background: '#070B12', borderRadius: 8, padding: '8px 10px' }}>🔌 <span style={{ color: '#6B8CAE' }}>بورت النفق:</span> <code dir="ltr">{result.device.tunnelPort}</code></div>
              </div>
            </div>

            <div style={{ background: 'rgba(0,136,204,0.06)', border: '1px solid rgba(0,136,204,0.25)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#00D4FF', marginBottom: 6 }}> آخر خطوة — ثبّت السكربت الجديد على الراوتر</div>
              <div style={{ fontSize: 11, color: '#6B8CAE', lineHeight: 1.9, marginBottom: 8 }}>
                ادخل على الراوتر بالـ SSH وشغّل الأمر ده — هيعيد توجيه الراوتر للسيرفر الجديد (<code dir="ltr" style={{ color: '#7dd3fc' }}>{targetUrl.replace('https://', '')}</code>) ويجيب نفس الإعدادات:
              </div>
              <code style={{ color: '#7dd3fc', background: '#020608', padding: '8px 10px', borderRadius: 7, display: 'block', direction: 'ltr', textAlign: 'left', wordBreak: 'break-all', fontSize: 11, marginBottom: 8 }}>
                {result.installCommand}
              </code>
              <button onClick={() => cp('cmd', result.installCommand)} style={{ ...S.btn(copiedKey === 'cmd' ? '#00E676' : '#111B2D', copiedKey === 'cmd' ? '#000' : '#6B8CAE'), border: '1px solid #1C2A40', fontSize: 11 }}>
                {copiedKey === 'cmd' ? '✅ تم النسخ' : '📋 نسخ أمر التثبيت'}
              </button>
            </div>

            {/* نقل الكروت */}
            {withVouchers && voucherCount > 0 && !vResult && (
              <button onClick={doVouchers} disabled={vBusy} style={{ ...S.btn(vBusy ? '#123' : '#0E2A1C', '#00E676'), width: '100%', justifyContent: 'center', padding: 12, border: '1px solid rgba(0,230,118,0.35)', marginBottom: 10 }}>
                {vBusy ? `⏳ جاري نقل ${voucherCount.toLocaleString('ar-EG')} كارت... (ممكن ياخد دقيقة)` : `🎫 انقل الكروت دلوقتي (${voucherCount.toLocaleString('ar-EG')} كارت)`}
              </button>
            )}
            {vResult && (
              <div style={{ background: 'rgba(0,230,118,0.07)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 12, color: '#E2F0FB', lineHeight: 2 }}>
                🎫 <b style={{ color: '#00E676' }}>الكروت اتنقلت:</b> {vResult.total.toLocaleString('ar-EG')} كارت (جديد {vResult.created.toLocaleString('ar-EG')} — تحديث {vResult.updated.toLocaleString('ar-EG')})
                {vResult.remaining > 0 && <div style={{ color: '#f59e0b' }}>⚠️ فاضل {vResult.remaining.toLocaleString('ar-EG')} كارت — دوس النقل تاني (النقل آمن للتكرار)</div>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { onMigrated(); onClose() }} style={{ ...S.btn(), flex: 1, justifyContent: 'center', padding: 11 }}>
                ✅ تمام — حدّث القايمة
              </button>
              <a href={`${result.targetUrl}/dashboard`} target="_blank" rel="noreferrer" style={{ ...S.btn('#111B2D', '#6B8CAE'), border: '1px solid #1C2A40', textDecoration: 'none' }}>
                🏪 فتح لوحة الكافيه الجديدة
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════ شاشة الدخول ════════════════════════════ */
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [pass, setPass] = useState('')
  const [err,  setErr]  = useState('')
  const PASS = process.env.NEXT_PUBLIC_SETUP_PASS || 'setup@2024'
  const check = () => { if (pass === PASS) onLogin(); else setErr('كلمة المرور خاطئة') }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#070B12', fontFamily: 'Cairo,sans-serif', direction: 'rtl' }}>
      <div style={{ ...S.card, width: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48 }}>📜</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#00D4FF', margin: '8px 0 0' }}>سكريبتات الإعداد</h1>
          <p style={{ fontSize: 12, color: '#354E6A', marginTop: 6 }}>كل السيرفرات + سكربتات كل الأجهزة + تبديل السيرفرات</p>
        </div>
        <label style={S.label}>كلمة المرور</label>
        <input style={{ ...S.input, marginBottom: 12 }} type="password"
          value={pass} onChange={e => { setPass(e.target.value); setErr('') }}
          onKeyDown={e => e.key === 'Enter' && check()} autoFocus placeholder="••••••••" />
        {err && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>⚠️ {err}</div>}
        <button style={{ ...S.btn(), width: '100%', justifyContent: 'center', padding: 12 }} onClick={check}>دخول</button>
        <p style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#354E6A' }}>
          الباسورد: <code style={{ color: '#6B8CAE' }}>setup@2024</code>
        </p>
      </div>
    </div>
  )
}

/* ════════════════════════════ الصفحة الرئيسية ════════════════════════════ */
export default function SetupPage() {
  const [authed,   setAuthed]   = useState(false)
  const [fleet,    setFleet]    = useState<Fleet | null>(null)
  const [fleetErr, setFleetErr] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [sel,      setSel]      = useState<{ serverKey: string; adminId: string } | null>(null)
  const [migrating, setMigrating] = useState<{ serverKey: string; adminId: string } | null>(null)
  const [vpsIp,    setVpsIp]    = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      if (host !== 'localhost' && host !== '127.0.0.1') setVpsIp(host)
      const saved = localStorage.getItem('setup-vps-ip')
      if (saved) setVpsIp(saved)
    }
  }, [])

  const loadFleet = useCallback(async () => {
    setLoading(true); setFleetErr('')
    try {
      const r = await fetch('/api/setup/fleet', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok || !d.servers) { setFleetErr(d.error || 'فشل جمع بيانات السيرفرات'); setFleet(null) }
      else { setFleet(d); setFleetErr('') }
    } catch { setFleetErr('فشل الاتصال بالسيرفر') }
    setLoading(false)
  }, [])

  const handleLogin = () => { setAuthed(true); loadFleet() }

  // الاختيار الحالي
  const selServer = fleet?.servers.find(s => s.key === sel?.serverKey)
  const selAdmin  = selServer?.admins.find(a => a.id === sel?.adminId)

  // كل أجهزة الفليت (لمربع النفق + العدادات)
  const allTunnels = (fleet?.servers || []).flatMap(sv =>
    sv.admins.flatMap(a => (a.devices || []).map(d => ({ gw: d.gatewayId, port: d.tunnelPort, serverKey: sv.key })))
  ).filter((t): t is { gw: string; port: number; serverKey: string } => !!t.port)

  if (!authed) return <LoginScreen onLogin={handleLogin} />

  return (
    <div style={{ minHeight: '100vh', background: '#070B12', fontFamily: 'Cairo,sans-serif', direction: 'rtl' }}>

      {/* Header */}
      <div style={{ background: '#0C1420', borderBottom: '1px solid #1C2A40', padding: '0 20px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📜</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#00D4FF' }}>سكريبتات إعداد الأجهزة — كل السيرفرات</div>
            <div style={{ fontSize: 10, color: '#354E6A' }}>wifidog + SSH Tunnel + تبديل السيرفرات</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {fleet && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
              background: fleet.okServers === fleet.serverCount ? 'rgba(0,230,118,0.1)' : 'rgba(245,158,11,0.1)',
              color: fleet.okServers === fleet.serverCount ? '#00E676' : '#f59e0b',
              border: `1px solid ${fleet.okServers === fleet.serverCount ? 'rgba(0,230,118,0.25)' : 'rgba(245,158,11,0.25)'}`,
            }}>
              {fleet.okServers === fleet.serverCount ? '🟢' : '🟠'} السيرفرات: {fleet.okServers}/{fleet.serverCount} — {fleet.totalAdmins} كافيه / {fleet.totalDevices} جهاز
            </span>
          )}
          <span style={{ fontSize: 11, color: '#6B8CAE' }}>VPS IP:</span>
          <input value={vpsIp} onChange={e => { setVpsIp(e.target.value); localStorage.setItem('setup-vps-ip', e.target.value) }} placeholder="1.2.3.4"
            style={{ ...S.input, width: 120, padding: '5px 10px', fontSize: 12, fontFamily: 'monospace', direction: 'ltr' }} />
          <button onClick={loadFleet} disabled={loading} style={{ ...S.btn('#111B2D', '#6B8CAE'), border: '1px solid #1C2A40', fontSize: 11, padding: '6px 12px' }}>
            {loading ? '⏳' : '🔄'} تحديث
          </button>
          <button style={{ ...S.btn('#1C2A40', '#f87171'), border: '1px solid rgba(248,113,113,0.3)', fontSize: 11, padding: '6px 12px' }}
            onClick={() => setAuthed(false)}>خروج</button>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 54px)' }}>

        {/* Sidebar — السيرفرات والأدمنز */}
        <div style={{ width: 230, background: '#0C1420', borderLeft: '1px solid #1C2A40', padding: '14px 10px', flexShrink: 0, overflowY: 'auto', maxHeight: 'calc(100vh - 54px)' }}>
          {loading && !fleet && <div style={{ fontSize: 11, color: '#6B8CAE', padding: '0 6px' }}>⏳ جاري جمع بيانات السيرفرات الأربعة...</div>}
          {fleetErr && !fleet && (
            <div style={{ fontSize: 11, color: '#f87171', padding: 10, background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 9, lineHeight: 1.8 }}>
              ⚠️ {fleetErr}
              <button onClick={loadFleet} style={{ ...S.btn('#111B2D', '#00D4FF'), border: '1px solid #1C2A40', width: '100%', justifyContent: 'center', marginTop: 8, fontSize: 11 }}>🔄 إعادة المحاولة</button>
            </div>
          )}
          {fleet && fleet.servers.map(sv => {
            const m = serverMeta(sv.key)
            return (
              <div key={sv.key} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px', marginBottom: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 9, background: sv.ok ? '#00E676' : '#FF4444', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: m.color }}>{sv.label}</span>
                  {sv.self && <span style={{ fontSize: 9, background: '#111B2D', color: '#6B8CAE', borderRadius: 4, padding: '1px 5px' }}>هنا</span>}
                  {!sv.ok && <span style={{ fontSize: 9, color: '#FF4444' }}>واقف</span>}
                </div>
                {sv.ok && sv.admins.length === 0 && <div style={{ fontSize: 10, color: '#354E6A', padding: '0 6px' }}>لا يوجد كافيهات</div>}
                {sv.admins.map(a => {
                  const selected = sel?.serverKey === sv.key && sel?.adminId === a.id
                  return (
                    <button key={`${sv.key}-${a.id}`} onClick={() => setSel({ serverKey: sv.key, adminId: a.id })} style={{
                      width: '100%', padding: '8px 10px', borderRadius: 9, cursor: 'pointer',
                      background: selected ? '#111B2D' : 'transparent',
                      border: selected ? `1px solid ${m.color}55` : '1px solid transparent',
                      color: selected ? m.color : '#6B8CAE',
                      fontFamily: 'Cairo,sans-serif', fontSize: 12, fontWeight: 600,
                      textAlign: 'right', marginBottom: 3,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span>👤</span>
                      <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                          {!a.isActive && <span style={{ fontSize: 9, color: '#FF4444' }}>موقوف</span>}
                        </div>
                        <div style={{ fontSize: 10, color: '#354E6A', display: 'flex', gap: 8 }}>
                          <span>@{a.username}</span>
                          <span>🖥️ {(a.devices || []).length}</span>
                          {!!a._count?.vouchers && <span>🎫 {a._count.vouchers > 999 ? `${(a._count.vouchers / 1000).toFixed(1)}k` : a._count.vouchers}</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}

          {/* نفق SSH — كل الأجهزة ديناميكياً */}
          {allTunnels.length > 0 && (
            <div style={{ marginTop: 16, padding: 10, background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: 9, fontSize: 11, color: '#6B8CAE', lineHeight: 1.9 }}>
              <div style={{ fontWeight: 700, color: '#00E676', marginBottom: 4 }}>🔌 أنفاق SSH ({allTunnels.length})</div>
              {allTunnels.slice(0, 12).map(t => (
                <div key={t.gw} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontFamily: 'monospace', fontSize: 10 }}>
                  <span style={{ color: '#354E6A' }}>{serverMeta(t.serverKey).short}</span>
                  <span dir="ltr">{t.gw} → {t.port}</span>
                </div>
              ))}
              {allTunnels.length > 12 && <div style={{ color: '#354E6A' }}>+{allTunnels.length - 12} تاني</div>}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          {!selServer || !selAdmin ? (
            <div style={{ ...S.card, textAlign: 'center', padding: 60, color: '#6B8CAE' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>📜</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#E2F0FB', marginBottom: 8 }}>اختر كافيه من القائمة</div>
              <div style={{ fontSize: 13 }}>
                هتظهرلك سكربتات إعداد كل أجهزته — والكافيهات من <b style={{ color: '#00E676' }}>السيرفرات الأربعة كلها</b> معروضة هنا
              </div>
              {fleet && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                  {fleet.servers.map(sv => <ServerBadge key={sv.key} serverKey={sv.key} ok={sv.ok} />)}
                </div>
              )}
            </div>
          ) : loading && !fleet ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#6B8CAE' }}>⏳ جاري التحميل...</div>
          ) : (
            <div>
              {/* رأس الكافيه */}
              <div style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#E2F0FB', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {selAdmin.name}
                    <ServerBadge serverKey={selServer.key} ok={selServer.ok} />
                    {!selAdmin.isActive && <span style={{ fontSize: 11, color: '#FF4444' }}>⚠️ موقوف</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B8CAE', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span dir="ltr">@{selAdmin.username}</span>
                    <span>🖥️ {(selAdmin.devices || []).length} جهاز</span>
                    {!!selAdmin._count?.vouchers && <span>🎫 {selAdmin._count.vouchers.toLocaleString('ar-EG')} كارت</span>}
                    <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{selServer.url.replace('https://', '')}</span>
                  </div>
                  {selAdmin.devicesError && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>⚠️ فشل تحميل أجهزة هذا الكافيه من سيرفره</div>}
                </div>
                <button onClick={() => setMigrating({ serverKey: selServer.key, adminId: selAdmin.id })}
                  style={{ ...S.btn('#0E2A1C', '#00E676'), border: '1px solid rgba(0,230,118,0.35)' }}>
                  🔁 تبديل سيرفر الكافيه
                </button>
              </div>

              {/* أجهزة الكافيه */}
              {(selAdmin.devices || []).length === 0 ? (
                <div style={{ ...S.card, textAlign: 'center', padding: 60, color: '#6B8CAE' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🖥️</div>
                  <p>لا يوجد أجهزة لهذا الكافيه</p>
                </div>
              ) : (
                selAdmin.devices!.map(d => (
                  <DeviceScript key={d.id} device={d} serverKey={selServer.key} serverUrl={selServer.url} vpsIp={vpsIp} />
                ))
              )}

              {/* ملاحظة التبديل */}
              <div style={{ background: 'rgba(0,136,204,0.05)', border: '1px solid rgba(0,136,204,0.15)', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: '#6B8CAE', lineHeight: 1.9 }}>
                💡 <b style={{ color: '#00D4FF' }}>عايز تنقل الكافيه ده لسيرفر تاني؟</b> (لو السيرفر الحالي فيه مشكلة أو الباقة المجانية خلصت)
                — دوس <b style={{ color: '#00E676' }}>🔁 تبديل سيرفر الكافيه</b> فوق: بينقل الحساب بنفس البيانات + الكروت كلها، ويطلعلك أمر تثبيت واحد تلصقه على الراوتر فيتحول للسيرفر الجديد.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* نافذة التبديل */}
      {migrating && fleet && (() => {
        const sv = fleet.servers.find(s => s.key === migrating.serverKey)
        const ad = sv?.admins.find(a => a.id === migrating.adminId)
        if (!sv || !ad) return null
        return (
          <MigrateDialog
            fleet={fleet}
            sourceServer={sv}
            admin={ad}
            onClose={() => setMigrating(null)}
            onMigrated={loadFleet}
          />
        )
      })()}
    </div>
  )
}
