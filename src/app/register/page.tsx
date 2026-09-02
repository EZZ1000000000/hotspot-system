'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Plan = { id:string; name:string; emoji:string; color:string; price:number; maxDevices:number; maxVouchersTotal:number }

const FALLBACK_PLANS: Plan[] = [
  { id:'free', emoji:'🚀', name:'مجاني', price:0, color:'#6B8CAE', maxDevices:1, maxVouchersTotal:30 },
  { id:'basic', emoji:'⚡', name:'أساسي', price:99, color:'#00D4FF', maxDevices:3, maxVouchersTotal:200 },
  { id:'pro', emoji:'👑', name:'احترافي', price:249, color:'#7c3aed', maxDevices:10, maxVouchersTotal:1000 },
  { id:'enterprise', emoji:'🏢', name:'مؤسسي', price:499, color:'#f59e0b', maxDevices:50, maxVouchersTotal:9999 },
]

const S = {
  card:  { background:'#0C1420', border:'1px solid #1C2A40', borderRadius:14, padding:24 } as React.CSSProperties,
  input: { width:'100%', padding:'11px 14px', background:'#070B12', border:'1px solid #1C2A40', borderRadius:10, color:'#E2F0FB', fontFamily:'Cairo,sans-serif', fontSize:14, outline:'none', boxSizing:'border-box' as const },
  label: { display:'block', fontSize:12, color:'#6B8CAE', marginBottom:6 } as React.CSSProperties,
  btn:   (bg='#0088CC', c='#000') => ({ padding:'12px 20px', background:bg, border:'none', borderRadius:10, color:c, fontFamily:'Cairo,sans-serif', fontSize:14, fontWeight:700, cursor:'pointer', width:'100%' } as React.CSSProperties),
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{flexShrink:0}}>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  )
}

