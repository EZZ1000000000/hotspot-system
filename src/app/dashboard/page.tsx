'use client'
import { useState, useEffect, useCallback } from 'react'
import { getLang, setLang, t, type Lang } from '@/lib/i18n'

type Notification = { id:string; type:string; title:string; body:string; isRead:boolean; createdAt:string }

type Admin = { id:string; name:string; username:string; maxDevices:number; maxVouchersTotal:number; totalVouchersGenerated:number }
type Device = { id:string; name:string; gatewayId:string; location:string; isActive:boolean; routerIp:string; wifiSSID:string; description?:string; gatewayInterface?:string; externalInterface?:string; clientTimeout?:number; httpMaxConn?:number; tunnelPort?:number; _count:{sessions:number;vouchers:number} }
type Session = { id:string; macAddress:string; ipAddress:string; dataInMB:number; dataOutMB:number; timeUsedMin:number; startedAt:string; entryMethod?:string; voucher:{code:string;dataLimitMB:number|null;timeLimitMin:number|null;dataUsedMB:number;timeUsedMin:number;voucherType?:string} }
type Voucher = { id:string; code:string; status:string; packageType:string; voucherType:string; dataLimitMB:number|null; timeLimitMin:number|null; speedLimitMbps:number|null; dataUsedMB:number; timeUsedMin:number; usageCount:number; maxUsageCount:number; createdAt:string }
type PortalSettings = { placeName:string; wifiName:string; logoEmoji:string; codeMinLength:number; codeMaxLength:number; allowManual:boolean; allowNFC:boolean; allowQR:boolean }

const S = {
  card:  { background:'#0C1420', border:'1px solid #1C2A40', borderRadius:14, padding:20 } as React.CSSProperties,
  input: { width:'100%', padding:'11px 14px', background:'#070B12', border:'1px solid #1C2A40', borderRadius:10, color:'#E2F0FB', fontFamily:'Cairo,sans-serif', fontSize:14, outline:'none', boxSizing:'border-box' as const },
  btn:   (bg='#0088CC',color='#000') => ({ padding:'10px 18px', background:bg, border:'none', borderRadius:10, color, fontFamily:'Cairo,sans-serif', fontSize:13, fontWeight:700, cursor:'pointer' } as React.CSSProperties),
  label: { display:'block', fontSize:12, color:'#6B8CAE', marginBottom:6 } as React.CSSProperties,
}

const fmt = {
  data: (mb:number) => mb>=1024?(mb/1024).toFixed(2)+'GB':mb.toFixed(1)+'MB',
  time: (min:number) => min>=60?Math.floor(min/60)+'س '+Math.round(min%60)+'د':Math.round(min)+'د',
  pct:  (used:number,limit:number|null) => limit?Math.min(100,Math.round(used/limit*100)):0,
}

function LoginScreen({onLogin}:{onLogin:(a:Admin)=>void}) {
  const [user,setUser]=useState(''); const [pass,setPass]=useState(''); const [err,setErr]=useState(''); const [loading,setLoading]=useState(false)

  // لو جاي من Google OAuth — نحمّل الـ admin من الـ cookie
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search)
    const googleError=params.get('google_error')
    const welcome=params.get('welcome')
    if(googleError){
      const msgs:Record<string,string>={
        no_account:'مفيش حساب بهذا الإيميل، سجّل أولاً',
        inactive:'حسابك موقوف، تواصل مع الإدارة',
        token:'خطأ في التحقق من جوجل',
        server:'خطأ في السيرفر'
      }
      setErr(msgs[googleError]||'خطأ في تسجيل الدخول بجوجل')
      window.history.replaceState({},'','/dashboard')
      return
    }
    // لو في google session → حمّل الـ admin
    fetch('/api/auth/me').then(r=>r.json()).then(d=>{
      if(d.admin) onLogin(d.admin)
      else if(welcome==='google') setErr('حدث خطأ، حاول مرة أخرى')
    }).catch(()=>{})
  },[])

  const login = async () => {
    if(!user||!pass){setErr('أدخل اسم المستخدم وكلمة المرور');return}
    setLoading(true);setErr('')
    try{
      const res=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user,password:pass})})
      const data=await res.json()
      if(data.success&&data.admin) onLogin(data.admin)
      else setErr(data.error||'اسم المستخدم أو كلمة المرور غير صحيحة')
    }catch{setErr('خطأ في الاتصال')}
    finally{setLoading(false)}
  }
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'radial-gradient(ellipse at 70% 30%,#001428,#070B12)',fontFamily:'Cairo,sans-serif',direction:'rtl',padding:16}}>
      <div style={{...S.card,width:'100%',maxWidth:380,boxShadow:'0 0 60px rgba(0,212,255,0.08)'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:64,height:64,borderRadius:18,background:'linear-gradient(135deg,#0088CC,#00D4FF)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,margin:'0 auto 14px',boxShadow:'0 0 30px rgba(0,212,255,0.25)'}}>🖥️</div>
          <h1 style={{fontSize:22,fontWeight:900,color:'#00D4FF',margin:0}}>Hotspot Admin</h1>
          <p style={{fontSize:13,color:'#6B8CAE',marginTop:4}}>لوحة التحكم</p>
        </div>
        <div style={{marginBottom:14}}><label style={S.label}>اسم المستخدم</label><input style={S.input} value={user} onChange={e=>setUser(e.target.value)} placeholder="username" autoFocus/></div>
        <div style={{marginBottom:20}}><label style={S.label}>كلمة المرور</label><input style={S.input} type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="••••••••"/></div>
        {err&&<p style={{color:'#FF4444',fontSize:13,textAlign:'center',marginBottom:12}}>⚠️ {err}</p>}
        <button style={{...S.btn(),width:'100%',padding:'13px',opacity:loading?0.7:1}} onClick={login} disabled={loading}>{loading?'جاري الدخول...':'🔐 دخول'}</button>
        {/* ديفيدر */}
        <div style={{display:'flex',alignItems:'center',gap:10,margin:'16px 0'}}>
          <div style={{flex:1,height:1,background:'#1C2A40'}}/>
          <span style={{fontSize:11,color:'#354E6A'}}>أو</span>
          <div style={{flex:1,height:1,background:'#1C2A40'}}/>
        </div>
        <a href="/api/auth/google?mode=login"
          style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'12px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,color:'#E2F0FB',textDecoration:'none',fontSize:13,fontWeight:700,fontFamily:'Cairo,sans-serif'}}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
          تسجيل الدخول بجوجل
        </a>
        <p style={{textAlign:'center',marginTop:14,fontSize:12,color:'#354E6A'}}>
          <a href="/register" style={{color:'#00D4FF',textDecoration:'none'}}>جديد؟ سجّل حسابك</a>
          {' · '}
          <a href="/superadmin" style={{color:'#6B8CAE',textDecoration:'none'}}>Super Admin</a>
        </p>
      </div>
    </div>
  )
}

