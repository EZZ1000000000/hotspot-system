'use client'
import { useState, useEffect } from 'react'

type Plan = { id:string; name:string; emoji:string; color:string; price:number; maxDevices:number; maxVouchersTotal:number; canCreateUnlimited:boolean; canCreateNFC:boolean; canCreateQR:boolean; canRenewVouchers:boolean; description?:string }

const FALLBACK_PLANS: Plan[] = [
  { id:'free',       emoji:'🚀', name:'مجاني',   price:0,   color:'#6B8CAE', maxDevices:50, maxVouchersTotal:1000000, canCreateUnlimited:false, canCreateNFC:false, canCreateQR:false,  canRenewVouchers:false },
  { id:'basic',      emoji:'⚡', name:'أساسي',   price:99,  color:'#00D4FF', maxDevices:50, maxVouchersTotal:1000000, canCreateUnlimited:false, canCreateNFC:false, canCreateQR:true,   canRenewVouchers:true  },
  { id:'pro',        emoji:'👑', name:'احترافي', price:249, color:'#7c3aed', maxDevices:50, maxVouchersTotal:1000000, canCreateUnlimited:true,  canCreateNFC:true,  canCreateQR:true,   canRenewVouchers:true  },
  { id:'enterprise', emoji:'🏢', name:'مؤسسي',  price:499, color:'#f59e0b', maxDevices:50, maxVouchersTotal:1000000, canCreateUnlimited:true,  canCreateNFC:true,  canCreateQR:true,   canRenewVouchers:true  },
]

