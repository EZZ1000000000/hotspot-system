'use client'
import { useState, useEffect } from 'react'

// صفحة طلبات المبيعات — بتظهر من البورتال
// /sales?gw_id=GW-XXXX-XXXX

type Package = {
  id: string
  name: string
  description: string
  dataLimitMB: number | null
  timeLimitMin: number | null
  speedLimitMbps: number | null
  price: number
  popular?: boolean
  color: string
}

const PACKAGES: Package[] = [
  { id:'basic', name:'باقة ساعة', description:'ساعة كاملة تصفح', dataLimitMB:null, timeLimitMin:60, speedLimitMbps:5, price:5, color:'#00D4FF' },
  { id:'standard', name:'باقة نهارية', description:'8 ساعات متواصلة', dataLimitMB:null, timeLimitMin:480, speedLimitMbps:10, price:15, popular:true, color:'#00E676' },
  { id:'data1', name:'1 جيجا', description:'داتا بدون حد زمني', dataLimitMB:1024, timeLimitMin:null, speedLimitMbps:null, price:10, color:'#818cf8' },
  { id:'data5', name:'5 جيجا', description:'داتا بدون حد زمني', dataLimitMB:5120, timeLimitMin:null, speedLimitMbps:null, price:35, color:'#fb923c' },
]

const fmt = {
  data: (mb: number) => mb >= 1024 ? (mb / 1024).toFixed(0) + ' GB' : mb + ' MB',
  time: (min: number) => min >= 60 ? Math.floor(min / 60) + ' ساعة' + (min % 60 ? ' ' + (min % 60) + ' د' : '') : min + ' دقيقة',
}

