'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Voucher = {
  id: string; code: string
  dataLimitMB: number | null; timeLimitMin: number | null
  speedLimitMbps: number | null; maxUsageCount: number
  packageType: string; createdAt: string
}

const TEMPLATES = [
  { id: 'dark',    name: 'داكن' },
  { id: 'blue',    name: 'أزرق' },
  { id: 'minimal', name: 'بسيط' },
  { id: 'receipt', name: 'إيصال' },
  { id: 'elegant', name: 'أنيق' },
]

const fmt = {
  data: (mb: number | null) => !mb ? '∞' : mb >= 1024 ? (mb / 1024).toFixed(1) + 'GB' : mb + 'MB',
  time: (m: number | null) => !m ? '∞' : m >= 60 ? Math.floor(m / 60) + 'س' + (m % 60 ? m % 60 + 'د' : '') : m + 'د',
}

function VCard({ v, tpl, biz, logo }: { v: Voucher; tpl: string; biz: string; logo: string }) {
  const B: React.CSSProperties = { fontFamily: 'Cairo,sans-serif', breakInside: 'avoid', pageBreakInside: 'avoid', width: '100%', boxSizing: 'border-box' }
  const specs = <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 11, flexWrap: 'wrap', gap: 3 }}>
    {v.dataLimitMB    && <span>📊 {fmt.data(v.dataLimitMB)}</span>}
    {v.timeLimitMin   && <span>⏱ {fmt.time(v.timeLimitMin)}</span>}
    {v.speedLimitMbps && <span>⚡ {v.speedLimitMbps}M</span>}
    {v.maxUsageCount > 1 && <span>👥 {v.maxUsageCount}</span>}
  </div>

  if (tpl === 'dark') return (
    <div style={{ ...B, background: '#0d1b2a', border: '1px solid #1e3d5c', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: '#4a90d9', fontWeight: 700 }}>WiFi ACCESS</span>
        <span>{logo}</span>
      </div>
      {biz && <div style={{ fontSize: 12, fontWeight: 900, color: '#00d4ff', textAlign: 'center', marginBottom: 6 }}>{biz}</div>}
      <div style={{ background: '#0a1628', border: '1px dashed #1e3d5c', borderRadius: 6, padding: '6px', textAlign: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 9, color: '#4a90d9', marginBottom: 2 }}>كود الدخول</div>
        <div style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 900, color: '#00d4ff', letterSpacing: 2 }}>{v.code}</div>
      </div>
      <div style={{ color: '#7ab3d4' }}>{specs}</div>
    </div>
  )

  if (tpl === 'blue') return (
    <div style={{ ...B, background: 'white', border: '2px solid #1a56db', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: '#1a56db', padding: '6px 10px', textAlign: 'center' }}>
        <div style={{ color: 'white', fontWeight: 900, fontSize: 12 }}>{logo} {biz || 'WiFi'}</div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ border: '2px dashed #1a56db', borderRadius: 6, padding: '6px', textAlign: 'center', marginBottom: 6, background: '#eff6ff' }}>
          <div style={{ fontSize: 9, color: '#1e40af', marginBottom: 2 }}>كود الدخول</div>
          <div style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 900, color: '#1a56db', letterSpacing: 2 }}>{v.code}</div>
        </div>
        <div style={{ color: '#374151' }}>{specs}</div>
      </div>
    </div>
  )

  if (tpl === 'minimal') return (
    <div style={{ ...B, background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10 }}>
      {biz && <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginBottom: 4 }}>{logo} {biz}</div>}
      <div style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 900, color: '#111', letterSpacing: 2, textAlign: 'center', padding: '4px 0', borderTop: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', marginBottom: 4 }}>{v.code}</div>
      <div style={{ color: '#6b7280' }}>{specs}</div>
    </div>
  )

  if (tpl === 'receipt') return (
    <div style={{ ...B, background: '#fffef0', border: '1px dashed #d4c89a', borderRadius: 3, padding: '8px 10px', fontFamily: 'monospace' }}>
      <div style={{ textAlign: 'center', borderBottom: '1px dashed #d4c89a', marginBottom: 6, paddingBottom: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#333' }}>{logo} {biz || 'WiFi'}</div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 9, color: '#666', marginBottom: 2 }}>كود الدخول</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#111', letterSpacing: 3 }}>{v.code}</div>
      </div>
      <div style={{ borderTop: '1px dashed #d4c89a', paddingTop: 4, fontSize: 9, color: '#666' }}>
        {v.dataLimitMB    && <div>داتا: {fmt.data(v.dataLimitMB)}</div>}
        {v.timeLimitMin   && <div>وقت: {fmt.time(v.timeLimitMin)}</div>}
        {v.speedLimitMbps && <div>سرعة: {v.speedLimitMbps}Mbps</div>}
      </div>
    </div>
  )

  // elegant
  return (
    <div style={{ ...B, background: 'white', border: '1px solid #c9a84c', borderRadius: 7, padding: 10, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 3, right: 3, left: 3, height: 2, background: 'linear-gradient(90deg,#c9a84c,#f0d080,#c9a84c)', borderRadius: 1 }} />
      <div style={{ position: 'absolute', bottom: 3, right: 3, left: 3, height: 2, background: 'linear-gradient(90deg,#c9a84c,#f0d080,#c9a84c)', borderRadius: 1 }} />
      {biz && <div style={{ fontSize: 11, fontWeight: 900, color: '#92701a', textAlign: 'center', marginBottom: 6, marginTop: 4 }}>{logo} {biz}</div>}
      <div style={{ border: '1px solid #e8d5a3', borderRadius: 5, padding: '6px', textAlign: 'center', marginBottom: 6, background: '#fffdf5' }}>
        <div style={{ fontSize: 9, color: '#b8861d', marginBottom: 2, letterSpacing: 1 }}>WIFI ACCESS CODE</div>
        <div style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 900, color: '#92701a', letterSpacing: 2 }}>{v.code}</div>
      </div>
      <div style={{ color: '#b8861d', marginBottom: 4 }}>{specs}</div>
    </div>
  )
}

