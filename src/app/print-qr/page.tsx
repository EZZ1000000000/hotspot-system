'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// ── صفحة طباعة QR Cards ──────────────────────────────────────────────────────
// كارت واحد (maxUsageCount أجهزة متزامنة) × count نسخة مطبوعة
// QR Code بيتقرا مباشرة من صفحة البوابة — مفيش كود يدوي

type QRVoucher = {
  id: string; code: string
  qrPayload: string
  dataLimitMB: number | null; timeLimitMin: number | null
  speedLimitMbps: number | null; maxUsageCount: number
  packageType: string
}

const fmt = {
  data: (mb: number | null) => !mb ? '∞' : mb >= 1024 ? (mb / 1024).toFixed(1) + 'GB' : mb + 'MB',
  time: (m: number | null)  => !m  ? '∞' : m  >= 60  ? `${Math.floor(m / 60)}س${m % 60 ? m % 60 + 'د' : ''}` : m + 'د',
}

// ── QR Image (Google Charts) ─────────────────────────────────────────────────
function QRImg({ value, size = 160 }: { value: string; size?: number }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=000000&margin=4&ecc=M`
  return (
    <img src={url} width={size} height={size} alt="QR Code"
      style={{ display: 'block', borderRadius: 6 }} crossOrigin="anonymous" />
  )
}

// ── QR Card ───────────────────────────────────────────────────────────────────
function QRCard({ v, biz, logo, style: cardStyle }: {
  v: QRVoucher; biz: string; logo: string; style: 'dark' | 'white' | 'minimal'
}) {
  const specs = [
    v.dataLimitMB    && `📊 ${fmt.data(v.dataLimitMB)}`,
    v.timeLimitMin   && `⏱ ${fmt.time(v.timeLimitMin)}`,
    v.speedLimitMbps && `⚡ ${v.speedLimitMbps}Mbps`,
    v.maxUsageCount > 1 && `👥 ${v.maxUsageCount} أجهزة`,
  ].filter(Boolean).join('  ')

  const base: React.CSSProperties = {
    fontFamily: 'Cairo,sans-serif',
    breakInside: 'avoid', pageBreakInside: 'avoid',
    width: '100%', boxSizing: 'border-box',
    borderRadius: 14, overflow: 'hidden',
  }

  if (cardStyle === 'dark') return (
    <div style={{ ...base, background: '#0d1b2a', border: '1px solid #1e3d5c', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#4a90d9', fontWeight: 700, letterSpacing: 1 }}>WiFi QR ACCESS</div>
          {biz && <div style={{ fontSize: 14, fontWeight: 900, color: '#00d4ff', marginTop: 3 }}>{logo} {biz}</div>}
        </div>
        <div style={{ background: 'white', padding: 6, borderRadius: 8 }}>
          <QRImg value={v.qrPayload} size={120} />
        </div>
      </div>
      <div style={{ background: '#0a1628', border: '1px dashed #1e3d5c', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: '#4a90d9', marginBottom: 4 }}>📱 امسح QR بكاميرا موبايلك للاتصال</div>
        <div style={{ fontSize: 11, color: '#7ab3d4' }}>{specs}</div>
      </div>
    </div>
  )

  if (cardStyle === 'white') return (
    <div style={{ ...base, background: 'white', border: '2px solid #1a56db', padding: 14 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: 8, padding: 4, flexShrink: 0 }}>
          <QRImg value={v.qrPayload} size={120} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#1a56db', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>WiFi ACCESS</div>
          {biz && <div style={{ fontSize: 14, fontWeight: 900, color: '#1a56db', marginBottom: 8 }}>{logo} {biz}</div>}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: '#1e40af', marginBottom: 4 }}>📱 امسح الـ QR للاتصال المباشر</div>
            <div style={{ fontSize: 11, color: '#374151' }}>{specs}</div>
          </div>
        </div>
      </div>
    </div>
  )

  // minimal
  return (
    <div style={{ ...base, background: 'white', border: '1px solid #e5e7eb', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <QRImg value={v.qrPayload} size={100} />
        <div>
          {biz && <div style={{ fontSize: 12, fontWeight: 900, color: '#111827', marginBottom: 4 }}>{logo} {biz}</div>}
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>📱 امسح للاتصال</div>
          <div style={{ fontSize: 10, color: '#374151' }}>{specs}</div>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
function PrintQRContent() {
  const params = useSearchParams()
  const batchId = params.get('batch')

  const [vouchers, setVouchers]   = useState<QRVoucher[]>([])
  const [printCount, setPrintCount] = useState(10)  // عدد النسخ المطبوعة
  const [cardStyle,  setCardStyle]  = useState<'dark' | 'white' | 'minimal'>('dark')
  const [cols,       setCols]       = useState(2)
  const [cardW,      setCardW]      = useState(0)   // عرض الكارت مم — 0 = تلقائي
  const [cardH,      setCardH]      = useState(0)   // طول الكارت مم — 0 = تلقائي
  const [biz,        setBiz]        = useState('')
  const [logo,       setLogo]       = useState('📶')
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    if (!batchId) return
    setLoading(true)
    fetch(`/api/admin/vouchers/batch?batchId=${batchId}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setVouchers(d.filter((v: any) => v.qrPayload))
      })
      .finally(() => setLoading(false))
  }, [batchId])

  // نضرب الكارت الواحد × printCount عشان نطبعه بعدة نسخ
  const printCards = vouchers.flatMap(v =>
    Array.from({ length: printCount }, (_, i) => ({ ...v, _key: `${v.id}-${i}` }))
  )

  const EMOJIS = ['📶', '☕', '🍕', '🏨', '🏪', '🎮', '✈️', '🍔', '🎵', '💼', '🌟', '🔥']

  const Sinp: React.CSSProperties = { width: '100%', padding: '8px 12px', background: '#070B12', border: '1px solid #1C2A40', borderRadius: 9, color: '#E2F0FB', fontFamily: 'Cairo,sans-serif', fontSize: 13, outline: 'none' }
  const Scrd: React.CSSProperties = { background: '#0C1420', border: '1px solid #1C2A40', borderRadius: 11, padding: 14, marginBottom: 10 }
  const Slbl: React.CSSProperties = { display: 'block', fontSize: 11, color: '#6B8CAE', marginBottom: 5 }

  const darkBg = cardStyle === 'dark'

  return (
    <div style={{ minHeight: '100vh', background: '#070B12', direction: 'rtl', fontFamily: 'Cairo,sans-serif' }}>
      {/* Header */}
      <div className="no-print" style={{ background: '#0C1420', borderBottom: '1px solid #1C2A40', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#00D4FF' }}>📷 طباعة QR Cards</span>
          <span style={{ fontSize: 12, color: '#6B8CAE', marginRight: 10 }}>
            {vouchers.length} كارت × {printCount} نسخة = {printCards.length} كارت مطبوع
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/dashboard" style={{ padding: '7px 14px', background: '#1C2A40', borderRadius: 8, color: '#6B8CAE', fontSize: 12, textDecoration: 'none' }}>← رجوع</a>
          <button onClick={() => window.print()} disabled={printCards.length === 0}
            style={{ padding: '7px 20px', background: printCards.length > 0 ? 'linear-gradient(135deg,#0088CC,#00D4FF)' : '#1C2A40', border: 'none', borderRadius: 8, color: printCards.length > 0 ? '#000' : '#6B8CAE', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Cairo,sans-serif' }}>
            🖨️ طباعة ({printCards.length})
          </button>
        </div>
      </div>

      <div className="no-print print-shell">
        {/* Sidebar */}
        <div className="print-sidebar">

          {/* عدد النسخ */}
          <div style={Scrd}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E2F0FB', marginBottom: 12 }}>📋 عدد النسخ</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setPrintCount(n => Math.max(1, n - 1))}
                style={{ width: 36, height: 36, background: '#1C2A40', border: 'none', borderRadius: 8, color: '#E2F0FB', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>−</button>
              <input type="number" min={1} max={500} value={printCount}
                onChange={e => setPrintCount(Math.max(1, Math.min(500, +e.target.value)))}
                style={{ ...Sinp, textAlign: 'center', fontSize: 20, fontWeight: 900, color: '#00D4FF', padding: '8px', width: '100%' }} />
              <button onClick={() => setPrintCount(n => Math.min(500, n + 1))}
                style={{ width: 36, height: 36, background: '#1C2A40', border: 'none', borderRadius: 8, color: '#E2F0FB', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>+</button>
            </div>
            <div style={{ fontSize: 11, color: '#354E6A', marginTop: 6, textAlign: 'center' }}>
              مجموع الكروت المطبوعة: <strong style={{ color: '#00D4FF' }}>{printCards.length}</strong>
            </div>
            {/* أزرار سريعة */}
            <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
              {[10, 20, 50, 100].map(n => (
                <button key={n} onClick={() => setPrintCount(n)}
                  style={{ flex: 1, padding: '5px', background: printCount === n ? '#0088CC' : '#111B2D', border: `1px solid ${printCount === n ? '#0088CC' : '#1C2A40'}`, borderRadius: 6, color: printCount === n ? '#000' : '#6B8CAE', fontFamily: 'Cairo,sans-serif', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* الشكل */}
          <div style={Scrd}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E2F0FB', marginBottom: 10 }}>🎨 شكل الكارت</div>
            {([
              { id: 'dark',    label: '🌑 داكن' },
              { id: 'white',   label: '⬜ أبيض' },
              { id: 'minimal', label: '✂️ مبسط' },
            ] as const).map(s => (
              <button key={s.id} onClick={() => setCardStyle(s.id)}
                style={{ width: '100%', padding: '9px', marginBottom: 6, background: cardStyle === s.id ? 'rgba(0,136,204,0.2)' : '#111B2D', border: `1px solid ${cardStyle === s.id ? '#0088CC' : '#1C2A40'}`, borderRadius: 8, color: cardStyle === s.id ? '#00D4FF' : '#6B8CAE', fontFamily: 'Cairo,sans-serif', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                {s.label} {cardStyle === s.id ? '✓' : ''}
              </button>
            ))}
          </div>

          {/* الأعمدة + المقاس */}
          <div style={Scrd}>
            <label style={Slbl}>أعمدة: {cols} (لحد 8)</label>
            <input type="range" min={1} max={8} value={cols} onChange={e => setCols(+e.target.value)} style={{ width: '100%', accentColor: '#0088CC' }} />
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {[2, 3, 4, 5, 6, 8].map(n => (
                <button key={n} onClick={() => setCols(n)}
                  style={{ flex: 1, padding: '4px 0', background: cols === n ? '#0088CC' : '#111B2D', border: `1px solid ${cols === n ? '#0088CC' : '#1C2A40'}`, borderRadius: 6, color: cols === n ? '#000' : '#6B8CAE', fontFamily: 'Cairo,sans-serif', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>{n}</button>
              ))}
            </div>
            <label style={{ ...Slbl, marginTop: 10 }}>📐 مقاس الكارت (مم) — صفر = تلقائي</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="number" min={0} max={200} value={cardW} onChange={e => setCardW(Math.max(0, Math.min(200, +e.target.value || 0)))} style={{ ...Sinp, textAlign: 'center', color: '#00D4FF', fontWeight: 700 }} placeholder="العرض" />
              <input type="number" min={0} max={200} value={cardH} onChange={e => setCardH(Math.max(0, Math.min(200, +e.target.value || 0)))} style={{ ...Sinp, textAlign: 'center', color: '#00D4FF', fontWeight: 700 }} placeholder="الطول" />
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <button onClick={() => { setCardW(0); setCardH(0) }} style={{ flex: 1, padding: '4px 0', background: cardW === 0 && cardH === 0 ? '#0088CC' : '#111B2D', border: '1px solid #1C2A40', borderRadius: 6, color: cardW === 0 && cardH === 0 ? '#000' : '#6B8CAE', fontFamily: 'Cairo,sans-serif', fontSize: 9, cursor: 'pointer', fontWeight: 700 }}>تلقائي</button>
              <button onClick={() => { setCardW(54); setCardH(86) }} style={{ flex: 1, padding: '4px 0', background: cardW === 54 && cardH === 86 ? '#0088CC' : '#111B2D', border: '1px solid #1C2A40', borderRadius: 6, color: cardW === 54 && cardH === 86 ? '#000' : '#6B8CAE', fontFamily: 'Cairo,sans-serif', fontSize: 9, cursor: 'pointer', fontWeight: 700 }}>كارت بنكي</button>
              <button onClick={() => { setCardW(63.5); setCardH(88) }} style={{ flex: 1, padding: '4px 0', background: cardW === 63.5 && cardH === 88 ? '#0088CC' : '#111B2D', border: '1px solid #1C2A40', borderRadius: 6, color: cardW === 63.5 && cardH === 88 ? '#000' : '#6B8CAE', fontFamily: 'Cairo,sans-serif', fontSize: 9, cursor: 'pointer', fontWeight: 700 }}>بوكر</button>
            </div>
          </div>

          {/* المكان */}
          <div style={Scrd}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E2F0FB', marginBottom: 10 }}>🏪 المكان</div>
            <label style={Slbl}>اسم المكان</label>
            <input style={{ ...Sinp, marginBottom: 8 }} value={biz} onChange={e => setBiz(e.target.value)} placeholder="كافيه النيل" />
            <label style={Slbl}>أيقونة</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setLogo(e)}
                  style={{ width: 32, height: 32, background: logo === e ? '#0088CC' : '#1C2A40', border: 'none', borderRadius: 7, fontSize: 14, cursor: 'pointer' }}>{e}
                </button>
              ))}
            </div>
          </div>

          {/* تعليمات */}
          <div style={{ ...Scrd, fontSize: 11, color: '#6B8CAE', lineHeight: 2 }}>
            <div style={{ fontWeight: 700, color: '#00D4FF', marginBottom: 5 }}>📱 كيف يشتغل QR؟</div>
            <div>• اطبع الكروت وعلّقها في مكانك</div>
            <div>• العميل يمسح QR بكاميرا موبايله</div>
            <div>• بيروح مباشرة لصفحة الدخول</div>
            <div>• الكود بيتحط تلقائياً</div>
            <div style={{ marginTop: 6, color: '#fb923c' }}>
              ⚠️ محتاج انترنت لتحميل صور QR
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="print-preview">
          {loading && (
            <div style={{ background: '#0C1420', border: '1px solid #1C2A40', borderRadius: 14, padding: 60, textAlign: 'center', color: '#6B8CAE' }}>
              ⏳ جاري التحميل...
            </div>
          )}
          {!loading && vouchers.length === 0 && (
            <div style={{ background: '#0C1420', border: '1px solid #1C2A40', borderRadius: 14, padding: 60, textAlign: 'center', color: '#6B8CAE' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>📷</div>
              <div style={{ fontSize: 15, color: '#E2F0FB', fontWeight: 700, marginBottom: 8 }}>لا توجد كروت QR</div>
              <div style={{ fontSize: 13 }}>ولّد كروت من نوع QR من الداشبورد أولاً</div>
            </div>
          )}
          {!loading && printCards.length > 0 && (
            <div style={{ background: darkBg ? '#111' : '#f9fafb', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
                {printCards.map(v => (
                  <div key={v._key} style={{ width: cardW > 0 ? cardW + 'mm' : undefined, height: cardH > 0 ? cardH + 'mm' : undefined, overflow: cardH > 0 ? 'hidden' : undefined }}>
                    <QRCard v={v} biz={biz} logo={logo} style={cardStyle} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print Area */}
      <div className="print-only">
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, padding: 8 }}>
          {printCards.map(v => (
            <div key={v._key} style={{ width: cardW > 0 ? cardW + 'mm' : undefined, height: cardH > 0 ? cardH + 'mm' : undefined, overflow: cardH > 0 ? 'hidden' : undefined }}>
              <QRCard v={v} biz={biz} logo={logo} style={cardStyle} />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print  { display: none!important }
          .print-only { display: block!important }
          body { background: white!important; margin: 0; padding: 0 }
          @page { margin: 6mm; size: A4 portrait }
          *{
            -webkit-print-color-adjust:exact!important;
            print-color-adjust:exact!important;
            color-adjust:exact!important;
          }
          div[style*="background"],span[style*="background"]{
            -webkit-print-color-adjust:exact!important;
            print-color-adjust:exact!important;
          }
        }
        @media screen { .print-only { display: none } }

        /* ريسبونسيف */
        .print-shell{
          display:flex;
          gap:14px;
          padding:14px;
          max-width:1200px;
          margin:0 auto;
        }
        .print-sidebar{ width:230px; flex-shrink:0; }
        .print-preview{ flex:1; min-width:0; }
        @media(max-width:900px){
          .print-shell{flex-direction:column;padding:10px}
          .print-sidebar{width:100%}
        }
        @media(max-width:600px){
          .print-shell{padding:8px}
          .print-sidebar{width:100%}
        }
      `}</style>
    </div>
  )
}

export default function PrintQRPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#070B12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B8CAE', fontFamily: 'Cairo,sans-serif', direction: 'rtl' }}>
        ⏳ جاري التحميل...
      </div>
    }>
      <PrintQRContent />
    </Suspense>
  )
}