function RegisterForm() {
  const params      = useSearchParams()
  const defaultPlan = params.get('plan') || 'free'
  const errorParam  = params.get('error')

  const [plans, setPlans]     = useState<Plan[]>(FALLBACK_PLANS)
  const [step, setStep]       = useState<'form'|'done'>('form')
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState(errorParam === 'google_denied' ? 'تم رفض تسجيل الدخول بجوجل' : errorParam === 'no_account' ? 'مفيش حساب بهذا الإيميل، سجّل أولاً' : '')
  const [form, setForm]       = useState({ name:'', username:'', email:'', phone:'', password:'', confirm:'', plan: defaultPlan })

  useEffect(() => {
    fetch('/api/plans').then(r=>r.json()).then(d=>{ if(Array.isArray(d)&&d.length>0) setPlans(d) }).catch(()=>{})
  }, [])

  const selectedPlan = plans.find(p => p.id === form.plan) || plans[0]

  const submit = async () => {
    if (!form.name || !form.username || !form.email || !form.password) { setErr('يرجى ملء جميع الحقول'); return }
    if (form.password !== form.confirm) { setErr('كلمات المرور غير متطابقة'); return }
    if (form.password.length < 6) { setErr('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, requestedPlan: form.plan }),
      })
      const d = await res.json()
      if (d.success) setStep('done')
      else setErr(d.error || 'خطأ في إنشاء الحساب')
    } catch { setErr('خطأ في الاتصال') }
    setLoading(false)
  }

  if (step === 'done') return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'radial-gradient(ellipse at 60% 20%,#001428,#070B12)', fontFamily:'Cairo,sans-serif', direction:'rtl', padding:16 }}>
      <div style={{ ...S.card, maxWidth:420, textAlign:'center' }}>
        <div style={{ fontSize:60, marginBottom:16 }}>✅</div>
        <h2 style={{ fontSize:22, fontWeight:900, color:'#00E676', marginBottom:10 }}>تم إنشاء حسابك!</h2>
        <p style={{ color:'#6B8CAE', lineHeight:1.8, marginBottom:24, fontSize:14 }}>
          تم إرسال رابط التفعيل على إيميلك.<br/>
          بعد التفعيل، يمكنك تسجيل الدخول ومتابعة طلب الباقة.
        </p>
        <a href="/dashboard" style={{ ...S.btn(), display:'block', textDecoration:'none', textAlign:'center', marginBottom:10 }}>🔐 تسجيل الدخول</a>
        <a href="/" style={{ color:'#6B8CAE', fontSize:13, textDecoration:'none' }}>← العودة للرئيسية</a>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'radial-gradient(ellipse at 60% 20%,#001428,#070B12)', fontFamily:'Cairo,sans-serif', direction:'rtl', padding:'40px 16px' }}>
      <div style={{ maxWidth:520, margin:'0 auto' }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <a href="/" style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:20, textDecoration:'none' }}>
            <div style={{ width:36, height:36, borderRadius:9, background:'linear-gradient(135deg,#0044AA,#00D4FF)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>📡</div>
            <span style={{ fontSize:16, fontWeight:900, color:'#00D4FF' }}>HotSpot Pro</span>
          </a>
          <h1 style={{ fontSize:24, fontWeight:900, color:'#E2F0FB', marginBottom:6 }}>إنشاء حساب جديد</h1>
          <p style={{ fontSize:13, color:'#6B8CAE' }}>ابدأ مجاناً — لا يحتاج بطاقة ائتمان</p>
        </div>

        <div style={S.card}>
          {/* زر جوجل — أول حاجة */}
          <a href={`/api/auth/google?mode=register&plan=${form.plan}`}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'12px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:10, color:'#E2F0FB', textDecoration:'none', fontSize:14, fontWeight:700, marginBottom:16, fontFamily:'Cairo,sans-serif' }}>
            <GoogleIcon/>
            سجّل بحساب Google
          </a>

          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <div style={{ flex:1, height:1, background:'#1C2A40' }}/>
            <span style={{ fontSize:11, color:'#354E6A' }}>أو بالبيانات</span>
            <div style={{ flex:1, height:1, background:'#1C2A40' }}/>
          </div>

          {/* اختيار الباقة */}
          <div style={{ marginBottom:20 }}>
            <label style={{ ...S.label, fontSize:13, marginBottom:10 }}>🎯 اختر باقتك:</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
              {plans.map(p => (
                <button key={p.id} onClick={()=>setForm({...form, plan:p.id})} style={{
                  padding:'10px 8px', borderRadius:10, cursor:'pointer', textAlign:'center',
                  border:`2px solid ${form.plan===p.id?p.color:'#1C2A40'}`,
                  background: form.plan===p.id?`${p.color}12`:'#070B12',
                  color: form.plan===p.id?p.color:'#6B8CAE',
                  fontFamily:'Cairo,sans-serif', fontSize:12, fontWeight:700, transition:'all 0.15s',
                }}>
                  <span style={{ fontSize:18 }}>{p.emoji}</span><br/>
                  {p.name}<br/>
                  <span style={{ fontSize:10, opacity:0.7 }}>{p.price===0?'مجاني':p.price+' ج/شهر'}</span>
                </button>
              ))}
            </div>
            {form.plan !== 'free' && (
              <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(0,212,255,0.06)', border:'1px solid rgba(0,212,255,0.15)', borderRadius:8, fontSize:11, color:'#6B8CAE', lineHeight:1.7 }}>
                💡 ستتمكن من إرسال طلب ترقية الباقة بعد تسجيل الدخول.
              </div>
            )}
          </div>

          {/* البيانات */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div style={{ gridColumn:'span 2' }}>
              <label style={S.label}>الاسم الكامل <span style={{color:'#FF4444'}}>*</span></label>
              <input style={S.input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="أحمد محمد" autoFocus/>
            </div>
            <div>
              <label style={S.label}>اسم المستخدم <span style={{color:'#FF4444'}}>*</span></label>
              <input style={{...S.input,fontFamily:'monospace',direction:'ltr'}} value={form.username} onChange={e=>setForm({...form,username:e.target.value.toLowerCase().replace(/\s/g,'')})} placeholder="ahmed_cafe"/>
            </div>
            <div>
              <label style={S.label}>رقم الهاتف</label>
              <input style={S.input} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="010xxxxxxxx"/>
            </div>
            <div style={{ gridColumn:'span 2' }}>
              <label style={S.label}>البريد الإلكتروني <span style={{color:'#FF4444'}}>*</span></label>
              <input style={{...S.input,direction:'ltr'}} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@cafe.com"/>
            </div>
            <div>
              <label style={S.label}>كلمة المرور <span style={{color:'#FF4444'}}>*</span></label>
              <input style={S.input} type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••"/>
            </div>
            <div>
              <label style={S.label}>تأكيد كلمة المرور</label>
              <input style={S.input} type="password" value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&submit()}/>
            </div>
          </div>

          {err && <div style={{ padding:'10px 14px', background:'rgba(255,68,68,0.08)', border:'1px solid rgba(255,68,68,0.25)', borderRadius:9, color:'#FF4444', fontSize:13, marginBottom:14 }}>⚠️ {err}</div>}

          <button style={{ ...S.btn(loading?'#1C2A40':'linear-gradient(135deg,#0088CC,#00D4FF)', loading?'#6B8CAE':'#000'), opacity:loading?0.7:1 }} onClick={submit} disabled={loading}>
            {loading ? '⏳ جاري إنشاء الحساب...' : `📋 إنشاء حساب ${selectedPlan?.emoji||''} ${selectedPlan?.name||''}`}
          </button>

          <p style={{ textAlign:'center', marginTop:16, fontSize:12, color:'#354E6A' }}>
            عندك حساب؟ <a href="/dashboard" style={{ color:'#00D4FF', textDecoration:'none' }}>سجّل الدخول</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>
}
