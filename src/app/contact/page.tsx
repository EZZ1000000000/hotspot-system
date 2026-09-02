'use client'
import { useState } from 'react'

export default function ContactPage() {
  const [form, setForm] = useState({ name:'', email:'', subject:'', message:'' })
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  const send = async () => {
    if (!form.name || !form.email || !form.message) { setMsg('❌ يرجى ملء جميع الحقول'); return }
    setSending(true); setMsg('')
    // إرسال بـ mailto fallback — يمكن ربطه بـ API لاحقاً
    try {
      const res = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (d.success) { setMsg('✅ تم إرسال رسالتك! سنرد خلال 24 ساعة'); setForm({ name:'', email:'', subject:'', message:'' }) }
      else setMsg('❌ خطأ في الإرسال، جرب مرة أخرى')
    } catch { setMsg('❌ خطأ في الاتصال') }
    setSending(false)
  }

  const S = {
    bg:    { minHeight:'100vh', background:'radial-gradient(ellipse at 60% 20%,#001428,#070B12)', color:'#E2F0FB', fontFamily:'Cairo,sans-serif', direction:'rtl' as const, padding:'0 0 60px' },
    nav:   { padding:'14px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(28,42,64,0.5)', background:'rgba(7,11,18,0.9)' },
    input: { width:'100%', padding:'11px 14px', background:'#070B12', border:'1px solid #1C2A40', borderRadius:10, color:'#E2F0FB', fontFamily:'Cairo,sans-serif', fontSize:14, outline:'none', boxSizing:'border-box' as const },
    label: { display:'block', fontSize:12, color:'#6B8CAE', marginBottom:6 } as React.CSSProperties,
    card:  { background:'rgba(12,20,32,0.8)', border:'1px solid rgba(28,42,64,0.8)', borderRadius:16, padding:'28px 24px' },
  }

  return (
    <div style={S.bg}>
      <nav style={S.nav}>
        <a href="/" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none'}}>
          <div style={{width:34,height:34,borderRadius:9,background:'linear-gradient(135deg,#0044AA,#00D4FF)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📡</div>
          <span style={{fontSize:16,fontWeight:900,color:'#00D4FF'}}>HotSpot Pro</span>
        </a>
        <a href="/" style={{fontSize:13,color:'#6B8CAE',textDecoration:'none'}}>← الرئيسية</a>
      </nav>

      <div style={{maxWidth:900,margin:'0 auto',padding:'40px 20px'}}>
        <div style={{textAlign:'center',marginBottom:40}}>
          <h1 style={{fontSize:'clamp(24px,5vw,38px)',fontWeight:900,color:'#00D4FF',marginBottom:10}}>اتصل بنا</h1>
          <p style={{fontSize:14,color:'#6B8CAE'}}>نرد على جميع الرسائل خلال 24 ساعة</p>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1.5fr',gap:20}}>
          {/* معلومات الاتصال */}
          <div>
            <div style={{...S.card,marginBottom:16}}>
              <h2 style={{fontSize:16,fontWeight:700,color:'#E2F0FB',marginBottom:20}}>طرق التواصل</h2>
              {[
                {icon:'📧', label:'البريد الإلكتروني', val:'4ahmedesampranks@gmail.com', href:'mailto:4ahmedesampranks@gmail.com'},
                {icon:'⏰', label:'أوقات الرد',         val:'الأحد - الخميس، 9ص - 6م',   href:null},
                {icon:'⚡', label:'وقت الرد',           val:'خلال 24 ساعة عمل',           href:null},
              ].map((c,i)=>(
                <div key={i} style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:18}}>
                  <div style={{width:38,height:38,borderRadius:10,background:'rgba(0,136,204,0.1)',border:'1px solid rgba(0,136,204,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{c.icon}</div>
                  <div>
                    <div style={{fontSize:11,color:'#6B8CAE',marginBottom:2}}>{c.label}</div>
                    {c.href
                      ? <a href={c.href} style={{fontSize:13,color:'#00D4FF',textDecoration:'none'}}>{c.val}</a>
                      : <div style={{fontSize:13,color:'#E2F0FB'}}>{c.val}</div>
                    }
                  </div>
                </div>
              ))}
            </div>

            <div style={{...S.card,background:'rgba(0,136,204,0.06)',border:'1px solid rgba(0,136,204,0.2)'}}>
              <div style={{fontSize:13,color:'#6B8CAE',lineHeight:1.8}}>
                💡 <strong style={{color:'#00D4FF'}}>للدعم الفني السريع:</strong><br/>
                اذكر في رسالتك اسم المستخدم والجهاز المعني حتى نتمكن من مساعدتك بشكل أسرع.
              </div>
            </div>
          </div>

          {/* نموذج الاتصال */}
          <div style={S.card}>
            <h2 style={{fontSize:16,fontWeight:700,color:'#E2F0FB',marginBottom:20}}>أرسل رسالة</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={S.label}>الاسم <span style={{color:'#FF4444'}}>*</span></label>
                <input style={S.input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="اسمك الكريم"/>
              </div>
              <div>
                <label style={S.label}>البريد الإلكتروني <span style={{color:'#FF4444'}}>*</span></label>
                <input style={{...S.input,direction:'ltr'}} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={S.label}>الموضوع</label>
              <input style={S.input} value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="موضوع رسالتك"/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={S.label}>الرسالة <span style={{color:'#FF4444'}}>*</span></label>
              <textarea rows={6} style={{...S.input,resize:'vertical',fontFamily:'Cairo,sans-serif'}}
                value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="اكتب رسالتك هنا..."/>
            </div>
            {msg && <div style={{padding:'10px 14px',borderRadius:9,marginBottom:14,background:msg.startsWith('✅')?'rgba(0,230,118,0.08)':'rgba(255,68,68,0.08)',border:`1px solid ${msg.startsWith('✅')?'rgba(0,230,118,0.25)':'rgba(255,68,68,0.25)'}`,color:msg.startsWith('✅')?'#00E676':'#FF4444',fontSize:13}}>{msg}</div>}
            <button onClick={send} disabled={sending}
              style={{width:'100%',padding:'13px',background:'linear-gradient(135deg,#0088CC,#00D4FF)',border:'none',borderRadius:10,color:'#000',fontFamily:'Cairo,sans-serif',fontSize:14,fontWeight:900,cursor:'pointer',opacity:sending?0.7:1}}>
              {sending ? '⏳ جاري الإرسال...' : '📤 إرسال الرسالة'}
            </button>
          </div>
        </div>
      </div>

      <footer style={{textAlign:'center',padding:'20px',borderTop:'1px solid rgba(28,42,64,0.4)',color:'#354E6A',fontSize:12}}>
        <a href="/privacy" style={{color:'#6B8CAE',textDecoration:'none',margin:'0 10px'}}>سياسة الخصوصية</a>
        <a href="/terms" style={{color:'#6B8CAE',textDecoration:'none',margin:'0 10px'}}>الشروط والأحكام</a>
        <a href="/about" style={{color:'#6B8CAE',textDecoration:'none',margin:'0 10px'}}>من نحن</a>
      </footer>
    </div>
  )
}
