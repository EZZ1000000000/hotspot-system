'use client'
// ═══ كارت الحماية من انهيار قواعد البيانات — لوحة السوبر أدمن ═══
// بيعرض حالة القاعدة على كل سيرفر + النسخ الاحتياطية المتبادلة
// + أزرار: مزامنة الآن / استرجاع آخر نسخة / تحويل لقاعدة احتياطية
import { useState, useEffect, useCallback } from 'react'

type ClusterInfo = {
  selfKey?: string
  active?: string
  healthy?: boolean
  standbys?: string[]
  standbyCount?: number
  lastEvent?: any
  backups?: { server: string; exportedAt: string; storedAt: string; bytes?: number }[]
  lastSync?: { at: string; errors?: number } | null
  error?: string
}

const SRV = [
  { key: 'gamma', label: 'الرئيسي (ليالينا)', color: '#00D4FF' },
  { key: 'kappa', label: 'الشعلة',           color: '#fb923c' },
  { key: 'dun',   label: 'السرايا',          color: '#00E676' },
  { key: 'seven', label: 'البرنس',           color: '#818cf8' },
]

const card: React.CSSProperties = { background: '#0C1420', border: '1px solid #1C2A40', borderRadius: 14, padding: 14 }
const mini: React.CSSProperties = { background: '#070B12', border: '1px solid #1C2A40', borderRadius: 10, padding: 10 }
const btnS: React.CSSProperties = { padding: '5px 10px', border: 'none', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Cairo,sans-serif' }

function ago(iso?: string): string {
  if (!iso) return '—'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'قبل لحظات'
  if (s < 3600) return `منذ ${Math.floor(s / 60)} د`
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} س`
  return `منذ ${Math.floor(s / 86400)} يوم`
}

export default function ClusterCard() {
  const [data, setData] = useState<Record<string, ClusterInfo | null>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string>('')
  const [msg, setMsg] = useState<string>('')
  const [confirmRestore, setConfirmRestore] = useState<string>('')
  const [showAdd, setShowAdd] = useState<string>('')
  const [standbyInput, setStandbyInput] = useState<string>('')

  const call = useCallback(async (srv: string, path: string, method: string, body?: any): Promise<any> => {
    if (srv === 'gamma') {
      const r = await fetch(path, { method, headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined })
      return r.json().catch(() => ({}))
    }
    const r = await fetch('/api/superadmin/remote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ server: srv, path, method, body }) })
    const d = await r.json().catch(() => ({}))
    return d?.__proxy ? d.data : d
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const out: Record<string, ClusterInfo | null> = {}
    await Promise.all(SRV.map(async s => {
      try { out[s.key] = await call(s.key, '/api/superadmin/cluster', 'GET') } catch { out[s.key] = null }
    }))
    setData(out)
    setLoading(false)
  }, [call])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, 120000)
    return () => clearInterval(t)
  }, [load])

  const act = async (srv: string, action: string, extra?: any) => {
    setBusy(srv + ':' + action)
    setMsg('')
    try {
      const r = await call(srv, '/api/superadmin/cluster', 'POST', { action, ...extra })
      if (action === 'sync' && r?.success) {
        const rep = r.report || {}
        const sib = (rep.siblings || []).map((s: any) => `${s.key}:${s.ok ? '✓' : '✗'}`).join(' ')
        setMsg(`⚡ مزامنة ${srv} خلصت — السيرفرات التانية: ${sib || '—'}${rep.errors ? ` (${rep.errors} أخطاء)` : ''}`)
      } else if (action === 'restore') {
        setMsg(r?.restored
          ? `♻️ ${srv}: تم الاسترجاع من ${r.source === srv ? 'نسخته' : ('سيرفر ' + r.source)} — ${Object.entries(r.counts || {}).map(([k, v]: any) => `${k}:${v}`).slice(0, 6).join(' · ')}`
          : `♻️ ${srv}: مفيش نسخة استرجعها${r?.err ? ` (${r.err})` : ''}`)
      } else if (action === 'switch') {
        setMsg(`🔁 ${srv}: تم التحويل إلى ${r?.status?.active || '—'}`)
      } else if (action === 'addStandby') {
        setMsg(r?.success ? `➕ ${srv}: القاعدة الاحتياطية اتسجلت${r?.schemaPlanted ? ' وزُرعت فيها السكيما ✅' : ''}${r?.err ? ` (${r.err})` : ''}` : `➕ ${srv}: ${r?.error || 'فشل'}`)
      } else if (action === 'removeStandby') {
        setMsg(`➖ ${srv}: اتشالت من قائمة الاحتياط`)
      } else if (r?.error) {
        setMsg(`❌ ${srv}: ${r.error}`)
      }
    } catch {
      setMsg(`❌ ${srv}: فشل الاتصال بالسيرفر`)
    }
    setBusy(''); setConfirmRestore(''); setStandbyInput(''); setShowAdd('')
    load()
  }

  const totalHealthy = SRV.filter(s => data[s.key]?.healthy).length
  const totalWithBackup = SRV.filter(s => (data[s.key]?.backups || []).length > 0).length

  return (
    <div style={{ ...card, marginBottom: 12, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 900, color: '#E2F0FB' }}>🛡️ الحماية من انهيار القواعد</span>
        <span style={{ fontSize: 10, color: '#6B8CAE' }}>نسخ احتياطي متبادل كل 30 دقيقة + قلب تلقائي لو قاعدة ماتت</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: totalHealthy === 4 ? '#00E676' : '#fb923c', fontWeight: 700 }}>القواعد الشغالة: {totalHealthy}/4</span>
        <span style={{ fontSize: 10, color: totalWithBackup === 4 ? '#00E676' : '#6B8CAE' }}>عندها نسخ محفوظة: {totalWithBackup}/4</span>
        <button onClick={load} disabled={loading} style={{ ...btnS, background: '#111B2D', color: '#6B8CAE', border: '1px solid #1C2A40' }}>{loading ? '⏳' : '🔄'}</button>
      </div>

      {msg && <div style={{ padding: '7px 10px', borderRadius: 8, marginBottom: 8, background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', color: '#7dd3fc', fontSize: 11 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8 }}>
        {SRV.map(s => {
          const d = data[s.key]
          const healthy = !!d?.healthy
          const backups = d?.backups || []
          const isBusy = busy.startsWith(s.key + ':')
          return (
            <div key={s.key} style={mini}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: healthy ? '#00E676' : '#FF4444', display: 'inline-block' }} />
                <span style={{ fontSize: 11, fontWeight: 900, color: s.color }}>{s.label}</span>
                <span style={{ flex: 1 }} />
                {isBusy && <span style={{ fontSize: 9, color: '#6B8CAE' }}>⏳ جاري…</span>}
              </div>
              <div style={{ fontSize: 9, color: '#6B8CAE', marginBottom: 3, fontFamily: 'monospace', direction: 'ltr', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d?.active || (d?.error ? '❌ ' + d.error.slice(0, 40) : '—')}
              </div>
              <div style={{ fontSize: 9, color: '#6B8CAE', marginBottom: 5 }}>
                {d?.lastSync?.at ? `🔄 آخر مزامنة: ${ago(d.lastSync.at)}` : '🔄 لم تتم مزامنة بعد'}
                {d?.standbyCount ? ` · 🛟 احتياطية: ${d.standbyCount}` : ''}
                {d?.lastEvent?.to && !d?.lastEvent?.reason?.includes('manual') ? '' : ''}
              </div>
              <div style={{ fontSize: 9, color: '#354E6A', marginBottom: 6 }}>
                نسخ محفوظة هنا: {backups.length === 0 ? 'لا يوجد' : backups.map((b, i) => (
                  <span key={i} style={{ color: '#7dd3fc' }}>{b.server} ({ago(b.exportedAt)}){i < backups.length - 1 ? ' · ' : ''}</span>
                ))}
              </div>
              {d?.lastEvent?.at && (
                <div style={{ fontSize: 9, color: '#fb923c', marginBottom: 6 }}>
                  ⚡ آخر تحويل: {ago(d.lastEvent.at)} — {d.lastEvent.from} → {d.lastEvent.to}{d.lastEvent.restored ? ' + استرجاع بيانات ✅' : ''}
                </div>
              )}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button onClick={() => act(s.key, 'sync')} disabled={isBusy} style={{ ...btnS, background: 'rgba(0,212,255,0.1)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.25)' }}>⚡ مزامنة</button>
                <button
                  onClick={() => confirmRestore === s.key ? act(s.key, 'restore') : setConfirmRestore(s.key)}
                  disabled={isBusy}
                  style={{ ...btnS, background: confirmRestore === s.key ? '#fb923c' : 'rgba(251,146,60,0.1)', color: confirmRestore === s.key ? '#000' : '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
                  {confirmRestore === s.key ? 'متأكد؟ اضغط تاني' : '♻️ استرجاع'}
                </button>
                {(d?.standbyCount || 0) > 0 && (
                  <button onClick={() => act(s.key, 'switch')} disabled={isBusy} style={{ ...btnS, background: 'rgba(0,230,118,0.1)', color: '#00E676', border: '1px solid rgba(0,230,118,0.25)' }}>🔁 تحويل</button>
                )}
                <button onClick={() => setShowAdd(showAdd === s.key ? '' : s.key)} disabled={isBusy} style={{ ...btnS, background: '#111B2D', color: '#6B8CAE', border: '1px solid #1C2A40' }}>➕ قاعدة</button>
              </div>
              {showAdd === s.key && (
                <div style={{ marginTop: 6 }}>
                  <input
                    value={standbyInput}
                    onChange={e => setStandbyInput(e.target.value)}
                    placeholder="postgresql://user:pass@host/db?sslmode=require"
                    style={{ width: '100%', padding: '6px 9px', background: '#070B12', border: '1px solid #1C2A40', borderRadius: 7, color: '#E2F0FB', fontSize: 9, fontFamily: 'monospace', direction: 'ltr', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button onClick={() => standbyInput && act(s.key, 'addStandby', { url: standbyInput })} disabled={isBusy || !standbyInput} style={{ ...btnS, background: 'rgba(0,230,118,0.15)', color: '#00E676' }}>تسجيل</button>
                    <button onClick={() => act(s.key, 'removeStandby', { url: standbyInput })} disabled={isBusy || !standbyInput} style={{ ...btnS, background: 'rgba(255,68,68,0.1)', color: '#FF6666' }}>إزالة</button>
                  </div>
                  <div style={{ fontSize: 8, color: '#354E6A', marginTop: 3 }}>الرابط بيتخزن في قاعدة السيرفر ده — وبيتستخدم تلقائياً وقت الفشل</div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 9, color: '#354E6A', marginTop: 8, lineHeight: 1.6 }}>
        🛡️ لو قاعدة أي سيرفر ماتت: النظام بيقلب لوحده على القاعدة الاحتياطية المسجلة، ولو كانت فاضية بيزرع السكيما ويسحب آخر نسخة من باقي السيرفرات — من غير ما حد يتدخل. كمان كل سيرفر شايل نسخة كاملة من التلاتة التانيين.
      </div>
    </div>
  )
}