function PortalSettingsTab({ devices, adminId }: { devices: Device[], adminId: string }) {
  const [selectedDevice,setSelectedDevice]=useState<Device|null>(null)
  const [settings,setSettings]=useState<PortalSettings>({placeName:'',wifiName:'',logoEmoji:'📶',codeMinLength:8,codeMaxLength:19,allowManual:true,allowNFC:true,allowQR:true})
  const [loading,setLoading]=useState(false); const [saving,setSaving]=useState(false); const [msg,setMsg]=useState('')

  const loadSettings = async (device:Device) => {
    setSelectedDevice(device); setLoading(true); setMsg('')
    try{
      const res=await fetch(`/api/portal/settings?gw_id=${device.gatewayId}`)
      const data=await res.json()
      setSettings({placeName:data.placeName??device.name,wifiName:data.wifiName??device.wifiSSID??'',logoEmoji:data.logoEmoji??'📶',codeMinLength:data.codeMinLength??8,codeMaxLength:data.codeMaxLength??19,allowManual:data.allowManual??true,allowNFC:data.allowNFC??true,allowQR:data.allowQR??true})
    }catch{setMsg('❌ خطأ في تحميل الإعدادات')}
    finally{setLoading(false)}
  }

  const saveSettings = async () => {
    if(!selectedDevice) return
    if(!settings.placeName.trim()){setMsg('❌ أدخل اسم المكان');return}
    if(!settings.wifiName.trim()){setMsg('❌ أدخل اسم الـ WiFi');return}
    if(settings.codeMaxLength<settings.codeMinLength){setMsg('❌ الحد الأقصى يجب أن يكون أكبر من الأدنى');return}
    setSaving(true); setMsg('')
    try{
      const res=await fetch('/api/portal/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:selectedDevice.id,...settings})})
      const data=await res.json()
      if(data.success) setMsg('✅ تم حفظ الإعدادات بنجاح')
      else setMsg('❌ '+(data.error||'خطأ في الحفظ'))
    }catch{setMsg('❌ خطأ في الاتصال')}
    finally{setSaving(false)}
  }

  const EMOJIS=['📶','🌐','⚡','☕','🍕','🎮','🏨','🏪','🏥','🎓','✈️','🚌']

  return (
    <div>
      <div style={{...S.card,marginBottom:16}}>
        <h3 style={{fontSize:15,fontWeight:700,color:'#E2F0FB',marginBottom:12}}>🌐 إعدادات البوابة</h3>
        {devices.length===0?(
          <div style={{textAlign:'center',padding:32,color:'#6B8CAE'}}><div style={{fontSize:40,marginBottom:8}}>🖥️</div><p>أضف جهاز أولاً من تاب "الأجهزة"</p></div>
        ):(
          <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
            {devices.map(d=>(
              <button key={d.id} onClick={()=>loadSettings(d)} style={{padding:'10px 18px',borderRadius:10,cursor:'pointer',background:selectedDevice?.id===d.id?'linear-gradient(135deg,#0088CC,#00D4FF)':'#070B12',border:`1px solid ${selectedDevice?.id===d.id?'#00D4FF':'#1C2A40'}`,color:selectedDevice?.id===d.id?'#000':'#6B8CAE',fontFamily:'Cairo,sans-serif',fontSize:13,fontWeight:700,transition:'all 0.2s'}}>
                🖥️ {d.name}{d.wifiSSID&&<span style={{fontSize:11,opacity:0.75,marginRight:6}}>({d.wifiSSID})</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedDevice&&(
        <div style={S.card}>
          {loading?<div style={{textAlign:'center',padding:40,color:'#6B8CAE'}}>⏳ جاري التحميل...</div>:(
            <>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,gap:10,flexWrap:'wrap'}}>
                <div>
                  <h3 style={{fontSize:15,fontWeight:700,color:'#E2F0FB',margin:0}}>إعدادات: {selectedDevice.name}</h3>
                  <p style={{fontSize:11,color:'#354E6A',marginTop:4,fontFamily:'monospace'}}>{selectedDevice.gatewayId}</p>
                </div>
                <a href={`/portal?gw_id=${selectedDevice.gatewayId}`} target="_blank" style={{padding:'8px 14px',background:'#111B2D',border:'1px solid #1C2A40',borderRadius:9,color:'#00D4FF',fontSize:12,textDecoration:'none',fontFamily:'Cairo,sans-serif',whiteSpace:'nowrap'}}>👁️ معاينة</a>
              </div>
              {msg&&<div style={{padding:'11px 14px',borderRadius:10,marginBottom:16,background:msg.startsWith('✅')?'rgba(0,230,118,0.1)':'rgba(255,68,68,0.1)',border:`1px solid ${msg.startsWith('✅')?'rgba(0,230,118,0.3)':'rgba(255,68,68,0.3)'}`,color:msg.startsWith('✅')?'#00E676':'#FF4444',fontSize:13}}>{msg}</div>}

              <div className="form-grid-2" style={{marginBottom:20}}>
                <div><label style={S.label}>🏷️ اسم المكان</label><input style={S.input} value={settings.placeName} onChange={e=>setSettings({...settings,placeName:e.target.value})} placeholder="مثال: كافيه النيل"/></div>
                <div><label style={S.label}>📶 اسم الـ WiFi</label><input style={{...S.input,textAlign:'left',fontFamily:'monospace',direction:'ltr'}} value={settings.wifiName} onChange={e=>setSettings({...settings,wifiName:e.target.value})} placeholder="CafeNile_Free"/></div>
                <div style={{gridColumn:'span 2'}}>
                  <label style={S.label}>🎨 الأيقونة</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:4}}>
                    {EMOJIS.map(e=>(<button key={e} onClick={()=>setSettings({...settings,logoEmoji:e})} style={{width:44,height:44,fontSize:22,border:'2px solid',borderRadius:10,cursor:'pointer',background:settings.logoEmoji===e?'rgba(0,212,255,0.15)':'#070B12',borderColor:settings.logoEmoji===e?'#00D4FF':'#1C2A40'}}>{e}</button>))}
                  </div>
                </div>
              </div>

              <div style={{borderTop:'1px solid #1C2A40',margin:'0 0 20px'}}/>
              <div className="form-grid-2" style={{marginBottom:20}}>
                <div>
                  <label style={S.label}>🔢 الحد الأدنى للكود</label>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <button onClick={()=>setSettings(s=>({...s,codeMinLength:Math.max(1,s.codeMinLength-1)}))} style={{width:36,height:36,background:'#1C2A40',border:'none',borderRadius:8,color:'#E2F0FB',fontSize:18,cursor:'pointer',flexShrink:0}}>−</button>
                    <input type="number" min={1} max={settings.codeMaxLength} value={settings.codeMinLength} onChange={e=>setSettings({...settings,codeMinLength:Math.max(1,+e.target.value)})} style={{...S.input,textAlign:'center',fontSize:18,fontWeight:700,color:'#00D4FF',padding:'8px'}}/>
                    <button onClick={()=>setSettings(s=>({...s,codeMinLength:Math.min(s.codeMaxLength,s.codeMinLength+1)}))} style={{width:36,height:36,background:'#1C2A40',border:'none',borderRadius:8,color:'#E2F0FB',fontSize:18,cursor:'pointer',flexShrink:0}}>+</button>
                  </div>
                </div>
                <div>
                  <label style={S.label}>🔢 الحد الأقصى للكود</label>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <button onClick={()=>setSettings(s=>({...s,codeMaxLength:Math.max(s.codeMinLength,s.codeMaxLength-1)}))} style={{width:36,height:36,background:'#1C2A40',border:'none',borderRadius:8,color:'#E2F0FB',fontSize:18,cursor:'pointer',flexShrink:0}}>−</button>
                    <input type="number" min={settings.codeMinLength} max={32} value={settings.codeMaxLength} onChange={e=>setSettings({...settings,codeMaxLength:Math.max(settings.codeMinLength,+e.target.value)})} style={{...S.input,textAlign:'center',fontSize:18,fontWeight:700,color:'#00D4FF',padding:'8px'}}/>
                    <button onClick={()=>setSettings(s=>({...s,codeMaxLength:Math.min(32,s.codeMaxLength+1)}))} style={{width:36,height:36,background:'#1C2A40',border:'none',borderRadius:8,color:'#E2F0FB',fontSize:18,cursor:'pointer',flexShrink:0}}>+</button>
                  </div>
                </div>
              </div>

              <div style={{marginTop:8,padding:'10px 14px',background:'rgba(0,136,204,0.06)',border:'1px solid rgba(0,136,204,0.15)',borderRadius:10,fontSize:12,color:'#6B8CAE',marginBottom:20}}>
                ℹ️ طرق الدخول بـ <strong style={{color:'#00D4FF'}}>NFC</strong> و<strong style={{color:'#00D4FF'}}>QR</strong> يتحكم فيها السوبر أدمن
              </div>

              <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
                <button style={{...S.btn(),padding:'13px 28px',fontSize:15,opacity:saving?0.7:1}} onClick={saveSettings} disabled={saving}>{saving?'⏳ جاري الحفظ...':'💾 حفظ الإعدادات'}</button>
                <a href={`/portal?gw_id=${selectedDevice.gatewayId}`} target="_blank" style={{padding:'13px 20px',background:'#111B2D',border:'1px solid #1C2A40',borderRadius:10,color:'#6B8CAE',fontSize:13,textDecoration:'none',fontFamily:'Cairo,sans-serif',fontWeight:700}}>👁️ معاينة</a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// تاب طلب الباقة — للأدمن العادي
// ═══════════════════════════════════════════
function PlanRequestTab({ adminId }: { adminId: string }) {
  const [plans, setPlans]               = useState<any[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string|null>(null)
  const [note, setNote]                 = useState('')
  const [receipt, setReceipt]           = useState('')
  const [receiptImage, setReceiptImage] = useState<string|null>(null)
  const [imageFileName, setImageFileName] = useState('')
  const [sending, setSending]           = useState(false)
  const [msg, setMsg]                   = useState('')
  const [myRequests, setMyRequests]     = useState<any[]>([])
  const [loadingReqs, setLoadingReqs]   = useState(true)
  const [viewImg, setViewImg]           = useState<string|null>(null)

  useEffect(() => {
    fetch('/api/superadmin/manage-plans').then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setPlans(d) })
  }, [])

  const loadRequests = async () => {
    setLoadingReqs(true)
    try {
      const res  = await fetch(`/api/admin/plan-request?adminId=${adminId}`)
      const data = await res.json()
      if (Array.isArray(data)) setMyRequests(data)
    } catch {}
    setLoadingReqs(false)
  }

  useEffect(() => { loadRequests() }, [adminId])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { setMsg('❌ الصورة أكبر من 3MB'); return }
    setImageFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => setReceiptImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const sendRequest = async () => {
    if (!selectedPlan) { setMsg('❌ اختر الباقة أولاً'); return }
    const plan = plans.find(p => p.id === selectedPlan)
    if (!plan) return
    setSending(true); setMsg('')
    try {
      const res = await fetch('/api/admin/plan-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, planId: selectedPlan, planName: plan.name, note, receiptText: receipt, receiptImageUrl: receiptImage }),
      })
      const data = await res.json()
      if (data.success) {
        setMsg('✅ تم إرسال طلبك! سيتم مراجعته من السوبر أدمن.')
        setSelectedPlan(null); setNote(''); setReceipt(''); setReceiptImage(null); setImageFileName('')
        loadRequests()
      } else {
        setMsg('❌ ' + (data.error || 'خطأ في الإرسال'))
      }
    } catch { setMsg('❌ خطأ في الاتصال') }
    setSending(false)
  }

  const statusColor = (s: string) => s==='APPROVED'?'#00E676':s==='REJECTED'?'#FF4444':'#fb923c'
  const statusLabel = (s: string) => s==='APPROVED'?'✅ موافق عليه':s==='REJECTED'?'❌ مرفوض':'⏳ قيد المراجعة'

  return (
    <div>
      {/* modal عرض الصورة */}
      {viewImg && (
        <div style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setViewImg(null)}>
          <img src={viewImg} alt="receipt" style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:12,border:'1px solid #1C2A40'}}/>
        </div>
      )}

      {/* الباقات */}
      <div style={{...S.card, marginBottom:16}}>
        <h3 style={{fontSize:15,fontWeight:700,color:'#E2F0FB',marginBottom:6}}>💎 اختر الباقة المناسبة</h3>
        <p style={{fontSize:12,color:'#6B8CAE',marginBottom:16}}>اختر الباقة ثم ارفع بيانات الحوالة — سيراجعها السوبر أدمن ويفعّلها لك.</p>
        {plans.length === 0 ? (
          <div style={{textAlign:'center',padding:24,color:'#354E6A',fontSize:13}}>⏳ جاري تحميل الباقات...</div>
        ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10,marginBottom:16}}>
          {plans.filter(p=>p.isActive).map(plan => (
            <div key={plan.id} onClick={()=>setSelectedPlan(plan.id)}
              style={{background:'#070B12',border:`2px solid ${selectedPlan===plan.id?plan.color:'#1C2A40'}`,borderRadius:12,padding:14,cursor:'pointer',transition:'all 0.2s',boxShadow:selectedPlan===plan.id?`0 0 20px ${plan.color}30`:undefined}}>
              <div style={{fontSize:26,marginBottom:6,textAlign:'center'}}>{plan.emoji}</div>
              <div style={{fontWeight:900,color:plan.color,fontSize:14,textAlign:'center',marginBottom:2}}>{plan.name}</div>
              {plan.price > 0 && <div style={{fontSize:12,color:'#E2F0FB',textAlign:'center',marginBottom:8,fontWeight:700}}>{plan.price} ج/شهر</div>}
              {plan.price === 0 && <div style={{fontSize:12,color:'#6B8CAE',textAlign:'center',marginBottom:8}}>مجاناً</div>}
              <div style={{fontSize:10,color:'#6B8CAE'}}>
                <div style={{marginBottom:2}}>🖥️ {plan.maxDevices} {plan.maxDevices===1?'جهاز':'أجهزة'} · 🎫 {plan.maxVouchersTotal} كارت</div>
                {plan.canCreateQR && <div style={{marginTop:2}}>• QR Code</div>}
                {plan.canCreateNFC && <div style={{marginTop:2}}>• NFC</div>}
                {plan.canCreateUnlimited && <div style={{marginTop:2}}>• ♾️ Unlimited</div>}
                {plan.description && <div style={{marginTop:4,color:'#354E6A'}}>{plan.description}</div>}
              </div>
              {selectedPlan===plan.id && <div style={{textAlign:'center',marginTop:8,fontSize:11,fontWeight:900,color:plan.color}}>✓ محدد</div>}
            </div>
          ))}
        </div>
        )}

        {selectedPlan && (
          <>
            <div style={{borderTop:'1px solid #1C2A40',margin:'0 0 16px'}}/>
            <div style={{marginBottom:12}}>
              <label style={S.label}>📝 ملاحظة (اختياري)</label>
              <input style={S.input} value={note} onChange={e=>setNote(e.target.value)} placeholder="مثال: أريد ترقية لباقة الاحترافي"/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={S.label}>💳 بيانات الحوالة / الإيصال (نص)</label>
              <textarea value={receipt} onChange={e=>setReceipt(e.target.value)} placeholder="الصق هنا بيانات الحوالة أو رقم الإيصال أو تفاصيل الدفع..." rows={3}
                style={{...S.input,resize:'vertical',fontFamily:'Cairo,sans-serif',fontSize:13}}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={S.label}>📸 صورة الإيصال / الحوالة (اختياري)</label>
              <label style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',background:'#070B12',border:'2px dashed #1C2A40',borderRadius:10,cursor:'pointer',color:'#6B8CAE',fontSize:13}}>
                <span style={{fontSize:22}}>📷</span>
                <span>{imageFileName || 'اضغط لرفع صورة الإيصال...'}</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{display:'none'}}/>
              </label>
              {receiptImage && (
                <div style={{marginTop:8,display:'flex',alignItems:'center',gap:10}}>
                  <img src={receiptImage} alt="preview" onClick={()=>setViewImg(receiptImage)} style={{width:80,height:60,objectFit:'cover',borderRadius:8,border:'1px solid #1C2A40',cursor:'pointer'}}/>
                  <div>
                    <div style={{fontSize:11,color:'#00E676',marginBottom:4}}>✅ الصورة جاهزة</div>
                    <button onClick={()=>{setReceiptImage(null);setImageFileName('')}} style={{...S.btn('rgba(255,68,68,0.1)','#FF4444'),border:'1px solid rgba(255,68,68,0.25)',fontSize:10,padding:'3px 8px'}}>✕ حذف</button>
                  </div>
                </div>
              )}
              <p style={{fontSize:10,color:'#354E6A',marginTop:6}}>📌 ارفع صورة أو بيانات الدفع وسيتم التحقق منها وتفعيل الباقة خلال 24 ساعة.</p>
            </div>
            {msg && <div style={{padding:'11px 14px',borderRadius:10,marginBottom:12,background:msg.startsWith('✅')?'rgba(0,230,118,0.1)':'rgba(255,68,68,0.1)',border:`1px solid ${msg.startsWith('✅')?'rgba(0,230,118,0.3)':'rgba(255,68,68,0.3)'}`,color:msg.startsWith('✅')?'#00E676':'#FF4444',fontSize:13}}>{msg}</div>}
            <button onClick={sendRequest} disabled={sending}
              style={{...S.btn('linear-gradient(135deg,#0088CC,#00D4FF)','#000'),width:'100%',padding:'13px',fontSize:15,opacity:sending?0.7:1}}>
              {sending?'⏳ جاري الإرسال...':'📤 إرسال طلب الباقة'}
            </button>
          </>
        )}
      </div>

      {/* سجل الطلبات السابقة */}
      <div style={S.card}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <h3 style={{fontSize:14,fontWeight:700,color:'#E2F0FB'}}>📋 طلباتي السابقة</h3>
          <button onClick={loadRequests} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'5px 10px'}}>🔄</button>
        </div>
        {loadingReqs ? (
          <div style={{textAlign:'center',padding:24,color:'#6B8CAE'}}>⏳ جاري التحميل...</div>
        ) : myRequests.length === 0 ? (
          <div style={{textAlign:'center',padding:24,color:'#354E6A',fontSize:13}}>لا يوجد طلبات سابقة</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {myRequests.map(r => (
              <div key={r.id} style={{background:'#070B12',border:`1px solid ${statusColor(r.status)}30`,borderRadius:10,padding:'12px 14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                  <div>
                    <div style={{fontWeight:700,color:'#E2F0FB',fontSize:13}}>💎 {r.planName}</div>
                    <div style={{fontSize:10,color:'#6B8CAE',marginTop:3}}>{new Date(r.createdAt).toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'})}</div>
                    {r.note && <div style={{fontSize:11,color:'#6B8CAE',marginTop:4}}>📝 {r.note}</div>}
                    {r.status==='REJECTED' && r.reviewNote && <div style={{fontSize:11,color:'#FF4444',marginTop:4}}>⚠️ {r.reviewNote}</div>}
                  </div>
                  <span style={{padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:`${statusColor(r.status)}15`,color:statusColor(r.status),border:`1px solid ${statusColor(r.status)}40`,whiteSpace:'nowrap'}}>
                    {statusLabel(r.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RouterSetupTab({ devices }: { devices: Device[] }) {
  const [sel,setSel]=useState<Device|null>(null); const [copied,setCopied]=useState('')
  const [scriptText,setScriptText]=useState('')

  // السكربت الرسمي الموحد من السيرفر — مصدر واحد للحقيقة
  // (سكربت واحد لكل حاجة: تسطيب + جسر HTTPS + إصلاح التفعيل + SSID + اختبار ذاتي)
  useEffect(()=>{
    if(!sel) return
    setScriptText('')
    fetch(`/api/admin/config?deviceId=${sel.id}&type=script`).then(r=>r.text()).then(setScriptText).catch(()=>{})
  },[sel?.id])

  const copy=async(text:string,id:string)=>{try{await navigator.clipboard.writeText(text)}catch(e){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta)};setCopied(id);setTimeout(()=>setCopied(''),2500)}
  const download=(text:string,name:string)=>{const b=new Blob([text],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click()}

  if(devices.length===0) return <div style={{...S.card,textAlign:'center',padding:60,color:'#6B8CAE'}}><div style={{fontSize:52,marginBottom:14}}>🖥️</div><p>أضف جهاز من تاب "الأجهزة" أولاً</p></div>

  return (
    <div>
      {devices.length>1&&(
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
          {devices.map(d=>(
            <button key={d.id} onClick={()=>{setSel(d)}} style={{padding:'10px 18px',borderRadius:10,cursor:'pointer',fontFamily:'Cairo,sans-serif',fontSize:13,fontWeight:700,background:sel?.id===d.id?'linear-gradient(135deg,#0088CC,#00D4FF)':'#0C1420',border:`1px solid ${sel?.id===d.id?'#00D4FF':'#1C2A40'}`,color:sel?.id===d.id?'#000':'#6B8CAE',display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:d.isActive?'#00E676':'#FF4444',display:'inline-block'}}/>{d.name}
            </button>
          ))}
        </div>
      )}
      {devices.length===1&&!sel&&(()=>{setTimeout(()=>setSel(devices[0]),0);return null})()}
      {(sel||devices.length===1)&&(()=>{
        const d=sel||devices[0]
        return (
          <div key={d.id}>
            <div style={{...S.card,marginBottom:12,padding:'14px 18px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
                <div>
                  <div style={{fontSize:15,fontWeight:800,color:'#E2F0FB',display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:10,height:10,borderRadius:'50%',background:d.isActive?'#00E676':'#FF4444',display:'inline-block'}}/>
                    {d.name}
                    {d.tunnelPort&&<span style={{fontSize:11,color:'#6B8CAE',fontFamily:'monospace',fontWeight:400}}>tunnel:{d.tunnelPort}</span>}
                  </div>
                  <div style={{fontSize:11,color:'#6B8CAE',marginTop:4,display:'flex',gap:12,flexWrap:'wrap'}}>
                    {d.routerIp&&<span>🌐 {d.routerIp}</span>}
                    {d.wifiSSID&&<span>📶 {d.wifiSSID}</span>}
                  </div>
                </div>
                <a href={`/portal?gw_id=${d.gatewayId}`} target="_blank" style={{...S.btn('#111B2D','#00D4FF'),border:'1px solid #1C2A40',textDecoration:'none',fontSize:12,padding:'8px 14px'}}>👁️ معاينة</a>
              </div>
            </div>

            {/* السكربت الموحد الشامل — سكربت واحد لكل حاجة */}
            <div style={{...S.card,marginBottom:12,border:'1.5px solid rgba(0,212,255,0.35)'}}>
              <div style={{fontSize:15,fontWeight:800,color:'#00D4FF',marginBottom:8}}>🚀 السكربت الشامل الموحد — تسطيب + إصلاح في سكربت واحد</div>
              <div style={{fontSize:12,color:'#6B8CAE',lineHeight:2,marginBottom:12}}>
                ده <strong style={{color:'#E2F0FB'}}>السكريبت الوحيد</strong> اللي محتاجه لأي جهاز — جديد أو قديم فيه مشكلة:
                بيسطّب wifidog + جسر HTTPS محلي، يكتب الإعدادات الصحيحة، يغيّر اسم الشبكة (2.4GHz و 5GHz)، ينضّف أي إصلاحات قديمة،
                وبيقيس كل حاجة بنفسه في الآخر ويقولك النتيجة.
                <br/>✅ بيصلح نهائياً خطأ <strong style={{color:'#E2F0FB'}}>Error: We did not get a valid answer from the central server</strong>
                &nbsp;·&nbsp;✅ آمن لإعادة التشغيل — ينفع يتعمل run أكتر من مرة
              </div>
              <div style={{background:'rgba(0,0,0,0.3)',borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:12,color:'#E2F0FB',lineHeight:2.2}}>
                <strong style={{color:'#00D4FF'}}>طريقة التشغيل — 3 خطوات:</strong><br/>
                1️⃣ من كمبيوتر متصل بنفس شبكة الراوتر: <code style={{background:'#020608',padding:'2px 8px',borderRadius:6,color:'#7dd3fc',direction:'ltr',display:'inline-block'}}>ssh root@{d.routerIp||'192.168.1.1'}</code><br/>
                2️⃣ الصق الأمر ده واضغط Enter:<br/>
                <code style={{background:'#020608',padding:'4px 8px',borderRadius:6,color:'#7dd3fc',direction:'ltr',display:'block',marginTop:6,whiteSpace:'pre-wrap',wordBreak:'break-all'}}>wget -q -O /tmp/hotspot.sh "https://{typeof window!=='undefined'?window.location.host:''}/api/admin/config?deviceId={d.id}&type=script" && sh /tmp/hotspot.sh</code><br/>
                3️⃣ استنى كل الاختبارات ✅ (لازم تشوف: 🎉 النتيجة: كل حاجة تمام) — وبعدها اعزل الواي فاي من الموبايل وارجع اتصل وادخل الكرت
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:8}}>
                <div style={{fontSize:12,color:'#6B8CAE'}}>محتوى السكريبت {scriptText?`(${Math.round(scriptText.length/1024)}KB)`:''}</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  <button onClick={()=>copy(scriptText,'cmds-'+d.id)} style={{...S.btn(copied==='cmds-'+d.id?'#00E676':'linear-gradient(135deg,#0088CC,#00D4FF)',copied==='cmds-'+d.id?'#000':'#000'),padding:'8px 16px',fontSize:12}}>{copied==='cmds-'+d.id?'✅ تم النسخ':'📋 نسخ السكريبت'}</button>
                  <button onClick={()=>download(scriptText,`install-${d.gatewayId}.sh`)} style={{...S.btn('#0C1420','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'6px 12px'}}>⬇️ تحميل</button>
                </div>
              </div>
              <pre style={{background:'#020608',border:'1px solid #0C1420',borderRadius:10,padding:14,fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'#7dd3fc',lineHeight:1.8,overflowX:'auto',maxHeight:380,direction:'ltr',textAlign:'left',margin:0,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{scriptText||'⏳ جاري تحميل السكريبت...'}</pre>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function SalesTab({ adminId, vouchers, loadVouchers }: { adminId:string; vouchers:Voucher[]; loadVouchers:()=>void }) {
  const [sales,setSales]=useState<any[]>([]); const [period,setPeriod]=useState('month'); const [totalRev,setTotalRev]=useState(0)
  const [loading,setLoading]=useState(false); const [msg,setMsg]=useState(''); const [showNew,setShowNew]=useState(false)
  const [form,setForm]=useState({voucherId:'',amount:'',buyerName:'',paymentMethod:'CASH',note:''})

  const loadSales=async()=>{setLoading(true);try{const r=await fetch(`/api/admin/sales?adminId=${adminId}&period=${period}`);const d=await r.json();setSales(d.sales||[]);setTotalRev(d.totalRevenue||0)}catch{}setLoading(false)}
  useEffect(()=>{loadSales()},[period])
  useEffect(()=>{if(vouchers.length===0)loadVouchers()},[])

  const recordSale=async()=>{
    if(!form.voucherId||!form.amount){setMsg('❌ اختار الكارت وأدخل السعر');return}
    const r=await fetch('/api/admin/sales',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,hotspotAdminId:adminId,amount:+form.amount})})
    const d=await r.json()
    if(d.success){setMsg('✅ تم تسجيل البيعة');setShowNew(false);setForm({voucherId:'',amount:'',buyerName:'',paymentMethod:'CASH',note:''});loadSales()}
    else setMsg('❌ '+(d.error||'خطأ'))
  }

  const unusedVouchers=vouchers.filter(v=>v.status==='UNUSED')
  const PMETHODS=[{v:'CASH',l:'💵 كاش'},{v:'CARD',l:'💳 كارت'},{v:'TRANSFER',l:'📲 تحويل'}]
  const PERIODS=[{v:'day',l:'اليوم'},{v:'week',l:'الأسبوع'},{v:'month',l:'الشهر'},{v:'all',l:'الكل'}]

  return (
    <div>
      <div className="stats-grid-4" style={{marginBottom:14}}>
        {[{icon:'💰',label:'الإيرادات',val:totalRev.toFixed(2)+' ج',color:'#00E676'},{icon:'🎫',label:'مبيعات',val:sales.length,color:'#00D4FF'},{icon:'📦',label:'كروت متاحة',val:unusedVouchers.length,color:'#818cf8'},{icon:'📈',label:'متوسط البيعة',val:sales.length?(totalRev/sales.length).toFixed(1)+' ج':'—',color:'#fb923c'}].map((s,i)=>(
          <div key={i} style={{...S.card,textAlign:'center',padding:14}}><div style={{fontSize:20,marginBottom:5}}>{s.icon}</div><div style={{fontSize:18,fontWeight:900,color:s.color}}>{s.val}</div><div style={{fontSize:10,color:'#354E6A',marginTop:2}}>{s.label}</div></div>
        ))}
      </div>
      {msg&&<div style={{padding:'10px 14px',borderRadius:10,marginBottom:12,background:msg.startsWith('✅')?'rgba(0,230,118,0.08)':'rgba(255,68,68,0.08)',border:`1px solid ${msg.startsWith('✅')?'rgba(0,230,118,0.25)':'rgba(255,68,68,0.25)'}`,color:msg.startsWith('✅')?'#00E676':'#FF4444',fontSize:13,display:'flex',justifyContent:'space-between'}}>{msg}<span onClick={()=>setMsg('')} style={{cursor:'pointer',opacity:0.6}}>✕</span></div>}
      <div style={{...S.card,marginBottom:12,padding:12,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{PERIODS.map(p=>(<button key={p.v} onClick={()=>setPeriod(p.v)} style={{...S.btn(period===p.v?'#0088CC':'#111B2D',period===p.v?'#000':'#6B8CAE'),border:'1px solid #1C2A40',fontSize:12,padding:'7px 12px'}}>{p.l}</button>))}</div>
        <div style={{flex:1}}/>
        <button onClick={()=>setShowNew(n=>!n)} style={{...S.btn('linear-gradient(135deg,#0088CC,#00D4FF)'),fontSize:13,padding:'9px 18px'}}>+ تسجيل بيعة</button>
      </div>
      {showNew&&(
        <div style={{...S.card,marginBottom:14,border:'1px solid rgba(0,212,255,0.2)'}}>
          <h3 style={{fontSize:14,fontWeight:700,color:'#E2F0FB',marginBottom:14}}>💰 تسجيل بيعة جديدة</h3>
          <div className="form-grid-2" style={{marginBottom:12}}>
            <div style={{gridColumn:'span 2'}}><label style={S.label}>الكارت المُباع</label><select style={{...S.input}} value={form.voucherId} onChange={e=>setForm({...form,voucherId:e.target.value})}><option value=''>اختر كارت...</option>{unusedVouchers.map(v=>(<option key={v.id} value={v.id}>{v.code} — {v.dataLimitMB?fmt.data(v.dataLimitMB):'∞'}</option>))}</select></div>
            <div><label style={S.label}>السعر (جنيه)</label><input style={S.input} type='number' min='0' step='0.5' value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder='15.00'/></div>
            <div><label style={S.label}>اسم العميل</label><input style={S.input} value={form.buyerName} onChange={e=>setForm({...form,buyerName:e.target.value})} placeholder='اختياري'/></div>
            <div><label style={S.label}>طريقة الدفع</label><div style={{display:'flex',gap:5}}>{PMETHODS.map(p=>(<button key={p.v} onClick={()=>setForm({...form,paymentMethod:p.v})} style={{...S.btn(form.paymentMethod===p.v?'#0088CC':'#111B2D',form.paymentMethod===p.v?'#000':'#6B8CAE'),border:'1px solid #1C2A40',flex:1,fontSize:11,padding:'8px 4px'}}>{p.l}</button>))}</div></div>
            <div><label style={S.label}>ملاحظة</label><input style={S.input} value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder='اختياري'/></div>
          </div>
          <div style={{display:'flex',gap:10}}><button style={{...S.btn(),padding:'10px 24px'}} onClick={recordSale}>💾 تسجيل</button><button style={{...S.btn('#1C2A40','#6B8CAE'),border:'1px solid #1C2A40'}} onClick={()=>setShowNew(false)}>إلغاء</button></div>
        </div>
      )}
      <div style={S.card}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><h3 style={{fontSize:14,fontWeight:700,color:'#E2F0FB'}}>📋 سجل المبيعات</h3>{loading&&<span style={{fontSize:12,color:'#6B8CAE'}}>⏳</span>}</div>
        {sales.length===0?(<div style={{textAlign:'center',padding:'32px 0',color:'#6B8CAE'}}><div style={{fontSize:40,marginBottom:8}}>💰</div><div>لا توجد مبيعات بعد</div></div>):(
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:480}}>
              <thead><tr style={{borderBottom:'1px solid #1C2A40'}}>{['الكارت','السعر','العميل','الدفع','التاريخ'].map(h=>(<th key={h} style={{padding:'8px 10px',color:'#6B8CAE',fontWeight:600,textAlign:'right',whiteSpace:'nowrap'}}>{h}</th>))}</tr></thead>
              <tbody>
                {sales.map((s:any)=>(
                  <tr key={s.id} style={{borderBottom:'1px solid #0C1420'}}>
                    <td style={{padding:'8px 10px',fontFamily:'monospace',color:'#00D4FF',fontSize:11}}>{s.voucher?.code||'—'}</td>
                    <td style={{padding:'8px 10px',color:'#00E676',fontWeight:700}}>{(s.amount||0).toFixed(2)} ج</td>
                    <td style={{padding:'8px 10px',color:'#E2F0FB'}}>{s.buyerName||'—'}</td>
                    <td style={{padding:'8px 10px'}}><span style={{padding:'2px 7px',borderRadius:20,fontSize:11,background:'rgba(0,212,255,0.08)',border:'1px solid rgba(0,212,255,0.2)',color:'#00D4FF'}}>{PMETHODS.find(p=>p.v===s.paymentMethod)?.l||s.paymentMethod}</span></td>
                    <td style={{padding:'8px 10px',color:'#354E6A',fontSize:11}}>{new Date(s.soldAt).toLocaleDateString('ar-EG',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr style={{borderTop:'2px solid #1C2A40'}}><td style={{padding:'8px 10px',color:'#E2F0FB',fontWeight:700}}>الإجمالي ({sales.length})</td><td style={{padding:'8px 10px',color:'#00E676',fontWeight:900}}>{totalRev.toFixed(2)} ج</td><td colSpan={3}/></tr></tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [admin,setAdmin]       = useState<Admin|null>(null)
  const [tab,setTab]           = useState('sessions')
  const [devices,setDevices]   = useState<Device[]>([])
  const [sessions,setSessions] = useState<Session[]>([])
  const [vouchers,setVouchers] = useState<Voucher[]>([])
  const [selectedVouchers,setSelectedVouchers] = useState<Set<string>>(new Set())
  const [msg,setMsg]           = useState('')
  const [sideOpen,setSideOpen] = useState(false)
  const [lang, setLangState]   = useState<Lang>('ar')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread]    = useState(0)
  const [showNotif, setShowNotif] = useState(false)

  // تهيئة اللغة
  useEffect(()=>{
    const l = getLang(); setLangState(l)
    document.documentElement.lang = l
    document.documentElement.dir  = l==='ar'?'rtl':'ltr'
  },[])

  const toggleLang = () => {
    const nl:Lang = lang==='ar'?'en':'ar'
    setLang(nl); setLangState(nl)
    document.documentElement.lang = nl
    document.documentElement.dir  = nl==='ar'?'rtl':'ltr'
  }

  const loadNotifications = async (adminId:string) => {
    try {
      const res = await fetch(`/api/admin/notifications?adminId=${adminId}`)
      const d = await res.json()
      setNotifications(d.notifications||[])
      setUnread(d.unreadCount||0)
    } catch {}
  }

  const markAllRead = async (adminId:string) => {
    await fetch('/api/admin/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminId,markAll:true})})
    setNotifications(n=>n.map(x=>({...x,isRead:true})))
    setUnread(0)
  }

  const timeAgo = (d:string) => {
    const mins = Math.floor((Date.now()-new Date(d).getTime())/60000)
    if(mins<1) return lang==='ar'?'الآن':'Just now'
    if(mins<60) return mins+(lang==='ar'?'د':' m')
    return Math.floor(mins/60)+(lang==='ar'?'س':' h')
  }

  const [gen,setGen]=useState({count:10,packageType:'BOTH',dataLimitMB:1024,timeLimitMin:60,speedLimitMbps:'',deviceId:'',maxUsageCount:1,codeType:'mix',voucherType:'STANDARD',codeLength:16,isUnlimited:false})
  const [devForm,setDevForm]=useState({name:'',location:'',routerIp:'192.168.1.1',sshPassword:'',wifiSSID:''})
  const [showAddDev,setShowAddDev]=useState(false)

  const loadAll=useCallback(async(a:Admin)=>{
    const [devRes,sessRes]=await Promise.all([fetch(`/api/admin/devices?adminId=${a.id}`),fetch(`/api/admin/sessions?adminId=${a.id}`)])
    const devData=await devRes.json(); const sessData=await sessRes.json()
    if(Array.isArray(devData)) setDevices(devData)
    if(Array.isArray(sessData)) setSessions(sessData)
  },[])

  const loadVouchers=async(adminId:string)=>{const res=await fetch(`/api/admin/vouchers?adminId=${adminId}`);const data=await res.json();if(Array.isArray(data)) setVouchers(data)}
  const onLogin=(a:Admin)=>{
    setAdmin(a)
    loadAll(a)
    loadNotifications(a.id)
    localStorage.setItem('adminId',a.id)
    // تحديث إشعارات كل دقيقتين
    const interval = setInterval(()=>loadNotifications(a.id), 2*60*1000)
    return () => clearInterval(interval)
  }

  const kickSession=async(id:string)=>{
    await fetch('/api/admin/sessions',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:id})})
    setSessions(s=>s.filter(x=>x.id!==id)); setMsg('✅ تم قطع الجلسة')
  }

  const generateVouchers=async()=>{
    if(!admin) return
    const finalPkg = gen.isUnlimited ? 'UNLIMITED' : gen.packageType
    const body:any={hotspotAdminId:admin.id,count:gen.count,packageType:finalPkg,deviceId:gen.deviceId||null,maxUsageCount:gen.maxUsageCount,codeType:gen.codeType,voucherType:gen.voucherType||'STANDARD',codeLength:gen.codeLength}
    if(!gen.isUnlimited&&gen.packageType!=='TIME_ONLY'&&gen.dataLimitMB) body.dataLimitMB=+gen.dataLimitMB
    if(!gen.isUnlimited&&gen.packageType!=='DATA_ONLY'&&gen.timeLimitMin) body.timeLimitMin=+gen.timeLimitMin
    if(gen.speedLimitMbps) body.speedLimitMbps=+gen.speedLimitMbps
    const res=await fetch('/api/vouchers/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    const data=await res.json()
    if(data.success){setMsg(`✅ تم توليد ${data.count} كارت`);window.open(`${data.isQR?'/print-qr':'/print'}?batch=${data.printBatch}`,'_blank');setAdmin(a=>a?{...a,totalVouchersGenerated:a.totalVouchersGenerated+data.count}:a)}
    else setMsg('❌ '+(data.error||'خطأ'))
  }

  const addDevice=async()=>{
    if(!admin) return
    const res=await fetch('/api/admin/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...devForm,hotspotAdminId:admin.id})})
    const data=await res.json()
    if(data.success){setMsg('✅ تم إضافة الجهاز');setShowAddDev(false);loadAll(admin);setDevForm({name:'',location:'',routerIp:'192.168.1.1',sshPassword:'',wifiSSID:''})}
    else setMsg('❌ '+(data.error||'خطأ'))
  }

  if(!admin) return <LoginScreen onLogin={onLogin}/>

  const NAV=[
    {key:'sessions', icon:'📡', label:t(lang,'sessions')},
    {key:'stats',    icon:'📊', label:t(lang,'stats')},
    {key:'devices',  icon:'🖥️', label:t(lang,'devices')},
    {key:'generate', icon:'🎫', label:t(lang,'generate')},
    {key:'vouchers', icon:'📋', label:t(lang,'vouchers')},
    {key:'portal',   icon:'🌐', label:t(lang,'portal')},
    {key:'plan',     icon:'💎', label:'طلب الباقة'},
    {key:'config',   icon:'⚙️', label:t(lang,'config')},
    {key:'upgrade',  icon:'🎯', label:'ترقية الباقة'},
  ]
  const remaining=admin.maxVouchersTotal-admin.totalVouchersGenerated
  const navClick=(key:string)=>{setTab(key);setMsg('');setSideOpen(false);if(key==='vouchers'&&admin) loadVouchers(admin.id)}

  return (
    <div style={{minHeight:'100vh',background:'#070B12',direction:'rtl',fontFamily:'Cairo,sans-serif'}}>
      <div className={`sidebar-overlay${sideOpen?' open':''}`} onClick={()=>setSideOpen(false)}/>

      <div style={{background:'#0C1420',borderBottom:'1px solid #1C2A40',padding:'0 14px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="menu-toggle" onClick={()=>setSideOpen(o=>!o)}>☰</button>
          <span style={{fontSize:18}}>🖥️</span>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:'#00D4FF'}}>{admin.name}</div>
            <div style={{fontSize:10,color:'#6B8CAE',lineHeight:1}}>Admin Dashboard</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{fontSize:11,color:'#6B8CAE',textAlign:'center',lineHeight:1.3}}>
            <div>كروت</div>
            <div style={{color:'#00D4FF',fontWeight:900,fontSize:14}}>{remaining}/{admin.maxVouchersTotal}</div>
          </div>
          <div style={{width:1,height:24,background:'#1C2A40'}}/>
          <button style={{...S.btn('#1C2A40','#6B8CAE'),border:'1px solid #1C2A40',fontSize:12,padding:'7px 10px'}} onClick={()=>loadAll(admin)}>🔄</button>
          <button style={{...S.btn('#FF4444','#fff'),fontSize:12,padding:'7px 12px'}} onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});setAdmin(null)}}>خروج</button>
        </div>
      </div>

      <div className="layout-shell">
        <div className={`app-sidebar${sideOpen?' open':''}`}>
          <div style={{marginBottom:16,paddingBottom:12,borderBottom:'1px solid #1C2A40',display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:22}}>🖥️</span>
            <div><div style={{fontSize:13,fontWeight:700,color:'#00D4FF'}}>{admin.name}</div><div style={{fontSize:10,color:'#354E6A'}}>{remaining} كارت متبقية</div></div>
          </div>
          {NAV.map(n=>(
            <button key={n.key} onClick={()=>navClick(n.key)} style={{width:'100%',padding:'11px 14px',background:tab===n.key?'#111B2D':'transparent',border:tab===n.key?'1px solid #1C2A40':'1px solid transparent',borderRadius:10,color:tab===n.key?'#00D4FF':'#6B8CAE',fontFamily:'Cairo,sans-serif',fontSize:13,fontWeight:600,cursor:'pointer',textAlign:'right',display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              {n.icon} {n.label}
              {n.key==='sessions'&&sessions.length>0&&(<span style={{marginRight:'auto',background:'#0088CC',color:'#000',borderRadius:10,padding:'1px 7px',fontSize:11,fontWeight:900}}>{sessions.length}</span>)}
            </button>
          ))}
        </div>

        <div className="app-content">
          {msg&&<div style={{padding:'11px 14px',borderRadius:10,marginBottom:16,background:msg.startsWith('✅')?'rgba(0,230,118,0.1)':'rgba(255,68,68,0.1)',border:`1px solid ${msg.startsWith('✅')?'rgba(0,230,118,0.3)':'rgba(255,68,68,0.3)'}`,color:msg.startsWith('✅')?'#00E676':'#FF4444',fontSize:13,display:'flex',justifyContent:'space-between',alignItems:'center'}}>{msg}<span style={{cursor:'pointer',opacity:0.6}} onClick={()=>setMsg('')}>✕</span></div>}

          {tab==='sessions'&&(
            <div style={S.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,gap:8,flexWrap:'wrap'}}>
                <h3 style={{fontSize:15,fontWeight:700,color:'#E2F0FB'}}>📡 الجلسات النشطة ({sessions.length})</h3>
                <button style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:12}} onClick={()=>admin&&loadAll(admin)}>🔄 تحديث</button>
              </div>
              {sessions.length===0?(<div style={{textAlign:'center',padding:40,color:'#6B8CAE'}}><div style={{fontSize:48,marginBottom:12}}>📡</div><p>لا يوجد جلسات نشطة</p></div>):sessions.map(s=>{
                const dataPct=fmt.pct(s.voucher?.dataUsedMB,s.voucher?.dataLimitMB); const timePct=fmt.pct(s.voucher?.timeUsedMin,s.voucher?.timeLimitMin)
                return(
                  <div key={s.id} style={{background:'#070B12',border:'1px solid #1C2A40',borderRadius:12,padding:14,marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10,gap:8}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                          <div style={{fontFamily:'monospace',fontSize:12,color:'#E2F0FB',wordBreak:'break-all'}}>{s.macAddress}</div>
                          {(s.entryMethod==='QR'||s.voucher?.voucherType==='QR')&&<span style={{padding:'1px 6px',borderRadius:8,fontSize:10,background:'rgba(0,212,255,0.1)',border:'1px solid rgba(0,212,255,0.25)',color:'#00D4FF',whiteSpace:'nowrap'}}>📷 QR</span>}
                          {(s.entryMethod==='VOUCHER'||(!s.entryMethod&&s.voucher?.voucherType!=='QR'))&&<span style={{padding:'1px 6px',borderRadius:8,fontSize:10,background:'rgba(0,230,118,0.1)',border:'1px solid rgba(0,230,118,0.25)',color:'#00E676',whiteSpace:'nowrap'}}>🎫 كارت</span>}
                        </div>
                        <div style={{fontSize:11,color:'#354E6A'}}>{s.ipAddress}</div>
                        <div style={{fontFamily:'monospace',fontSize:12,color:'#00D4FF',marginTop:4}}>{s.voucher?.code}</div>
                        <div style={{fontSize:11,color:'#6B8CAE',marginTop:2}}>↓{fmt.data(s.dataInMB)} ↑{fmt.data(s.dataOutMB)} · ⏱{fmt.time(s.timeUsedMin)}</div>
                      </div>
                      <button style={{...S.btn('#FF4444','#fff'),fontSize:11,padding:'7px 12px',flexShrink:0}} onClick={()=>kickSession(s.id)}>🚫 قطع</button>
                    </div>
                    {s.voucher?.dataLimitMB&&(<div style={{marginBottom:5}}><div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#6B8CAE',marginBottom:3}}><span>📊 داتا</span><span>{fmt.data(s.voucher.dataUsedMB)}/{fmt.data(s.voucher.dataLimitMB)} ({dataPct}%)</span></div><div style={{height:4,background:'#1C2A40',borderRadius:3,overflow:'hidden'}}><div style={{width:`${dataPct}%`,height:'100%',background:dataPct>80?'#FF4444':dataPct>50?'#FF9800':'#00D4FF',borderRadius:3}}/></div></div>)}
                    {s.voucher?.timeLimitMin&&(<div><div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#6B8CAE',marginBottom:3}}><span>⏱ وقت</span><span>{fmt.time(s.voucher.timeUsedMin)}/{fmt.time(s.voucher.timeLimitMin)} ({timePct}%)</span></div><div style={{height:4,background:'#1C2A40',borderRadius:3,overflow:'hidden'}}><div style={{width:`${timePct}%`,height:'100%',background:timePct>80?'#FF4444':timePct>50?'#FF9800':'#00E676',borderRadius:3}}/></div></div>)}
                  </div>
                )
              })}
            </div>
          )}

          {tab==='devices'&&(
            <div>
              <div style={{...S.card,marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
                  <h3 style={{fontSize:15,fontWeight:700,color:'#E2F0FB'}}>🖥️ الأجهزة ({devices.length}/{admin.maxDevices})</h3>
                  <button style={S.btn()} onClick={()=>setShowAddDev(!showAddDev)}>+ إضافة جهاز</button>
                </div>
                {showAddDev&&(
                  <div style={{marginTop:18,paddingTop:18,borderTop:'1px solid #1C2A40'}}>
                    <div style={{padding:'10px 14px',background:'rgba(0,212,255,0.06)',border:'1px solid rgba(0,212,255,0.2)',borderRadius:10,marginBottom:12}}><div style={{fontSize:12,color:'#00D4FF',fontWeight:700}}>✅ GatewayID + TunnelPort بيتولدوا تلقائياً</div></div>
                    <div className="form-grid-2" style={{marginBottom:14}}>
                      {[{k:'name',l:'اسم المكان',p:'كافيه النيل'},{k:'location',l:'الموقع',p:'شارع التحرير'},{k:'routerIp',l:'IP الراوتر',p:'192.168.1.1'},{k:'sshPassword',l:'SSH Password',p:'اختياري',t:'password'},{k:'wifiSSID',l:'اسم الـ WiFi',p:'Cafe_WiFi'}].map(f=>(<div key={f.k}><label style={S.label}>{f.l}</label><input style={S.input} type={(f as any).t||'text'} placeholder={f.p} value={(devForm as any)[f.k]} onChange={e=>setDevForm({...devForm,[f.k]:e.target.value})}/></div>))}
                    </div>
                    <div style={{display:'flex',gap:10}}><button style={S.btn()} onClick={addDevice}>💾 حفظ</button><button style={{...S.btn('#1C2A40','#6B8CAE')}} onClick={()=>setShowAddDev(false)}>إلغاء</button></div>
                  </div>
                )}
              </div>
              {devices.length===0?(<div style={{...S.card,textAlign:'center',padding:40,color:'#6B8CAE'}}><div style={{fontSize:48,marginBottom:12}}>🖥️</div><p>أضف جهازك الأول!</p></div>):devices.map(d=>(
                <div key={d.id} style={{...S.card,marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:15,fontWeight:700,color:'#E2F0FB',marginBottom:4}}>{d.name}</div>
                      <div style={{fontSize:11,color:'#6B8CAE',wordBreak:'break-all'}}>GatewayID: <span style={{fontFamily:'monospace',color:'#00D4FF'}}>{d.gatewayId}</span></div>
                      {d.tunnelPort&&<div style={{fontSize:11,color:'#6B8CAE',marginTop:2}}>🔑 Tunnel Port: <span style={{fontFamily:'monospace',color:'#818cf8'}}>{d.tunnelPort}</span></div>}
                      {d.location&&<div style={{fontSize:11,color:'#354E6A',marginTop:2}}>📍 {d.location}</div>}
                      {d.routerIp&&<div style={{fontSize:11,color:'#354E6A'}}>🌐 {d.routerIp}</div>}
                      {d.wifiSSID&&<div style={{fontSize:11,color:'#6B8CAE',marginTop:2}}>📶 {d.wifiSSID}</div>}
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:7,flexShrink:0}}>
                      <span style={{padding:'3px 9px',borderRadius:20,fontSize:11,background:d.isActive?'rgba(0,230,118,0.12)':'rgba(255,68,68,0.12)',color:d.isActive?'#00E676':'#FF4444',border:`1px solid ${d.isActive?'rgba(0,230,118,0.25)':'rgba(255,68,68,0.25)'}`}}>{d.isActive?'● نشط':'● متوقف'}</span>
                      <button onClick={()=>setTab('config')} style={{padding:'5px 10px',background:'#111B2D',border:'1px solid #1C2A40',borderRadius:8,color:'#6B8CAE',fontFamily:'Cairo,sans-serif',fontSize:11,cursor:'pointer'}}>⚙️ سكريبت</button>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:16,marginTop:10,paddingTop:10,borderTop:'1px solid #1C2A40'}}>
                    <span style={{fontSize:12,color:'#6B8CAE'}}>جلسات: <span style={{color:'#00D4FF',fontWeight:700}}>{d._count.sessions}</span></span>
                    <span style={{fontSize:12,color:'#6B8CAE'}}>كروت: <span style={{color:'#00D4FF',fontWeight:700}}>{d._count.vouchers}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab==='generate'&&(
            <div style={S.card}>
              <h3 style={{fontSize:15,fontWeight:700,marginBottom:18,color:'#E2F0FB'}}>🎫 توليد كروت جديدة</h3>

              {/* نوع الكارت — STANDARD أو QR */}
              <div style={{marginBottom:18}}>
                <label style={S.label}>🎴 نوع الكارت</label>
                <div style={{display:'flex',gap:8}}>
                  {[{v:'STANDARD',i:'🎫',l:'عادي (كود يدوي)'},{v:'QR',i:'📷',l:'QR Code (مسح بالكاميرا)'}].map(t=>(
                    <button key={t.v} onClick={()=>setGen({...gen,voucherType:t.v})} style={{flex:1,padding:'12px 8px',background:gen.voucherType===t.v?'linear-gradient(135deg,#0088CC,#00D4FF)':'#070B12',border:`2px solid ${gen.voucherType===t.v?'#00D4FF':'#1C2A40'}`,borderRadius:12,color:gen.voucherType===t.v?'#000':'#6B8CAE',fontFamily:'Cairo,sans-serif',fontSize:13,fontWeight:700,cursor:'pointer',transition:'all 0.2s',display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                      <span style={{fontSize:24}}>{t.i}</span><span>{t.l}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* unlimited toggle */}
              <div style={{marginBottom:18,padding:'12px 16px',background:gen.isUnlimited?'rgba(0,230,118,0.08)':'#070B12',border:`1px solid ${gen.isUnlimited?'rgba(0,230,118,0.3)':'#1C2A40'}`,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setGen(g=>({...g,isUnlimited:!g.isUnlimited}))}>
                <div><div style={{fontSize:14,fontWeight:700,color:gen.isUnlimited?'#00E676':'#E2F0FB'}}>♾️ باقة غير محدودة (Unlimited)</div><div style={{fontSize:11,color:'#6B8CAE',marginTop:2}}>بلا حد للداتا أو الوقت</div></div>
                <div style={{width:44,height:24,borderRadius:12,background:gen.isUnlimited?'#00E676':'#1C2A40',position:'relative',transition:'background 0.2s',flexShrink:0}}><div style={{position:'absolute',top:2,left:gen.isUnlimited?22:2,width:20,height:20,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}/></div>
              </div>

              <div className="form-grid-2" style={{marginBottom:18}}>
                <div><label style={S.label}>عدد الكروت (لحد 100,000 في المرة — السعة الكلية مليون)</label><input style={S.input} type="number" min={1} max={100000} value={gen.count} onChange={e=>setGen({...gen,count:+e.target.value})}/></div>
                {!gen.isUnlimited&&<div><label style={S.label}>نوع الباقة</label><select style={{...S.input}} value={gen.packageType} onChange={e=>setGen({...gen,packageType:e.target.value})}><option value="BOTH">داتا + وقت</option><option value="DATA_ONLY">داتا فقط</option><option value="TIME_ONLY">وقت فقط</option></select></div>}
                {!gen.isUnlimited&&gen.packageType!=='TIME_ONLY'&&(<div><label style={S.label}>الداتا (MB)</label><input style={S.input} type="number" min={1} value={gen.dataLimitMB} onChange={e=>setGen({...gen,dataLimitMB:+e.target.value})}/></div>)}
                {!gen.isUnlimited&&gen.packageType!=='DATA_ONLY'&&(<div><label style={S.label}>الوقت (دقيقة)</label><input style={S.input} type="number" min={1} value={gen.timeLimitMin} onChange={e=>setGen({...gen,timeLimitMin:+e.target.value})}/></div>)}
                <div><label style={S.label}>السرعة (Mbps) — فارغ = بلا حد</label><input style={S.input} type="number" min={0} value={gen.speedLimitMbps} placeholder="مثال: 5" onChange={e=>setGen({...gen,speedLimitMbps:e.target.value})}/></div>
                <div>
                  <label style={S.label}>{gen.voucherType==='QR'?'📷 عدد المستخدمين (0 = غير محدود)':'أجهزة في نفس الوقت'}</label>
                  {gen.voucherType==='QR'?(
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <div style={{display:'flex',gap:6}}>
                        {[{v:0,l:'♾️ غير محدود'},{v:1,l:'1'},{v:5,l:'5'},{v:10,l:'10'},{v:50,l:'50'}].map(o=>(
                          <button key={o.v} onClick={()=>setGen({...gen,maxUsageCount:o.v})} style={{flex:1,padding:'8px 4px',background:gen.maxUsageCount===o.v?'linear-gradient(135deg,#0088CC,#00D4FF)':'#070B12',border:`1px solid ${gen.maxUsageCount===o.v?'#00D4FF':'#1C2A40'}`,borderRadius:8,color:gen.maxUsageCount===o.v?'#000':'#6B8CAE',fontFamily:'Cairo,sans-serif',fontSize:11,fontWeight:700,cursor:'pointer'}}>{o.l}</button>
                        ))}
                      </div>
                      <input style={S.input} type="number" min={0} value={gen.maxUsageCount} onChange={e=>setGen({...gen,maxUsageCount:+e.target.value})} placeholder="0 = غير محدود"/>
                      {gen.maxUsageCount===0&&<div style={{fontSize:11,color:'#00E676',padding:'6px 10px',background:'rgba(0,230,118,0.08)',borderRadius:8,border:'1px solid rgba(0,230,118,0.2)'}}>✓ أي حد يمسح الكود يدخل — زي QR بتاع المطعم</div>}
                      {gen.maxUsageCount>0&&<div style={{fontSize:11,color:'#6B8CAE'}}>⚠️ بيستخدمه {gen.maxUsageCount} مستخدم بس</div>}
                    </div>
                  ):(
                    <input style={S.input} type="number" min={1} max={10} value={gen.maxUsageCount} onChange={e=>setGen({...gen,maxUsageCount:+e.target.value})}/>
                  )}
                </div>
                <div>
                  <label style={S.label}>عدد حروف الكود: {gen.codeLength}</label>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <button onClick={()=>setGen(g=>({...g,codeLength:Math.max(4,g.codeLength-4)}))} style={{width:36,height:36,background:'#1C2A40',border:'none',borderRadius:8,color:'#E2F0FB',fontSize:18,cursor:'pointer',flexShrink:0}}>−</button>
                    <input type="range" min={4} max={32} step={4} value={gen.codeLength} onChange={e=>setGen({...gen,codeLength:+e.target.value})} style={{flex:1,accentColor:'#0088CC'}}/>
                    <button onClick={()=>setGen(g=>({...g,codeLength:Math.min(32,g.codeLength+4)}))} style={{width:36,height:36,background:'#1C2A40',border:'none',borderRadius:8,color:'#E2F0FB',fontSize:18,cursor:'pointer',flexShrink:0}}>+</button>
                  </div>
                  <div style={{fontSize:11,color:'#354E6A',marginTop:4,fontFamily:'monospace',textAlign:'center'}}>مثال: {Array(Math.ceil(gen.codeLength/4)).fill('XXXX').join('-').slice(0,gen.codeLength+Math.ceil(gen.codeLength/4)-1)}</div>
                </div>
                <div><label style={S.label}>نوع الكود</label><select style={{...S.input}} value={gen.codeType} onChange={e=>setGen({...gen,codeType:e.target.value})}><option value="mix">حروف + أرقام</option><option value="letters">حروف فقط</option><option value="numbers">أرقام فقط</option></select></div>
                <div><label style={S.label}>ربط بجهاز</label><select style={{...S.input}} value={gen.deviceId} onChange={e=>setGen({...gen,deviceId:e.target.value})}><option value="">كل الأجهزة</option>{devices.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              </div>

              {/* ملخص */}
              <div style={{padding:'14px 16px',background:'#070B12',borderRadius:10,border:'1px solid #1C2A40',marginBottom:18}}>
                <div style={{fontSize:12,color:'#6B8CAE',marginBottom:6}}>ملخص الباقة:</div>
                <div style={{fontSize:14,color:'#E2F0FB',fontWeight:700,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <span>{gen.voucherType==='QR'?'📷':'🎫'} {gen.count} كارت {gen.voucherType==='QR'?'QR':''}</span>
                  {gen.isUnlimited
                    ?<span style={{color:'#00E676'}}>♾️ غير محدود</span>
                    :<><span>{gen.packageType!=='TIME_ONLY'&&gen.dataLimitMB?`📊 ${gen.dataLimitMB>=1024?(gen.dataLimitMB/1024).toFixed(1)+'GB':gen.dataLimitMB+'MB'}`:''}</span><span>{gen.packageType!=='DATA_ONLY'&&gen.timeLimitMin?`⏱ ${gen.timeLimitMin>=60?Math.floor(gen.timeLimitMin/60)+'س':gen.timeLimitMin+'د'}`:''}</span></>
                  }
                </div>
                <div style={{fontSize:11,color:remaining<gen.count?'#FF4444':'#354E6A',marginTop:4}}>الكروت المتبقية: {remaining}{remaining<gen.count?' ⚠️ غير كافية':''}</div>
              </div>

              <button style={{...S.btn(),padding:'13px 28px',fontSize:15,opacity:remaining<gen.count?0.5:1}} onClick={generateVouchers} disabled={remaining<gen.count}>
                {gen.voucherType==='QR'?'📷':'🎫'} توليد {gen.voucherType==='QR'?'QR Cards':'وطباعة'}
              </button>
            </div>
          )}

          {tab==='vouchers'&&(
            <div style={S.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:10,flexWrap:'wrap'}}>
                <h3 style={{fontSize:15,fontWeight:700,color:'#E2F0FB',margin:0}}>📋 الكروت ({vouchers.length})</h3>
                <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                  <input placeholder="🔍 ابحث..." style={{...S.input,width:140,padding:'7px 10px',fontSize:12}} onChange={e=>{const q=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');if(!q){loadVouchers(admin.id);return};setVouchers(v=>v.filter(x=>x.code.replace(/-/g,'').includes(q)))}}/>
                  {selectedVouchers.size>0&&(
                    <button onClick={()=>window.open(`/print?ids=${Array.from(selectedVouchers).join(',')}`,'_blank')}
                      style={{...S.btn('linear-gradient(135deg,#f59e0b,#f97316)'),padding:'8px 12px',fontSize:12}}>
                      🖨️ طباعة المختارة ({selectedVouchers.size})
                    </button>
                  )}
                  <button onClick={()=>window.open(`/print?adminId=${admin.id}`,'_blank')}
                    style={{...S.btn('linear-gradient(135deg,#0088CC,#00D4FF)'),padding:'8px 12px',fontSize:12}}>
                    🖨️ طباعة الكل
                  </button>
                  <a href={`/api/admin/vouchers/csv?adminId=${admin.id}&status=UNUSED`} style={{...S.btn('#111B2D','#6B8CAE'),textDecoration:'none',display:'inline-flex',alignItems:'center',padding:'8px 10px',fontSize:12,border:'1px solid #1C2A40'}}>📊 CSV</a>
                </div>
              </div>
              {vouchers.length===0?(<div style={{textAlign:'center',padding:40,color:'#6B8CAE'}}><div style={{fontSize:48,marginBottom:12}}>📋</div><p>لا يوجد كروت بعد</p></div>):(
                <>
                {/* فلتر QR */}
                <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
                  {[{v:'all',l:'الكل'},{v:'QR',l:'📷 QR فقط'},{v:'STANDARD',l:'🎫 عادي فقط'}].map(f=>(
                    <button key={f.v} onClick={()=>{}} data-filter={f.v}
                      style={{padding:'5px 12px',borderRadius:20,fontSize:12,cursor:'pointer',fontFamily:'Cairo,sans-serif',background:'#070B12',border:'1px solid #1C2A40',color:'#6B8CAE'}}
                    >{f.l}</button>
                  ))}
                  <span style={{fontSize:11,color:'#354E6A',alignSelf:'center',marginRight:'auto'}}>
                    {vouchers.filter(v=>v.voucherType==='QR').length} QR · {vouchers.filter(v=>v.voucherType!=='QR').length} عادي
                  </span>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:580}}>
                    <thead><tr style={{borderBottom:'1px solid #1C2A40'}}>
                      <th style={{padding:'9px 8px',width:32}}>
                        <input type="checkbox"
                          checked={vouchers.length>0&&selectedVouchers.size===vouchers.length}
                          onChange={e=>setSelectedVouchers(e.target.checked?new Set(vouchers.map(v=>v.id)):new Set())}
                          style={{cursor:'pointer',accentColor:'#0088CC',width:14,height:14}}/>
                      </th>
                      {['الكود','النوع','الداتا','الوقت','الاستخدامات','الحالة'].map(h=>(<th key={h} style={{padding:'9px 10px',color:'#6B8CAE',fontWeight:600,textAlign:'right',whiteSpace:'nowrap'}}>{h}</th>))}
                    </tr></thead>
                    <tbody>
                      {vouchers.map(v=>(
                        <tr key={v.id} onClick={()=>setSelectedVouchers(prev=>{const n=new Set(prev);n.has(v.id)?n.delete(v.id):n.add(v.id);return n})}
                          style={{borderBottom:'1px solid #0C1420',background:selectedVouchers.has(v.id)?'rgba(0,136,204,0.08)':'transparent',cursor:'pointer'}}>
                          <td style={{padding:'9px 8px'}} onClick={e=>e.stopPropagation()}>
                            <input type="checkbox" checked={selectedVouchers.has(v.id)}
                              onChange={e=>{setSelectedVouchers(prev=>{const n=new Set(prev);e.target.checked?n.add(v.id):n.delete(v.id);return n})}}
                              style={{cursor:'pointer',accentColor:'#0088CC',width:14,height:14}}/>
                          </td>
                          <td style={{padding:'9px 10px',fontFamily:'monospace',color: v.voucherType==='QR'?'#818cf8':'#00D4FF',fontSize:11,letterSpacing:1}}>
                            {v.voucherType==='QR'&&<span style={{fontSize:9,background:'rgba(129,140,248,0.15)',border:'1px solid rgba(129,140,248,0.3)',color:'#818cf8',borderRadius:4,padding:'1px 4px',marginLeft:4}}>QR</span>}
                            {v.code}
                          </td>
                          <td style={{padding:'9px 10px',color:'#6B8CAE',fontSize:11}}>{v.packageType==='BOTH'?'داتا+وقت':v.packageType==='DATA_ONLY'?'داتا':'وقت'}</td>
                          <td style={{padding:'9px 10px',fontSize:12}}>{v.dataLimitMB?fmt.data(v.dataLimitMB):'∞'}</td>
                          <td style={{padding:'9px 10px',fontSize:12}}>{v.timeLimitMin?fmt.time(v.timeLimitMin):'∞'}</td>
                          <td style={{padding:'9px 10px'}}>
                            {v.voucherType==='QR'?(
                              <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <span style={{fontWeight:700,color: v.usageCount>0?'#f59e0b':'#354E6A',fontSize:13}}>{v.usageCount||0}</span>
                                <span style={{fontSize:10,color:'#354E6A'}}>/ {v.maxUsageCount===0?'∞':v.maxUsageCount}</span>
                                {v.usageCount>0&&v.maxUsageCount>0&&(
                                  <div style={{width:32,height:4,background:'#1C2A40',borderRadius:2,overflow:'hidden'}}>
                                    <div style={{width:`${Math.min(100,(v.usageCount/v.maxUsageCount)*100)}%`,height:'100%',background:'#f59e0b',borderRadius:2}}/>
                                  </div>
                                )}
                              </div>
                            ):(
                              <span style={{fontSize:11,color:'#354E6A'}}>—</span>
                            )}
                          </td>
                          <td style={{padding:'9px 10px'}}><span style={{padding:'2px 7px',borderRadius:20,fontSize:11,fontWeight:600,background:v.status==='UNUSED'?'rgba(107,140,174,0.12)':v.status==='ACTIVE'?'rgba(0,230,118,0.12)':'rgba(255,68,68,0.12)',color:v.status==='UNUSED'?'#6B8CAE':v.status==='ACTIVE'?'#00E676':'#FF4444',border:`1px solid ${v.status==='UNUSED'?'rgba(107,140,174,0.25)':v.status==='ACTIVE'?'rgba(0,230,118,0.25)':'rgba(255,68,68,0.25)'}`}}>{v.status==='UNUSED'?'غير مستخدم':v.status==='ACTIVE'?'نشط':v.status==='DEPLETED'?'نفدت الداتا':'انتهى الوقت'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          )}

          {tab==='portal'&&<PortalSettingsTab devices={devices} adminId={admin.id}/>}

          {tab==='stats'&&(
            <div>
              <div className="stats-grid-4" style={{marginBottom:14}}>
                {[
                  {icon:'📡',label:'جلسات نشطة',val:sessions.length,color:'#00E676'},
                  {icon:'🎫',label:'كروت اتضربت',val:admin.totalVouchersGenerated,color:'#00D4FF'},
                  {icon:'🖥️',label:'أجهزة نشطة',val:devices.filter(d=>d.isActive).length,color:'#818cf8'},
                  {icon:'📊',label:'كروت متبقية',val:remaining,color:'#fb923c'}
                ].map((s,i)=>(
                  <div key={i} style={{...S.card,textAlign:'center',padding:14}}><div style={{fontSize:22,marginBottom:5}}>{s.icon}</div><div style={{fontSize:20,fontWeight:900,color:s.color}}>{s.val}</div><div style={{fontSize:10,color:'#354E6A',marginTop:2}}>{s.label}</div></div>
                ))}
              </div>
              <div style={{...S.card,marginBottom:14}}>
                <h3 style={{fontSize:13,fontWeight:700,color:'#E2F0FB',marginBottom:14}}>📡 استهلاك الجلسات</h3>
                {sessions.length===0?(<div style={{textAlign:'center',padding:20,color:'#6B8CAE',fontSize:13}}>لا يوجد جلسات نشطة</div>):(
                  <div className="stats-grid-3">
                    {[{l:'إجمالي تنزيل',v:(sessions.reduce((s,x)=>s+x.dataInMB,0)/1024).toFixed(2)+' GB',c:'#22d3ee'},{l:'إجمالي رفع',v:(sessions.reduce((s,x)=>s+x.dataOutMB,0)/1024).toFixed(2)+' GB',c:'#4ade80'},{l:'متوسط الوقت',v:sessions.length?Math.round(sessions.reduce((s,x)=>s+x.timeUsedMin,0)/sessions.length)+' د':'0 د',c:'#fb923c'}].map((s,i)=>(
                      <div key={i} style={{background:'#070B12',border:'1px solid #1C2A40',borderRadius:10,padding:12,textAlign:'center'}}><div style={{fontSize:10,color:'#6B8CAE',marginBottom:4}}>{s.l}</div><div style={{fontSize:15,fontWeight:700,color:s.c}}>{s.v}</div></div>
                    ))}
                  </div>
                )}
              </div>
              <div style={S.card}>
                <h3 style={{fontSize:13,fontWeight:700,color:'#E2F0FB',marginBottom:14}}>🎫 حالة الكروت</h3>
                {vouchers.length===0?(<div style={{textAlign:'center',padding:20,color:'#6B8CAE',fontSize:12}}>اضغط تاب الكروت أولاً</div>):(
                  <div className="stats-grid-4">
                    {[{label:'غير مستخدمة',status:'UNUSED',color:'#6B8CAE'},{label:'نشطة',status:'ACTIVE',color:'#00E676'},{label:'نفدت الداتا',status:'DEPLETED',color:'#FF4444'},{label:'انتهى الوقت',status:'EXPIRED',color:'#fb923c'}].map(s=>{
                      const cnt=vouchers.filter(v=>v.status===s.status).length; const pct=vouchers.length?Math.round(cnt/vouchers.length*100):0
                      return(<div key={s.status} style={{background:'#070B12',border:'1px solid #1C2A40',borderRadius:10,padding:12,textAlign:'center'}}><div style={{fontSize:18,fontWeight:900,color:s.color}}>{cnt}</div><div style={{fontSize:10,color:'#6B8CAE',marginTop:2}}>{s.label}</div><div style={{marginTop:6,height:3,background:'#1C2A40',borderRadius:2,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',background:s.color,borderRadius:2}}/></div></div>)
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab==='plan'&&(
            <div style={{textAlign:'center',padding:'20px 0'}}>
              <div style={{fontSize:40,marginBottom:12}}>💎</div>
              <div style={{fontSize:14,fontWeight:700,color:'#E2F0FB',marginBottom:8}}>طلب الباقة</div>
              <div style={{fontSize:12,color:'#6B8CAE',marginBottom:18}}>افتح صفحة طلب الباقة</div>
              <a href={`/plan-request?adminId=${admin.id}`}
                style={{display:'inline-block',padding:'12px 28px',background:'linear-gradient(135deg,#0088CC,#00D4FF)',borderRadius:10,color:'#000',textDecoration:'none',fontSize:14,fontWeight:900,fontFamily:'Cairo,sans-serif'}}>
                📤 فتح صفحة طلب الباقة
              </a>
            </div>
          )}
          {tab==='config'&&<RouterSetupTab devices={devices}/>}
        </div>
      </div>

      <style>{`select option{background:#0C1420;color:#E2F0FB}`}</style>
    </div>
  )
}