// ══════════════════════════════════════════════════
function PrintContent() {
  const sp      = useSearchParams()
  const adminId = sp.get('adminId') || ''

  const [vouchers,   setVouchers]   = useState<Voucher[]>([])
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [loading,    setLoading]    = useState(true)
  const [tpl,        setTpl]        = useState('dark')
  const [biz,        setBiz]        = useState('')
  const [logo,       setLogo]       = useState('📶')
  const [cols,       setCols]       = useState(3)

  useEffect(() => {
    if (!adminId) { setLoading(false); return }
    fetch(`/api/admin/vouchers?adminId=${adminId}&status=UNUSED&limit=500`)
      .then(r => r.json())
      .then(d => {
        const list: Voucher[] = Array.isArray(d) ? d : []
        setVouchers(list)
        setSelected(new Set(list.map(v => v.id)))
      })
      .finally(() => setLoading(false))
  }, [adminId])

  const toggle = (id: string) => setSelected(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const allSel = selected.size === vouchers.length
  const toggleAll = () => allSel
    ? setSelected(new Set())
    : setSelected(new Set(vouchers.map(v => v.id)))

  const printList = vouchers.filter(v => selected.has(v.id))
  const EMOJIS = ['📶', '☕', '🍕', '🏨', '🏪', '🎮', '✈️', '🍔', '🎵', '💼', '🌟', '🔥']

  const SI: React.CSSProperties = { width: '100%', padding: '8px 11px', background: '#070B12', border: '1px solid #1C2A40', borderRadius: 9, color: '#E2F0FB', fontFamily: 'Cairo,sans-serif', fontSize: 13, outline: 'none' }
  const SC: React.CSSProperties = { background: '#0C1420', border: '1px solid #1C2A40', borderRadius: 12, padding: 14, marginBottom: 10 }
  const SL: React.CSSProperties = { display: 'block', fontSize: 11, color: '#6B8CAE', marginBottom: 5 }

  return (
    <div style={{ minHeight: '100vh', background: '#070B12', direction: 'rtl', fontFamily: 'Cairo,sans-serif' }}>

      {/* ── Header ── */}
      <div className="no-print" style={{ background: '#0C1420', borderBottom: '1px solid #1C2A40', padding: '0 20px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#00D4FF' }}>🖨️ طباعة الكروت</span>
          <span style={{ fontSize: 12, color: '#6B8CAE', marginRight: 10 }}>
            {loading ? '⏳ تحميل...' : `${printList.length} كارت محدد من ${vouchers.length} غير مستخدم`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/dashboard" style={{ padding: '7px 14px', background: '#1C2A40', borderRadius: 8, color: '#6B8CAE', fontSize: 12, textDecoration: 'none' }}>← رجوع</a>
          <button
            onClick={() => window.print()}
            disabled={printList.length === 0}
            style={{ padding: '7px 20px', background: printList.length > 0 ? 'linear-gradient(135deg,#0088CC,#00D4FF)' : '#1C2A40', border: 'none', borderRadius: 8, color: printList.length > 0 ? '#000' : '#6B8CAE', fontSize: 13, fontWeight: 700, cursor: printList.length > 0 ? 'pointer' : 'not-allowed' }}>
            🖨️ طباعة {printList.length > 0 ? `(${printList.length})` : ''}
          </button>
        </div>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 14, padding: 16, maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Sidebar ── */}
        <div style={{ width: 250, flexShrink: 0 }}>

          {/* القالب */}
          <div style={SC}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E2F0FB', marginBottom: 10 }}>🎨 القالب</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTpl(t.id)} style={{ padding: '7px', fontSize: 11, cursor: 'pointer', textAlign: 'center', background: tpl === t.id ? '#0088CC22' : '#111B2D', border: `1px solid ${tpl === t.id ? '#0088CC' : '#1C2A40'}`, borderRadius: 7, color: tpl === t.id ? '#00D4FF' : '#6B8CAE', fontFamily: 'Cairo,sans-serif' }}>
                  {t.name}{tpl === t.id ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* المكان */}
          <div style={SC}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E2F0FB', marginBottom: 10 }}>🏪 المكان</div>
            <label style={SL}>اسم المكان</label>
            <input style={{ ...SI, marginBottom: 8 }} value={biz} onChange={e => setBiz(e.target.value)} placeholder="كافيه النيل" />
            <label style={SL}>أيقونة</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setLogo(e)} style={{ width: 30, height: 30, background: logo === e ? '#0088CC' : '#1C2A40', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>{e}</button>
              ))}
            </div>
          </div>

          {/* الأعمدة */}
          <div style={SC}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E2F0FB', marginBottom: 8 }}>📐 أعمدة: {cols}</div>
            <input type="range" min={1} max={5} value={cols} onChange={e => setCols(+e.target.value)} style={{ width: '100%', accentColor: '#0088CC' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#354E6A', marginTop: 3 }}>
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>

          {/* تحديد الكروت */}
          <div style={SC}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#E2F0FB' }}>✅ الكروت ({selected.size})</div>
              <button onClick={toggleAll} style={{ padding: '3px 9px', background: '#111B2D', border: '1px solid #1C2A40', borderRadius: 6, color: '#6B8CAE', fontSize: 10, cursor: 'pointer', fontFamily: 'Cairo,sans-serif' }}>
                {allSel ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#6B8CAE' }}>⏳</div>
              ) : vouchers.length === 0 ? (
                <div style={{ color: '#6B8CAE', fontSize: 12, textAlign: 'center', padding: 12 }}>لا توجد كروت غير مستخدمة</div>
              ) : vouchers.map(v => (
                <div key={v.id} onClick={() => toggle(v.id)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', marginBottom: 2, background: selected.has(v.id) ? 'rgba(0,212,255,0.07)' : 'transparent', border: `1px solid ${selected.has(v.id) ? 'rgba(0,212,255,0.18)' : 'transparent'}` }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, background: selected.has(v.id) ? '#00D4FF' : 'transparent', border: `2px solid ${selected.has(v.id) ? '#00D4FF' : '#354E6A'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#000' }}>{selected.has(v.id) ? '✓' : ''}</div>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: selected.has(v.id) ? '#00D4FF' : '#6B8CAE' }}>{v.code}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...SC, fontSize: 11, color: '#6B8CAE', lineHeight: 1.9 }}>
            <div style={{ fontWeight: 700, color: '#E2F0FB', marginBottom: 4 }}>💡 نصائح الطباعة</div>
            <div>• اختر "بلا هوامش" في الطابعة</div>
            <div>• حجم A4 — اتجاه عمودي</div>
            <div>• ممكن تحفظ PDF</div>
          </div>
        </div>

        {/* ── Preview ── */}
        <div style={{ flex: 1 }}>
          {loading && (
            <div style={{ background: '#0C1420', border: '1px solid #1C2A40', borderRadius: 14, padding: 60, textAlign: 'center', color: '#6B8CAE' }}>
              <div style={{ width: 36, height: 36, border: '3px solid #1C2A40', borderTopColor: '#00D4FF', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
              <div>جاري تحميل الكروت...</div>
            </div>
          )}
          {!loading && vouchers.length === 0 && (
            <div style={{ background: '#0C1420', border: '1px solid #1C2A40', borderRadius: 14, padding: 60, textAlign: 'center', color: '#6B8CAE' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🎫</div>
              <div style={{ fontSize: 15, color: '#E2F0FB', fontWeight: 700, marginBottom: 8 }}>لا توجد كروت غير مستخدمة</div>
              <div style={{ fontSize: 13 }}>ولّد كروت جديدة من الداشبورد أولاً</div>
              <a href="/dashboard" style={{ display: 'inline-block', marginTop: 20, padding: '10px 24px', background: 'linear-gradient(135deg,#0088CC,#00D4FF)', borderRadius: 10, color: '#000', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>← الداشبورد</a>
            </div>
          )}
          {!loading && printList.length > 0 && (
            <div style={{ background: ['dark'].includes(tpl) ? '#111827' : 'white', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 10 }}>
                {printList.map(v => <VCard key={v.id} v={v} tpl={tpl} biz={biz} logo={logo} />)}
              </div>
            </div>
          )}
          {!loading && vouchers.length > 0 && printList.length === 0 && (
            <div style={{ background: '#0C1420', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 14, padding: 40, textAlign: 'center', color: '#FF4444' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
              <div>لم تحدد أي كارت للطباعة</div>
            </div>
          )}
        </div>
      </div>

      {/* ── منطقة الطباعة الفعلية ── */}
      <div className="print-only">
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 8, padding: 8 }}>
          {printList.map(v => <VCard key={v.id} v={v} tpl={tpl} biz={biz} logo={logo} />)}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display:none!important }
          .print-only { display:block!important }
          body { background:white!important; margin:0; padding:0 }
          @page { margin:5mm; size:A4 portrait }
        }
        @media screen { .print-only { display:none } }
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>
    </div>
  )
}

export default function PrintUnusedPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#070B12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B8CAE', fontFamily: 'Cairo,sans-serif', direction: 'rtl' }}>
        ⏳ جاري التحميل...
      </div>
    }>
      <PrintContent />
    </Suspense>
  )
}