export default function SalesPage() {
  const [gwId, setGwId] = useState('')
  const [placeName, setPlaceName] = useState('WiFi Hotspot')
  const [wifiName, setWifiName] = useState('')
  const [logoEmoji, setLogoEmoji] = useState('📶')
  const [selected, setSelected] = useState<Package | null>(null)
  const [step, setStep] = useState<'packages' | 'contact' | 'confirm'>('packages')
  const [form, setForm] = useState({ name: '', phone: '', note: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState<'ar' | 'en'>('ar')

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const gw = p.get('gw_id') || ''
    setGwId(gw)
    const browserLang = navigator.language.startsWith('ar') ? 'ar' : 'en'
    setLang(browserLang)

    if (gw) {
      fetch(`/api/portal/settings?gw_id=${gw}`)
        .then(r => r.json())
        .then(d => {
          if (d.placeName) setPlaceName(d.placeName)
          if (d.wifiName)  setWifiName(d.wifiName)
          if (d.logoEmoji) setLogoEmoji(d.logoEmoji)
        })
        .catch(() => {})
    }
  }, [])

  const submitOrder = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await fetch('/api/portal/sales-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gwId,
          packageId: selected.id,
          packageName: selected.name,
          price: selected.price,
          customerName: form.name,
          customerPhone: form.phone,
          note: form.note,
        }),
      })
      setSubmitted(true)
    } catch {
      setSubmitted(true) // حتى لو فشل الـ API، نكمّل
    }
    setLoading(false)
  }

  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 40% 20%, #001830 0%, #070B12 70%)',
      fontFamily: 'Cairo, sans-serif',
      direction: dir,
      padding: '20px 16px 40px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 480, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <a href={`/portal${gwId ? `?gw_id=${gwId}` : ''}`} style={{ color: '#6B8CAE', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
            ← {lang === 'ar' ? 'رجوع' : 'Back'}
          </a>
          <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')} style={{ background: 'rgba(12,20,32,0.8)', border: '1px solid #1C2A40', borderRadius: 999, padding: '4px 12px', color: '#00D4FF', cursor: 'pointer', fontFamily: 'Cairo,sans-serif', fontSize: 12 }}>
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,#0088CC,#00D4FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 12px', boxShadow: '0 0 30px rgba(0,212,255,0.25)' }}>
            {logoEmoji}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#00D4FF', margin: 0 }}>{placeName}</h1>
          {wifiName && <div style={{ fontSize: 12, color: '#6B8CAE', marginTop: 4 }}>📶 {wifiName}</div>}
          <p style={{ fontSize: 14, color: '#6B8CAE', marginTop: 8 }}>
            {lang === 'ar' ? 'اختار الباقة المناسبة ليك' : 'Choose your internet package'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* ✅ Submitted */}
        {submitted && (
          <div style={{ background: '#0C1420', border: '1px solid #1C2A40', borderRadius: 20, padding: '40px 24px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 60, marginBottom: 16, animation: 'popIn 0.5s ease' }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#00E676', marginBottom: 8 }}>
              {lang === 'ar' ? 'تم استلام طلبك!' : 'Order Received!'}
            </h2>
            <p style={{ fontSize: 14, color: '#6B8CAE', marginBottom: 20, lineHeight: 1.8 }}>
              {lang === 'ar'
                ? 'طلبك وصلنا — هيجيلك الكود على طول\nاتصل بالمسؤول لو محتاج مساعدة'
                : 'Your order has been received.\nStaff will provide your voucher shortly.'}
            </p>
            {selected && (
              <div style={{ background: '#070B12', border: '1px solid #1C2A40', borderRadius: 12, padding: '14px 18px', marginBottom: 20, textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: '#6B8CAE', marginBottom: 6 }}>تفاصيل الطلب</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#E2F0FB' }}>{selected.name}</div>
                <div style={{ fontSize: 14, color: '#00E676', fontWeight: 900, marginTop: 4 }}>{selected.price} جنيه</div>
              </div>
            )}
            <button onClick={() => { setSubmitted(false); setSelected(null); setStep('packages'); setForm({ name: '', phone: '', note: '' }) }}
              style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#0088CC,#00D4FF)', border: 'none', borderRadius: 12, color: '#000', fontSize: 14, fontWeight: 700, fontFamily: 'Cairo,sans-serif', cursor: 'pointer' }}>
              {lang === 'ar' ? '← طلب جديد' : '← New Order'}
            </button>
          </div>
        )}

        {/* STEP 1: Packages */}
        {!submitted && step === 'packages' && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6B8CAE', marginBottom: 12 }}>
              {lang === 'ar' ? '🎯 اختار الباقة' : '🎯 Select Package'}
            </div>
            {PACKAGES.map(pkg => (
              <div key={pkg.id}
                onClick={() => setSelected(pkg)}
                style={{
                  background: selected?.id === pkg.id ? `${pkg.color}12` : '#0C1420',
                  border: `2px solid ${selected?.id === pkg.id ? pkg.color : '#1C2A40'}`,
                  borderRadius: 16,
                  padding: '16px 18px',
                  marginBottom: 10,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                }}>
                {pkg.popular && (
                  <div style={{ position: 'absolute', top: -10, right: 14, background: '#00E676', color: '#000', fontSize: 10, fontWeight: 900, padding: '2px 10px', borderRadius: 20 }}>
                    ⭐ {lang === 'ar' ? 'الأكثر طلباً' : 'Popular'}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#E2F0FB', marginBottom: 4 }}>{pkg.name}</div>
                    <div style={{ fontSize: 12, color: '#6B8CAE', marginBottom: 8 }}>{pkg.description}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {pkg.dataLimitMB && (
                        <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.25)', color: '#818cf8' }}>
                          📊 {fmt.data(pkg.dataLimitMB)}
                        </span>
                      )}
                      {!pkg.dataLimitMB && (
                        <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.25)', color: '#818cf8' }}>
                          📊 داتا غير محدودة
                        </span>
                      )}
                      {pkg.timeLimitMin && (
                        <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', color: '#00D4FF' }}>
                          ⏱ {fmt.time(pkg.timeLimitMin)}
                        </span>
                      )}
                      {pkg.speedLimitMbps && (
                        <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', color: '#00E676' }}>
                          ⚡ {pkg.speedLimitMbps} Mbps
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0, marginRight: 12 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: pkg.color }}>{pkg.price}</div>
                    <div style={{ fontSize: 11, color: '#6B8CAE' }}>جنيه</div>
                  </div>
                </div>
                {selected?.id === pkg.id && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${pkg.color}30`, textAlign: 'left' }}>
                    <span style={{ fontSize: 12, color: pkg.color }}>✓ {lang === 'ar' ? 'تم الاختيار' : 'Selected'}</span>
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => selected && setStep('contact')} disabled={!selected}
              style={{ width: '100%', marginTop: 8, padding: '14px', background: selected ? 'linear-gradient(135deg,#0088CC,#00D4FF)' : '#1C2A40', border: 'none', borderRadius: 12, color: selected ? '#000' : '#6B8CAE', fontSize: 16, fontWeight: 700, fontFamily: 'Cairo,sans-serif', cursor: selected ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
              {lang === 'ar' ? 'التالي ←' : 'Next →'}
            </button>
          </div>
        )}

        {/* STEP 2: Contact */}
        {!submitted && step === 'contact' && (
          <div style={{ background: '#0C1420', border: '1px solid #1C2A40', borderRadius: 20, padding: '24px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            {/* ملخص الباقة */}
            {selected && (
              <div style={{ background: '#070B12', border: `1px solid ${selected.color}30`, borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#E2F0FB' }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: '#6B8CAE', marginTop: 2 }}>{selected.description}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: selected.color }}>{selected.price}</div>
                  <div style={{ fontSize: 10, color: '#6B8CAE' }}>جنيه</div>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#6B8CAE', marginBottom: 6 }}>
                👤 {lang === 'ar' ? 'اسمك (اختياري)' : 'Your Name (optional)'}
              </label>
              <input style={{ width: '100%', padding: '11px 14px', background: '#070B12', border: '1px solid #1C2A40', borderRadius: 10, color: '#E2F0FB', fontFamily: 'Cairo,sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={lang === 'ar' ? 'مثال: أحمد محمد' : 'e.g. Ahmed Mohamed'} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#6B8CAE', marginBottom: 6 }}>
                📱 {lang === 'ar' ? 'رقم الموبايل (اختياري)' : 'Phone Number (optional)'}
              </label>
              <input style={{ width: '100%', padding: '11px 14px', background: '#070B12', border: '1px solid #1C2A40', borderRadius: 10, color: '#E2F0FB', fontFamily: 'Cairo,sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box', direction: 'ltr' }}
                value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="010xxxxxxxx" type="tel" />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#6B8CAE', marginBottom: 6 }}>
                💬 {lang === 'ar' ? 'ملاحظة (اختياري)' : 'Note (optional)'}
              </label>
              <textarea style={{ width: '100%', padding: '11px 14px', background: '#070B12', border: '1px solid #1C2A40', borderRadius: 10, color: '#E2F0FB', fontFamily: 'Cairo,sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'none', height: 72 }}
                value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder={lang === 'ar' ? 'أي ملاحظة أو طلب...' : 'Any notes...'} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('packages')} style={{ padding: '13px 20px', background: '#1C2A40', border: 'none', borderRadius: 12, color: '#6B8CAE', fontSize: 14, fontWeight: 700, fontFamily: 'Cairo,sans-serif', cursor: 'pointer' }}>
                ← {lang === 'ar' ? 'رجوع' : 'Back'}
              </button>
              <button onClick={submitOrder} disabled={loading}
                style={{ flex: 1, padding: '13px', background: loading ? '#1C2A40' : 'linear-gradient(135deg,#0088CC,#00D4FF)', border: 'none', borderRadius: 12, color: loading ? '#6B8CAE' : '#000', fontSize: 15, fontWeight: 700, fontFamily: 'Cairo,sans-serif', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
                {loading
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span style={{ width: 14, height: 14, border: '2px solid #6B8CAE', borderTopColor: '#00D4FF', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                      {lang === 'ar' ? 'جاري الإرسال...' : 'Sending...'}
                    </span>
                  : lang === 'ar' ? '✅ تأكيد الطلب' : '✅ Confirm Order'
                }
              </button>
            </div>
          </div>
        )}
      </div>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#354E6A' }}>
        {placeName} · Hotspot System
      </p>

      <style>{`
        @keyframes popIn { 0%{transform:scale(0.5);opacity:0} 80%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
