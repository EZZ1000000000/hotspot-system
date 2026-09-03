'use client'
import { useState, useEffect } from 'react'

type Device = {
  id: string; name: string; gatewayId: string
  routerIp: string; wifiSSID?: string; location?: string
  isActive: boolean
  gatewayInterface: string; externalInterface: string; clientTimeout: number
  tunnelPort?: number
}
type Admin = { id: string; name: string; username: string }

const S = {
  card:  { background: '#0C1420', border: '1px solid #1C2A40', borderRadius: 14, padding: 20 } as React.CSSProperties,
  input: { width: '100%', padding: '10px 13px', background: '#070B12', border: '1px solid #1C2A40', borderRadius: 9, color: '#E2F0FB', fontFamily: 'Cairo,sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const },
  label: { display: 'block', fontSize: 11, color: '#6B8CAE', marginBottom: 5 } as React.CSSProperties,
  btn:   (bg = '#0088CC', c = '#000') => ({ padding: '9px 16px', background: bg, border: 'none', borderRadius: 9, color: c, fontFamily: 'Cairo,sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 } as React.CSSProperties),
}


// ══════════════════════════════════════════════════
function DeviceScript({ device, vpsIp }: {
  device: Device; vpsIp: string
}) {
  const [copied,    setCopied]    = useState(false)
  const [script,    setScript]    = useState('')
  const [loading,   setLoading]   = useState(true)

  // السكربت الموحد الشامل من السيرفر — مصدر واحد للحقيقة
  // (نفس السكربت اللي في تاب السكريبت في لوحة التحكم — تسطيب + إصلاح في واحد)
  useEffect(() => {
    let alive = true
    fetch(`/api/admin/config?deviceId=${device.id}&type=script`)
      .then(r => r.text())
      .then(t => { if (alive) { setScript(t); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [device.id])

  const copy     = async () => { await navigator.clipboard.writeText(script); setCopied(true); setTimeout(() => setCopied(false), 2500) }
  const download = () => { const b = new Blob([script], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `install-${device.gatewayId}.sh`; a.click() }

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#E2F0FB' }}>{device.name}</div>
          <div style={{ fontSize: 11, color: '#6B8CAE', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>🌐 {device.routerIp}</span>
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
          <div style={{ fontSize: 10, color: '#354E6A', marginTop: 3, fontFamily: 'monospace', display: 'flex', gap: 12 }}>
            <span>ID: {device.gatewayId}</span>
            {device.tunnelPort && <span style={{ color: '#00E676' }}>🔌 Port: {device.tunnelPort}</span>}
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
          wget -q -O /tmp/hotspot.sh &quot;https://{typeof window !== 'undefined' ? window.location.host : ''}/api/admin/config?deviceId={device.id}&type=script&quot; && sh /tmp/hotspot.sh
        </code>
        <div style={{ fontWeight: 700, color: '#E2F0FB' }}>أو بالتحميل:</div>
        <div>1. حمّل السكريبت ⬇️</div>
        <div>2. ارفعه: <code style={{ color: '#00D4FF', background: '#070B12', padding: '1px 5px', borderRadius: 3 }}>scp install-{device.gatewayId}.sh root@{device.routerIp}:/tmp/</code></div>
        <div>3. اتصل: <code style={{ color: '#00D4FF', background: '#070B12', padding: '1px 5px', borderRadius: 3 }}>ssh root@{device.routerIp}</code></div>
        <div>4. شغّل: <code style={{ color: '#00D4FF', background: '#070B12', padding: '1px 5px', borderRadius: 3 }}>sh /tmp/install-{device.gatewayId}.sh</code></div>
        {device.wifiSSID && (
          <div style={{ color: '#00E676', marginTop: 4 }}>✅ السكريبت سيغير اسم الشبكة تلقائياً إلى: <strong>{device.wifiSSID}</strong> (2.4GHz + 5GHz)</div>
        )}
        <div style={{ marginTop: 4 }}>🧪 في الآخر السكريبت بيقيس كل حاجة بنفسه — استنى تشوف: <strong style={{ color: '#00E676' }}>🎉 النتيجة: كل حاجة تمام</strong></div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={copy} style={{ ...S.btn(copied ? '#00E676' : '#111B2D', copied ? '#000' : '#6B8CAE'), border: '1px solid #1C2A40' }}>
          {copied ? '✅ تم النسخ' : '📋 نسخ السكريبت'}
        </button>
        <button onClick={download} style={S.btn()}>
          ⬇️ تحميل install.sh
        </button>
      </div>

      {/* Script Preview */}
      <pre style={{ background: '#020608', border: '1px solid #0C1420', borderRadius: 10, padding: 12, fontFamily: 'monospace', fontSize: 11, color: '#7dd3fc', lineHeight: 1.7, overflowX: 'auto', maxHeight: 350, overflowY: 'auto', direction: 'ltr', textAlign: 'left', margin: 0 }}>
        {loading ? '⏳ جاري تحميل السكريبت...' : script || '❌ مش قادر يجيب السكريبت — اتأكد إن الجهاز متسجل في السستم'}
      </pre>
    </div>
  )
}

// ══════════════════════════════════════════════════
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
          <p style={{ fontSize: 12, color: '#354E6A', marginTop: 6 }}>wifidog + SSH Tunnel</p>
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

// ══════════════════════════════════════════════════
export default function SetupPage() {
  const [authed,   setAuthed]   = useState(false)
  const [admins,   setAdmins]   = useState<Admin[]>([])
  const [selAdmin, setSelAdmin] = useState('')
  const [devices,  setDevices]  = useState<Device[]>([])
  const [loading,  setLoading]  = useState(false)
  const [vpsIp,    setVpsIp]    = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      if (host !== 'localhost' && host !== '127.0.0.1') setVpsIp(host)
    }
  }, [])

  const loadAdmins = async () => {
    const r = await fetch('/api/superadmin/admins')
    const d = await r.json()
    if (Array.isArray(d)) setAdmins(d)
  }

  const loadDevices = async (id: string) => {
    setSelAdmin(id); setLoading(true)
    const r = await fetch(`/api/admin/devices?adminId=${id}`)
    const d = await r.json()
    if (Array.isArray(d)) setDevices(d)
    setLoading(false)
  }

  const handleLogin = () => { setAuthed(true); loadAdmins() }
  if (!authed) return <LoginScreen onLogin={handleLogin} />

  return (
    <div style={{ minHeight: '100vh', background: '#070B12', fontFamily: 'Cairo,sans-serif', direction: 'rtl' }}>

      {/* Header */}
      <div style={{ background: '#0C1420', borderBottom: '1px solid #1C2A40', padding: '0 20px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📜</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#00D4FF' }}>سكريبتات إعداد الأجهزة</div>
            <div style={{ fontSize: 10, color: '#354E6A' }}>wifidog + SSH Tunnel</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#6B8CAE' }}>VPS IP:</span>
          <input value={vpsIp} onChange={e => setVpsIp(e.target.value)} placeholder="1.2.3.4"
            style={{ ...S.input, width: 130, padding: '5px 10px', fontSize: 12, fontFamily: 'monospace', direction: 'ltr' }} />
          <button style={{ ...S.btn('#1C2A40', '#f87171'), border: '1px solid rgba(248,113,113,0.3)', fontSize: 11, padding: '6px 12px' }}
            onClick={() => setAuthed(false)}>خروج</button>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 54px)' }}>

        {/* Sidebar */}
        <div style={{ width: 200, background: '#0C1420', borderLeft: '1px solid #1C2A40', padding: '14px 10px', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#6B8CAE', fontWeight: 700, marginBottom: 10, padding: '0 6px' }}>الأدمنز</div>
          {admins.length === 0
            ? <div style={{ fontSize: 11, color: '#354E6A', padding: '0 6px' }}>لا يوجد أدمنز</div>
            : admins.map(a => (
              <button key={a.id} onClick={() => loadDevices(a.id)} style={{
                width: '100%', padding: '9px 10px', borderRadius: 9, cursor: 'pointer',
                background: selAdmin === a.id ? '#111B2D' : 'transparent',
                border: selAdmin === a.id ? '1px solid #1C2A40' : '1px solid transparent',
                color: selAdmin === a.id ? '#00D4FF' : '#6B8CAE',
                fontFamily: 'Cairo,sans-serif', fontSize: 12, fontWeight: 600,
                textAlign: 'right', marginBottom: 3,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span>👤</span>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div>{a.name}</div>
                  <div style={{ fontSize: 10, color: '#354E6A' }}>@{a.username}</div>
                </div>
              </button>
            ))
          }
          <div style={{ marginTop: 20, padding: 10, background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: 9, fontSize: 11, color: '#6B8CAE', lineHeight: 1.8 }}>
            <div style={{ fontWeight: 700, color: '#00E676', marginBottom: 4 }}>🔌 SSH Tunnel</div>
            <div style={{ color: '#354E6A' }}>
              الراوتر 1 → 2201<br />
              الراوتر 2 → 2202<br />
              الراوتر 3 → 2203
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          {!vpsIp && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#f59e0b' }}>
              ⚠️ اكتب IP الـ VPS في الأعلى عشان السكريبت يبقى صح
            </div>
          )}
          {!selAdmin ? (
            <div style={{ ...S.card, textAlign: 'center', padding: 60, color: '#6B8CAE' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>📜</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#E2F0FB', marginBottom: 8 }}>اختر أدمن من القائمة</div>
              <div style={{ fontSize: 13 }}>هتظهرلك سكريبت إعداد كل جهاز</div>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#6B8CAE' }}>⏳ جاري التحميل...</div>
          ) : devices.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', padding: 60, color: '#6B8CAE' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🖥️</div>
              <p>لا يوجد أجهزة لهذا الأدمن</p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: '#6B8CAE', marginBottom: 14 }}>
                {devices.length} جهاز — {admins.find(a => a.id === selAdmin)?.name}
              </div>
              {devices.map(d => (
                <DeviceScript key={d.id} device={d} vpsIp={vpsIp} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