export default function LandingPage() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS)

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d) && d.length > 0) setPlans(d) })
      .catch(() => {})
  }, [])

  const S = {
    grad: 'radial-gradient(ellipse at 60% 20%, #001428 0%, #070B12 60%)',
    card: { background: 'rgba(12,20,32,0.8)', border: '1px solid rgba(28,42,64,0.8)', borderRadius: 16 } as React.CSSProperties,
  }

  const requestPlan = (planId: string) => {
    sessionStorage.setItem('requestPlanId', planId)
    window.location.href = '/dashboard#plan'
  }

  const features = [
    { icon:'📡', title:'مراقبة لحظية',     desc:'تابع جلسات العملاء والبيانات في الوقت الفعلي' },
    { icon:'🎫', title:'كروت ذكية',         desc:'كروت عادية، QR، NFC بأكواد آمنة وصلاحيات مرنة' },
    { icon:'💰', title:'تتبع المبيعات',     desc:'سجّل مبيعاتك وتتبع إيراداتك يومياً وشهرياً' },
    { icon:'📶', title:'إدارة الشبكة',      desc:'تحكم في اسم الـ WiFi والإعدادات من لوحة التحكم' },
    { icon:'🔔', title:'إشعارات فورية',     desc:'تنبيهات تلقائية عند نفاد الكروت أو توقف جهاز' },
    { icon:'🔒', title:'أمان عالي',         desc:'SSH tunnels، تشفير البيانات، صلاحيات محكومة' },
  ]

  const googleLoginUrl = '/api/auth/google?mode=login'
  const googleRegisterUrl = '/api/auth/google?mode=register'

  return (
    <div style={{ minHeight:'100vh', background:S.grad, color:'#E2F0FB', fontFamily:'Cairo, sans-serif', direction:'rtl' }}>

      {/* Nav */}
      <nav style={{ padding:'14px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(28,42,64,0.5)', backdropFilter:'blur(10px)', position:'sticky', top:0, zIndex:100, background:'rgba(7,11,18,0.85)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#0044AA,#00D4FF)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📡</div>
          <span style={{ fontSize:18, fontWeight:900, color:'#00D4FF' }}>HotSpot Pro</span>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <a href="/dashboard" style={{ padding:'8px 18px', background:'rgba(0,136,204,0.12)', border:'1px solid rgba(0,136,204,0.3)', borderRadius:9, color:'#00D4FF', textDecoration:'none', fontSize:13, fontWeight:700 }}>🔐 تسجيل الدخول</a>
          <a href="/register" style={{ padding:'8px 18px', background:'linear-gradient(135deg,#0088CC,#00D4FF)', borderRadius:9, color:'#000', textDecoration:'none', fontSize:13, fontWeight:900 }}>📋 سجّل الآن</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding:'80px 24px 60px', textAlign:'center', maxWidth:800, margin:'0 auto' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 16px', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:20, fontSize:12, color:'#00D4FF', marginBottom:24 }}>
          🚀 نظام إدارة Hotspot احترافي
        </div>
        <h1 style={{ fontSize:'clamp(28px,6vw,54px)', fontWeight:900, lineHeight:1.2, marginBottom:20 }}>
          إدارة <span style={{ background:'linear-gradient(135deg,#0088CC,#00D4FF)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>WiFi الكافيه</span><br/>بشكل احترافي
        </h1>
        <p style={{ fontSize:'clamp(14px,2vw,18px)', color:'#6B8CAE', lineHeight:1.8, marginBottom:36, maxWidth:600, margin:'0 auto 36px' }}>
          نظام متكامل لإدارة كروت الإنترنت، متابعة الجلسات، وتتبع المبيعات في مكان واحد — بدون تعقيد.
        </p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <a href="/register" style={{ padding:'14px 32px', background:'linear-gradient(135deg,#0088CC,#00D4FF)', borderRadius:12, color:'#000', textDecoration:'none', fontSize:15, fontWeight:900, boxShadow:'0 0 30px rgba(0,212,255,0.25)' }}>ابدأ مجاناً ←</a>
          <a href={googleRegisterUrl} style={{ padding:'14px 32px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:12, color:'#E2F0FB', textDecoration:'none', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
            <GoogleIcon/> سجّل بجوجل
          </a>
          <a href="/dashboard" style={{ padding:'14px 32px', background:'rgba(28,42,64,0.6)', border:'1px solid #1C2A40', borderRadius:12, color:'#E2F0FB', textDecoration:'none', fontSize:15, fontWeight:700 }}>عندي حساب</a>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ padding:'20px 24px', maxWidth:900, margin:'0 auto 60px' }}>
        <div style={{ ...S.card, padding:'20px 32px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:16, textAlign:'center' }}>
          {[{v:'500+',l:'كافيه يستخدمه'},{v:'50K+',l:'كارت يومياً'},{v:'99.9%',l:'وقت تشغيل'},{v:'24/7',l:'دعم فني'}].map((s,i)=>(
            <div key={i}>
              <div style={{ fontSize:24, fontWeight:900, color:'#00D4FF' }}>{s.v}</div>
              <div style={{ fontSize:11, color:'#6B8CAE', marginTop:4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding:'0 24px 80px', maxWidth:1000, margin:'0 auto' }}>
        <h2 style={{ textAlign:'center', fontSize:'clamp(20px,4vw,32px)', fontWeight:900, marginBottom:40 }}>
          كل اللي محتاجه في <span style={{ color:'#00D4FF' }}>مكان واحد</span>
        </h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
          {features.map((f,i)=>(
            <div key={i} style={{ ...S.card, padding:'20px 22px' }}>
              <div style={{ fontSize:30, marginBottom:10 }}>{f.icon}</div>
              <div style={{ fontSize:15, fontWeight:700, color:'#E2F0FB', marginBottom:6 }}>{f.title}</div>
              <div style={{ fontSize:13, color:'#6B8CAE', lineHeight:1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing — dynamic from DB */}
      <section style={{ padding:'0 16px 80px', maxWidth:1100, margin:'0 auto' }} id="pricing">
        <h2 style={{ textAlign:'center', fontSize:'clamp(20px,4vw,32px)', fontWeight:900, marginBottom:12 }}>الباقات والأسعار</h2>
        <p style={{ textAlign:'center', color:'#6B8CAE', marginBottom:40, fontSize:14 }}>ابدأ مجاناً — اترقى لما تكبر</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:16 }}>
          {plans.map((p, idx) => {
            const isHot = idx === 2 || (plans.length > 2 && p.price > 0 && p.price === Math.max(...plans.filter(x=>x.price>0).map(x=>x.price/2)))
            return (
            <div key={p.id} style={{
              ...S.card, padding:'24px 20px',
              border:`1px solid ${isHot?p.color+'60':'rgba(28,42,64,0.8)'}`,
              position:'relative',
              boxShadow: isHot ? `0 0 40px ${p.color}18` : 'none',
            }}>
              {isHot && <div style={{ position:'absolute', top:-12, right:'50%', transform:'translateX(50%)', padding:'3px 14px', background:p.color, borderRadius:20, fontSize:11, fontWeight:900, color:'#fff', whiteSpace:'nowrap' }}>⭐ الأكثر طلباً</div>}
              <div style={{ fontSize:32, marginBottom:6 }}>{p.emoji}</div>
              <div style={{ fontSize:16, fontWeight:900, color:p.color, marginBottom:4 }}>{p.name}</div>
              <div style={{ marginBottom:14 }}>
                <span style={{ fontSize:32, fontWeight:900, color:'#E2F0FB' }}>{p.price === 0 ? 'مجاني' : p.price + ' ج'}</span>
                {p.price > 0 && <span style={{ fontSize:12, color:'#6B8CAE' }}> /شهر</span>}
              </div>
              <div style={{ marginBottom:18, display:'flex', gap:10, fontSize:11, color:'#6B8CAE' }}>
                <span>🖥️ {p.maxDevices} جهاز</span>
                <span>🎫 {p.maxVouchersTotal >= 9999 ? '∞' : p.maxVouchersTotal} كارت</span>
              </div>
              <div style={{ marginBottom:20 }}>
                {p.canCreateQR       && <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7, fontSize:12, color:'#E2F0FB' }}><span style={{ color:p.color }}>✓</span>QR Code</div>}
                {p.canCreateNFC      && <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7, fontSize:12, color:'#E2F0FB' }}><span style={{ color:p.color }}>✓</span>NFC</div>}
                {p.canCreateUnlimited&& <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7, fontSize:12, color:'#E2F0FB' }}><span style={{ color:p.color }}>✓</span>♾️ Unlimited</div>}
                {p.canRenewVouchers  && <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7, fontSize:12, color:'#E2F0FB' }}><span style={{ color:p.color }}>✓</span>تجديد الكروت</div>}
                {p.description && <div style={{ fontSize:11, color:'#6B8CAE', marginTop:6, lineHeight:1.6 }}>{p.description}</div>}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <a href={`/register?plan=${p.id}`} style={{
                  display:'block', padding:'11px', textAlign:'center',
                  background: isHot ? `linear-gradient(135deg,${p.color},${p.color}cc)` : 'rgba(28,42,64,0.8)',
                  border: isHot ? 'none' : `1px solid ${p.color}40`,
                  borderRadius:10, color: isHot ? '#fff' : p.color,
                  textDecoration:'none', fontSize:13, fontWeight:900,
                }}>
                  {p.price === 0 ? 'ابدأ مجاناً' : 'سجّل واشترك'}
                </a>
                {p.price > 0 && (
                  <button onClick={()=>requestPlan(p.id)} style={{
                    display:'block', padding:'9px', textAlign:'center',
                    background:'transparent', border:`1px solid ${p.color}30`,
                    borderRadius:10, color:'#6B8CAE',
                    fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Cairo,sans-serif'
                  }}>
                    📤 عندي حساب — اطلب الترقية
                  </button>
                )}
              </div>
            </div>
          )})}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding:'60px 24px 80px', textAlign:'center' }}>
        <div style={{ ...S.card, padding:'48px 32px', maxWidth:600, margin:'0 auto', boxShadow:'0 0 60px rgba(0,136,204,0.1)' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🚀</div>
          <h2 style={{ fontSize:'clamp(20px,4vw,28px)', fontWeight:900, marginBottom:12 }}>جاهز تبدأ؟</h2>
          <p style={{ color:'#6B8CAE', fontSize:14, lineHeight:1.8, marginBottom:28 }}>سجّل حسابك المجاني الآن وابدأ في إدارة كافيهك باحترافية</p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <a href="/register" style={{ padding:'14px 32px', background:'linear-gradient(135deg,#0088CC,#00D4FF)', borderRadius:12, color:'#000', textDecoration:'none', fontSize:15, fontWeight:900 }}>
              إنشاء حساب مجاني ←
            </a>
            <a href={googleRegisterUrl} style={{ padding:'14px 24px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:12, color:'#E2F0FB', textDecoration:'none', fontSize:14, fontWeight:700, display:'inline-flex', alignItems:'center', gap:8 }}>
              <GoogleIcon/> سجّل بجوجل
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding:'28px 24px', borderTop:'1px solid rgba(28,42,64,0.5)', color:'#354E6A', fontSize:12 }}>
        <div style={{ display:'flex', justifyContent:'center', flexWrap:'wrap', gap:'8px 20px', marginBottom:12 }}>
          <a href="/dashboard" style={{ color:'#6B8CAE', textDecoration:'none' }}>🔐 تسجيل الدخول</a>
          <a href="#pricing" style={{ color:'#6B8CAE', textDecoration:'none' }}>💰 الأسعار</a>
          <a href="/about" style={{ color:'#6B8CAE', textDecoration:'none' }}>🏢 من نحن</a>
          <a href="/contact" style={{ color:'#6B8CAE', textDecoration:'none' }}>📧 اتصل بنا</a>
          <a href="/privacy" style={{ color:'#6B8CAE', textDecoration:'none' }}>🔒 سياسة الخصوصية</a>
          <a href="/terms" style={{ color:'#6B8CAE', textDecoration:'none' }}>📋 شروط الاستخدام</a>
        </div>
        <div style={{ textAlign:'center' }}>HotSpot Pro © 2025 — نظام إدارة WiFi الكافيهات</div>
      </footer>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  )
}
