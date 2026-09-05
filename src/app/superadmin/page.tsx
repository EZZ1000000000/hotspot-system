'use client'
import { useState, useEffect, useCallback } from 'react'

type SA = { id: string; username: string; email: string }
type Admin = { id:string; name:string; username:string; email:string; phone?:string; maxDevices:number; maxVouchersTotal:number; totalVouchersGenerated:number; isActive:boolean; createdAt:string; canCreateUnlimited:boolean; canCreateNFC:boolean; canCreateQR:boolean; canRenewVouchers:boolean; _count?:{devices:number;vouchers:number} }
type StatsData = { summary:{totalActiveSessions:number;totalActiveDevices:number;totalDevices:number;totalDataInMB:number;totalDataOutMB:number}; activeSessions:any[]; devices:any[]; admins:any[]; consumption:{deviceId:string;deviceName:string;totalInMB:number;totalOutMB:number;totalMB:number;sessions:number;timeMin:number}[] }
type VoucherItem = { id:string; code:string; status:string; packageType:string; dataLimitMB:number|null; timeLimitMin:number|null; dataUsedMB:number; createdAt:string; hotspotAdmin?:{name:string}; device?:{name:string} }

const S = {
  card:  { background:'#0C1420', border:'1px solid #1C2A40', borderRadius:14, padding:18 } as React.CSSProperties,
  input: { width:'100%', padding:'10px 13px', background:'#070B12', border:'1px solid #1C2A40', borderRadius:9, color:'#E2F0FB', fontFamily:'Cairo,sans-serif', fontSize:13, outline:'none', boxSizing:'border-box' as const },
  label: { display:'block', fontSize:11, color:'#6B8CAE', marginBottom:5 } as React.CSSProperties,
  btn:   (bg='#0088CC', c='#000') => ({ padding:'9px 18px', background:bg, border:'none', borderRadius:9, color:c, fontFamily:'Cairo,sans-serif', fontSize:12, fontWeight:700, cursor:'pointer' } as React.CSSProperties),
  tag:   (on:boolean, color='#00D4FF') => ({ display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700, background:on?`${color}18`:'rgba(107,140,174,0.08)', border:`1px solid ${on?`${color}40`:'rgba(107,140,174,0.15)'}`, color:on?color:'#354E6A' } as React.CSSProperties),
  msg:   (ok:boolean) => ({ padding:'10px 14px', borderRadius:9, marginBottom:14, background:ok?'rgba(0,230,118,0.08)':'rgba(255,68,68,0.08)', border:`1px solid ${ok?'rgba(0,230,118,0.25)':'rgba(255,68,68,0.25)'}`, color:ok?'#00E676':'#FF4444', fontSize:12, display:'flex', justifyContent:'space-between', alignItems:'center' } as React.CSSProperties),
}

const fmtMB   = (mb:number)  => mb>=1024?(mb/1024).toFixed(2)+' GB':mb.toFixed(1)+' MB'
const fmtTime = (min:number) => min>=60?Math.floor(min/60)+'س '+(min%60?Math.round(min%60)+'د':''):Math.round(min)+'د'

const TABS = [
  { key:'allservers',  icon:'🌍', label:'كل السيرفرات' },
  { key:'admins',      icon:'👤', label:'الأدمنز' },
  { key:'cafestats',   icon:'📊', label:'إحصائيات الكافيهات' },
  { key:'monitor',     icon:'📡', label:'المراقبة' },
  { key:'vouchers',    icon:'🎫', label:'الكروت' },
  { key:'generate',    icon:'✨', label:'توليد كروت' },
  { key:'import',      icon:'📥', label:'استيراد CSV' },
  { key:'rewards',     icon:'🎁', label:'المكافآت' },
  { key:'cpa',         icon:'💸', label:'CPA Offers' },
  { key:'wifi',        icon:'📶', label:'WiFi' },
  { key:'sales',       icon:'💰', label:'المبيعات' },
  { key:'accounts',    icon:'📊', label:'الحسابات' },
  { key:'plans',       icon:'🎯', label:'الباقات والتسجيلات' },
  { key:'planreqs',    icon:'📨', label:'طلبات الباقات' },
  { key:'manageplans', icon:'⚙️', label:'إدارة الباقات' },
  { key:'devices',     icon:'🖥️', label:'إدارة الأجهزة' },
  { key:'portalpage',  icon:'🌐', label:'صفحة البورتال' },
  { key:'logs',        icon:'📋', label:'السجلات' },
]

function LoginScreen({ onLogin }:{ onLogin:(sa:SA)=>void }) {
  const [user,setUser]=useState(''); const [pass,setPass]=useState(''); const [err,setErr]=useState(''); const [loading,setLoading]=useState(false)
  const login = async () => {
    if(!user||!pass){setErr('أدخل البيانات');return}
    setLoading(true);setErr('')
    const res=await fetch('/api/superadmin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user,password:pass})})
    const d=await res.json()
    if(d.success) onLogin(d.superAdmin); else setErr(d.error||'بيانات غير صحيحة')
    setLoading(false)
  }
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'radial-gradient(ellipse at 60% 40%,#001020,#070B12)',fontFamily:'Cairo,sans-serif',direction:'rtl',padding:16}}>
      <div style={{...S.card,width:'100%',maxWidth:380,boxShadow:'0 0 80px rgba(0,136,204,0.1)'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:72,height:72,borderRadius:20,background:'linear-gradient(135deg,#0044AA,#0088CC)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,margin:'0 auto 14px',boxShadow:'0 0 40px rgba(0,136,204,0.3)'}}>👑</div>
          <h1 style={{fontSize:22,fontWeight:900,color:'#00D4FF',margin:0}}>Super Admin</h1>
          <p style={{fontSize:12,color:'#6B8CAE',marginTop:4}}>لوحة التحكم الكاملة</p>
        </div>
        <div style={{marginBottom:12}}><label style={S.label}>اسم المستخدم</label><input style={S.input} value={user} onChange={e=>setUser(e.target.value)} autoFocus placeholder="superadmin"/></div>
        <div style={{marginBottom:18}}><label style={S.label}>كلمة المرور</label><input style={S.input} type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="••••••••"/></div>
        {err&&<p style={{color:'#FF4444',fontSize:12,textAlign:'center',marginBottom:10}}>⚠️ {err}</p>}
        <button style={{...S.btn(),width:'100%',padding:'12px',opacity:loading?0.7:1}} onClick={login} disabled={loading}>{loading?'جاري الدخول...':'👑 دخول Super Admin'}</button>
      </div>
    </div>
  )
}

function AdminsTab({ sa }:{ sa:SA }) {
  const [admins,setAdmins]=useState<Admin[]>([]); const [view,setView]=useState<'list'|'create'|'edit'>('list'); const [editing,setEditing]=useState<Admin|null>(null); const [msg,setMsg]=useState('')
  const [form,setForm]=useState({name:'',username:'',email:'',phone:'',password:'',maxDevices:50,maxVouchersTotal:1000000,canCreateUnlimited:false,canCreateNFC:false,canCreateQR:false,canRenewVouchers:true})
  const [editData,setEditData]=useState({maxDevices:50,maxVouchersTotal:1000000,isActive:true,canCreateUnlimited:false,canCreateNFC:false,canCreateQR:false,canRenewVouchers:true})

  const [expandedAdmin,setExpandedAdmin]=useState<string|null>(null)
  const [adminDevices,setAdminDevices]=useState<Record<string,any[]>>({})
  const [toggling,setToggling]=useState<string|null>(null)
  const [togglingDev,setTogglingDev]=useState<string|null>(null)

  const load=useCallback(async()=>{const r=await fetch('/api/superadmin/admins');const d=await r.json();if(Array.isArray(d)) setAdmins(d)},[])
  useEffect(()=>{load()},[load])

  const loadDevices=async(adminId:string)=>{
    setExpandedAdmin(prev=>prev===adminId?null:adminId)
    if(!adminDevices[adminId]){
      const r=await fetch('/api/superadmin/admin-devices?adminId='+adminId)
      const d=await r.json()
      if(Array.isArray(d)) setAdminDevices(prev=>({...prev,[adminId]:d}))
    }
  }

  const toggleAdmin=async(a:Admin)=>{
    setToggling(a.id)
    await fetch('/api/superadmin/admins',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:a.id,isActive:!a.isActive,maxDevices:a.maxDevices,maxVouchersTotal:a.maxVouchersTotal,canCreateUnlimited:a.canCreateUnlimited,canCreateNFC:a.canCreateNFC,canCreateQR:a.canCreateQR,canRenewVouchers:a.canRenewVouchers})})
    setToggling(null)
    load()
  }

  const toggleDevice=async(adminId:string,deviceId:string,isActive:boolean)=>{
    setTogglingDev(deviceId)
    await fetch('/api/superadmin/admin-devices',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,isActive:!isActive})})
    const r=await fetch('/api/superadmin/admin-devices?adminId='+adminId)
    const d=await r.json()
    if(Array.isArray(d)) setAdminDevices(prev=>({...prev,[adminId]:d}))
    setTogglingDev(null)
  }

  const createAdmin=async()=>{
    const r=await fetch('/api/superadmin/admins',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,superAdminId:sa.id})})
    const d=await r.json()
    if(d.success){setMsg('✅ تم إنشاء الأدمن');load();setView('list')} else setMsg('❌ '+d.error)
  }
  const updateAdmin=async()=>{
    if(!editing) return
    const r=await fetch('/api/superadmin/admins',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:editing.id,...editData})})
    const d=await r.json()
    if(d.success){setMsg('✅ تم التحديث');load();setView('list')} else setMsg('❌ '+(d.error||'خطأ'))
  }

  const PERMS=[{k:'canCreateUnlimited',l:'Unlimited',i:'♾️'},{k:'canCreateNFC',l:'NFC',i:'📶'},{k:'canCreateQR',l:'QR Code',i:'📷'},{k:'canRenewVouchers',l:'تجديد',i:'🔄'}]
  const PermGrid=({data,onChange}:{data:any;onChange:(k:string,v:boolean)=>void})=>(
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
      {PERMS.map(p=>(
        <div key={p.k} onClick={()=>onChange(p.k,!data[p.k])} style={{padding:'10px 6px',borderRadius:10,cursor:'pointer',textAlign:'center',border:`2px solid ${data[p.k]?'#00D4FF':'#1C2A40'}`,background:data[p.k]?'rgba(0,212,255,0.07)':'#070B12',transition:'all 0.15s'}}>
          <div style={{fontSize:18,marginBottom:2}}>{p.i}</div>
          <div style={{fontSize:10,fontWeight:700,color:data[p.k]?'#00D4FF':'#6B8CAE'}}>{p.l}</div>
          <div style={{fontSize:9,color:data[p.k]?'#00E676':'#354E6A',marginTop:1}}>{data[p.k]?'✓ مفعّل':'○ معطّل'}</div>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <div className="stats-grid-4" style={{marginBottom:14}}>
        {[{i:'👤',l:'إجمالي',v:admins.length,c:'#818cf8'},{i:'✅',l:'نشطين',v:admins.filter(a=>a.isActive).length,c:'#00E676'},{i:'🖥️',l:'الأجهزة',v:admins.reduce((s,a)=>s+(a._count?.devices||0),0),c:'#00D4FF'},{i:'🎫',l:'الكروت',v:admins.reduce((s,a)=>s+a.totalVouchersGenerated,0),c:'#fb923c'}].map((s,i)=>(
          <div key={i} style={{...S.card,textAlign:'center',padding:12}}><div style={{fontSize:20,marginBottom:3}}>{s.i}</div><div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.v}</div><div style={{fontSize:9,color:'#354E6A',marginTop:1}}>{s.l}</div></div>
        ))}
      </div>
      {msg&&<div style={S.msg(msg.startsWith('✅'))}>{msg}<span onClick={()=>setMsg('')} style={{cursor:'pointer',opacity:0.6}}>✕</span></div>}
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        {[{k:'list',l:'📋 القائمة'},{k:'create',l:'+ إضافة أدمن'}].map(t=>(<button key={t.k} onClick={()=>setView(t.k as any)} style={{...S.btn(view===t.k?'#0088CC':'#111B2D',view===t.k?'#000':'#6B8CAE'),border:'1px solid #1C2A40'}}>{t.l}</button>))}
      </div>

      {view==='create'&&(
        <div style={S.card}>
          <h3 style={{fontSize:14,fontWeight:700,color:'#E2F0FB',marginBottom:14}}>إضافة أدمن جديد</h3>
          <div className="form-grid-2" style={{marginBottom:14}}>
            {[{k:'name',l:'الاسم',p:'أحمد محمد'},{k:'username',l:'يوزرنيم',p:'ahmed_cafe'},{k:'email',l:'إيميل',p:'a@cafe.com',t:'email'},{k:'phone',l:'موبايل',p:'010xxxxxxxx'},{k:'password',l:'كلمة المرور',p:'••••',t:'password'}].map(f=>(<div key={f.k}><label style={S.label}>{f.l}</label><input style={S.input} type={(f as any).t||'text'} placeholder={f.p} value={(form as any)[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})}/></div>))}
            <div><label style={S.label}>أقصى أجهزة</label><input style={S.input} type="number" min={1} value={form.maxDevices} onChange={e=>setForm({...form,maxDevices:+e.target.value})}/></div>
            <div><label style={S.label}>أقصى كروت</label><input style={S.input} type="number" min={1} value={form.maxVouchersTotal} onChange={e=>setForm({...form,maxVouchersTotal:+e.target.value})}/></div>
          </div>
          <div style={{marginBottom:14}}><label style={{...S.label,fontSize:12,marginBottom:10}}>🔑 الصلاحيات</label><PermGrid data={form} onChange={(k,v)=>setForm({...form,[k]:v})}/></div>
          <div style={{display:'flex',gap:8}}><button style={S.btn()} onClick={createAdmin}>💾 إنشاء</button><button style={{...S.btn('#1C2A40','#6B8CAE')}} onClick={()=>setView('list')}>إلغاء</button></div>
        </div>
      )}
      {view==='edit'&&editing&&(
        <div style={S.card}>
          <h3 style={{fontSize:14,fontWeight:700,color:'#E2F0FB',marginBottom:14}}>تعديل: {editing.name}</h3>
          <div className="form-grid-2" style={{marginBottom:14}}>
            <div><label style={S.label}>أقصى أجهزة</label><input style={S.input} type="number" min={1} value={editData.maxDevices} onChange={e=>setEditData({...editData,maxDevices:+e.target.value})}/></div>
            <div><label style={S.label}>أقصى كروت</label><input style={S.input} type="number" min={1} value={editData.maxVouchersTotal} onChange={e=>setEditData({...editData,maxVouchersTotal:+e.target.value})}/></div>
          </div>
          <div style={{marginBottom:14}}><label style={{...S.label,fontSize:12,marginBottom:10}}>🔑 الصلاحيات</label><PermGrid data={editData} onChange={(k,v)=>setEditData({...editData,[k]:v})}/></div>
          <div style={{marginBottom:14}}>
            <label style={{...S.label,marginBottom:8}}>الحالة</label>
            <div style={{display:'flex',gap:8}}>
              {[{v:true,l:'✅ نشط'},{v:false,l:'⛔ موقوف'}].map(o=>(<button key={String(o.v)} onClick={()=>setEditData({...editData,isActive:o.v})} style={{...S.btn(editData.isActive===o.v?(o.v?'#00E676':'#FF4444'):'#111B2D',editData.isActive===o.v?'#000':'#6B8CAE'),border:'1px solid #1C2A40',flex:1}}>{o.l}</button>))}
            </div>
          </div>
          <div style={{display:'flex',gap:8}}><button style={S.btn()} onClick={updateAdmin}>💾 حفظ</button><button style={{...S.btn('#1C2A40','#6B8CAE')}} onClick={()=>{setView('list');setEditing(null)}}>إلغاء</button></div>
        </div>
      )}
      {view==='list'&&admins.map(a=>{
        const pct=a.maxVouchersTotal>0?Math.round(a.totalVouchersGenerated/a.maxVouchersTotal*100):0
        const isExp=expandedAdmin===a.id
        const devs=adminDevices[a.id]||[]
        return(
          <div key={a.id} style={{...S.card,marginBottom:10,border:a.isActive?'1px solid #1C2A40':'1px solid rgba(255,68,68,0.3)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8,gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:7}}>
                  <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,background:a.isActive?'#00E676':'#FF4444',boxShadow:a.isActive?'0 0 5px rgba(0,230,118,0.5)':'none'}}/>
                  <div style={{fontSize:14,fontWeight:700,color:a.isActive?'#E2F0FB':'#6B8CAE'}}>{a.name}</div>
                </div>
                <div style={{fontSize:10,color:'#354E6A',marginTop:2}}>@{a.username} · {a.email}</div>
              </div>
              <div style={{display:'flex',gap:5,alignItems:'center',flexShrink:0}}>
                <button onClick={()=>toggleAdmin(a)} disabled={toggling===a.id}
                  style={{padding:'5px 10px',borderRadius:7,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Cairo,sans-serif',opacity:toggling===a.id?0.6:1,background:a.isActive?'rgba(255,68,68,0.12)':'rgba(0,230,118,0.12)',color:a.isActive?'#FF4444':'#00E676'}}>
                  {toggling===a.id?'⏳':a.isActive?'⛔ إيقاف':'▶️ تشغيل'}
                </button>
                <button onClick={()=>loadDevices(a.id)}
                  style={{...S.btn(isExp?'rgba(0,212,255,0.12)':'#111B2D',isExp?'#00D4FF':'#6B8CAE'),border:`1px solid ${isExp?'#00D4FF':'#1C2A40'}`,fontSize:11,padding:'5px 10px'}}>
                  🖥️ {a._count?.devices||0}
                </button>
                <button onClick={()=>{setEditing(a);setEditData({maxDevices:a.maxDevices,maxVouchersTotal:a.maxVouchersTotal,isActive:a.isActive,canCreateUnlimited:a.canCreateUnlimited,canCreateNFC:a.canCreateNFC,canCreateQR:a.canCreateQR,canRenewVouchers:a.canRenewVouchers});setView('edit')}} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'5px 10px'}}>✏️</button>
              </div>
            </div>
            <div style={{display:'flex',gap:14,marginBottom:7,fontSize:11,color:'#6B8CAE',flexWrap:'wrap'}}>
              <span>🖥️ <strong style={{color:'#00D4FF'}}>{a._count?.devices||0}/{a.maxDevices}</strong></span>
              <span>🎫 <strong style={{color:'#00D4FF'}}>{a.totalVouchersGenerated}/{a.maxVouchersTotal}</strong></span>
              {!a.isActive&&<span style={{color:'#FF4444',fontSize:10,fontWeight:700}}>⛔ موقوف</span>}
            </div>
            <div style={{height:4,background:'#070B12',borderRadius:3,overflow:'hidden',border:'1px solid #1C2A40',marginBottom:7}}>
              <div style={{width:`${pct}%`,height:'100%',background:pct>90?'#FF4444':pct>70?'#fb923c':'#0088CC',borderRadius:3}}/>
            </div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              {[{v:a.canCreateUnlimited,l:'♾️'},{v:a.canCreateNFC,l:'📡 NFC'},{v:a.canCreateQR,l:'📷 QR'},{v:a.canRenewVouchers,l:'🔄'}].map((p,i)=><span key={i} style={S.tag(p.v)}>{p.l}</span>)}
            </div>
            {isExp&&(
              <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid #1C2A40'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#00D4FF',marginBottom:7}}>🖥️ أجهزة {a.name}</div>
                {devs.length===0
                  ?<div style={{fontSize:11,color:'#354E6A'}}>لا يوجد أجهزة...</div>
                  :devs.map((dev:any)=>(
                    <div key={dev.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',marginBottom:5,borderRadius:8,background:'#070B12',border:`1px solid ${dev.isActive?'rgba(0,230,118,0.2)':'rgba(255,68,68,0.2)'}`}}>
                      <div style={{display:'flex',alignItems:'center',gap:7,flex:1,minWidth:0}}>
                        <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:dev.isActive?'#00E676':'#FF4444'}}/>
                        <div>
                          <div style={{fontSize:12,fontWeight:700,color:dev.isActive?'#E2F0FB':'#6B8CAE'}}>{dev.name}</div>
                          <div style={{fontSize:9,color:'#354E6A',fontFamily:'monospace'}}>{dev.gatewayId}{dev.wifiSSID&&<span style={{marginRight:6,color:'#6B8CAE'}}> 📡{dev.wifiSSID}</span>}{dev.tunnelPort&&<span style={{marginRight:6,color:'#00E676'}}> 🔌:{dev.tunnelPort}</span>}</div>
                        </div>
                      </div>
                      <button onClick={()=>toggleDevice(a.id,dev.id,dev.isActive)} disabled={togglingDev===dev.id}
                        style={{padding:'4px 10px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Cairo,sans-serif',flexShrink:0,opacity:togglingDev===dev.id?0.6:1,background:dev.isActive?'rgba(255,68,68,0.1)':'rgba(0,230,118,0.1)',color:dev.isActive?'#FF4444':'#00E676'}}>
                        {togglingDev===dev.id?'⏳':dev.isActive?'⛔ إيقاف':'▶️ تشغيل'}
                      </button>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Cafe Stats Tab ────────────────────────────────────────────────────────
function CafeStatsTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/superadmin/stats')
    const d = await r.json()
    if (!d.error) setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{textAlign:'center',padding:60,color:'#6B8CAE',fontSize:13}}>⏳ جاري التحميل...</div>
  if (!data)   return <div style={{textAlign:'center',padding:60,color:'#FF4444'}}>❌ خطأ</div>

  const cafes: any[] = data.cafeStats || []
  const totalActive  = data.summary?.totalActiveSessions || 0
  const totalToday   = data.todaySessions || 0
  const totalDevices = cafes.reduce((s:number,c:any)=>s+c.totalDevices,0)
  const totalUnused  = cafes.reduce((s:number,c:any)=>s+c.unusedVouchers,0)

  return (
    <div>
      {/* بطاقة الملخص العام */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10,marginBottom:16}}>
        {[
          {icon:'📡',label:'جلسات الآن',   val:totalActive,  color:'#00E676', big:true},
          {icon:'📅',label:'جلسات اليوم',  val:totalToday,   color:'#00D4FF', big:true},
          {icon:'🏪',label:'الكافيهات',    val:cafes.length, color:'#818cf8'},
          {icon:'🖥️',label:'الأجهزة',     val:totalDevices, color:'#22d3ee'},
          {icon:'🎫',label:'كروت متاحة',  val:totalUnused,  color:'#fb923c'},
        ].map((s,i)=>(
          <div key={i} style={{...S.card,textAlign:'center',padding:14,border:s.big?`1px solid ${s.color}40`:'1px solid #1C2A40'}}>
            <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
            <div style={{fontSize:s.big?28:18,fontWeight:900,color:s.color,lineHeight:1}}>{s.val}</div>
            <div style={{fontSize:10,color:'#6B8CAE',marginTop:4}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* كروت كل كافيه */}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {cafes.length===0 && <div style={{...S.card,textAlign:'center',padding:40,color:'#6B8CAE'}}>لا يوجد كافيهات</div>}
        {cafes.map((cafe:any) => {
          const isOpen = expanded === cafe.id
          const statusColor = cafe.activeSessions > 0 ? '#00E676' : '#354E6A'
          return (
            <div key={cafe.id} style={S.card}>
              {/* رأس الكارت */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}} onClick={()=>setExpanded(isOpen?null:cafe.id)}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:36,height:36,borderRadius:10,background:`${statusColor}18`,border:`1px solid ${statusColor}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>☕</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'#E2F0FB'}}>{cafe.name}</div>
                    <div style={{fontSize:10,color:'#6B8CAE'}}>@{cafe.username} · {cafe.totalDevices} جهاز</div>
                  </div>
                </div>
                <div style={{display:'flex',gap:16,alignItems:'center'}}>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:20,fontWeight:900,color:'#00E676'}}>{cafe.activeSessions}</div>
                    <div style={{fontSize:9,color:'#354E6A'}}>الآن</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:20,fontWeight:900,color:'#00D4FF'}}>{cafe.todayVouchers}</div>
                    <div style={{fontSize:9,color:'#354E6A'}}>اليوم</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:16,fontWeight:700,color:'#fb923c'}}>{cafe.unusedVouchers}</div>
                    <div style={{fontSize:9,color:'#354E6A'}}>متاح</div>
                  </div>
                  <span style={{color:'#354E6A',fontSize:14,transition:'transform 0.2s',transform:isOpen?'rotate(180deg)':'none'}}>▾</span>
                </div>
              </div>

              {/* تفاصيل الأجهزة */}
              {isOpen && (
                <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid #1C2A40'}}>
                  <div style={{fontSize:11,color:'#6B8CAE',marginBottom:8}}>الأجهزة:</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
                    {cafe.devices.map((d:any)=>(
                      <div key={d.id} style={{background:'#070B12',border:`1px solid ${d.isActive?'#1C2A40':'#0C1420'}`,borderRadius:9,padding:'10px 12px',opacity:d.isActive?1:0.5}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                          <span style={{fontSize:12,fontWeight:700,color:'#E2F0FB'}}>{d.name}</span>
                          <span style={{fontSize:10,fontWeight:900,color:d.activeSessions>0?'#00E676':'#354E6A'}}>●{d.activeSessions}</span>
                        </div>
                        {d.ssid&&<div style={{fontSize:10,color:'#6B8CAE',marginBottom:4}}>📶 {d.ssid}</div>}
                        <div style={{fontSize:10,color:'#fb923c'}}>🎫 {d.unusedVouchers} متاح</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{marginTop:10,textAlign:'left'}}>
        <button onClick={load} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11}}>🔄 تحديث</button>
      </div>
    </div>
  )
}

function MonitorTab() {
  const [stats,setStats]=useState<StatsData|null>(null); const [loading,setLoading]=useState(true); const [selAdmin,setSelAdmin]=useState('')
  const [devStatus,setDevStatus]=useState<Record<string,{online:boolean;reason:string}>>({}) ; const [statusLoading,setStatusLoading]=useState(false)
  const load=useCallback(async()=>{setLoading(true);const r=await fetch(`/api/superadmin/stats${selAdmin?`?adminId=${selAdmin}`:''}`);const d=await r.json();if(!d.error) setStats(d);setLoading(false)},[selAdmin])
  useEffect(()=>{load()},[load])

  const checkAllDevices=async()=>{
    setStatusLoading(true)
    try{
      const r=await fetch(`/api/superadmin/device-status${selAdmin?`?adminId=${selAdmin}`:''}`)
      const d=await r.json()
      if(d.devices){
        const map:Record<string,{online:boolean;reason:string}>={}
        d.devices.forEach((x:any)=>{map[x.deviceId]={online:x.online,reason:x.reason}})
        setDevStatus(map)
      }
    }catch{}
    setStatusLoading(false)
  }
  if(loading) return <div style={{textAlign:'center',padding:60,color:'#6B8CAE'}}>⏳ جاري التحميل...</div>
  if(!stats) return <div style={{textAlign:'center',padding:60,color:'#FF4444'}}>❌ خطأ في تحميل البيانات</div>
  return (
    <div>
      <div style={{...S.card,marginBottom:12,padding:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <select style={{...S.input,flex:1,minWidth:160,padding:'7px 11px',fontSize:12}} value={selAdmin} onChange={e=>setSelAdmin(e.target.value)}>
            <option value="">كل الأدمنز</option>
            {stats.admins.map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button onClick={load} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',padding:'7px 14px',fontSize:12}}>🔄</button>
          <button onClick={checkAllDevices} disabled={statusLoading} style={{...S.btn(statusLoading?'#1C2A40':'rgba(0,230,118,0.12)',statusLoading?'#6B8CAE':'#00E676'),border:'1px solid rgba(0,230,118,0.25)',padding:'7px 14px',fontSize:12,opacity:statusLoading?0.7:1}}>{statusLoading?'⏳ فحص...':'📡 فحص الاتصال'}</button>
        </div>
      </div>
      <div className="stats-grid-5" style={{marginBottom:14}}>
        {[{i:'📡',l:'جلسات نشطة',v:stats.summary.totalActiveSessions,c:'#00E676'},{i:'🖥️',l:'أجهزة نشطة',v:`${stats.summary.totalActiveDevices}/${stats.summary.totalDevices}`,c:'#00D4FF'},{i:'⬇️',l:'تنزيل',v:fmtMB(stats.summary.totalDataInMB),c:'#22d3ee'},{i:'⬆️',l:'رفع',v:fmtMB(stats.summary.totalDataOutMB),c:'#4ade80'},{i:'📊',l:'إجمالي',v:fmtMB(stats.summary.totalDataInMB+stats.summary.totalDataOutMB),c:'#fb923c'}].map((s,i)=>(
          <div key={i} style={{...S.card,textAlign:'center',padding:12}}><div style={{fontSize:18,marginBottom:3}}>{s.i}</div><div style={{fontSize:14,fontWeight:900,color:s.c}}>{s.v}</div><div style={{fontSize:9,color:'#354E6A',marginTop:2}}>{s.l}</div></div>
        ))}
      </div>
      <div className="stats-grid-2" style={{marginBottom:12}}>
        <div style={S.card}>
          <h3 style={{fontSize:12,fontWeight:700,color:'#E2F0FB',marginBottom:12}}>🖥️ الأجهزة</h3>
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {stats.devices.length===0?<div style={{textAlign:'center',color:'#6B8CAE',padding:20,fontSize:12}}>لا يوجد</div>:stats.devices.map((d:any)=>(
              <div key={d.id} style={{background:'#070B12',border:'1px solid #1C2A40',borderRadius:9,padding:'9px 11px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                  <span style={{fontSize:12,fontWeight:700,color:d.isActive?'#E2F0FB':'#354E6A'}}>{d.name}</span>
                  <div style={{display:'flex',gap:4,alignItems:'center',flexWrap:'wrap'}}>
                    <span style={S.tag(d.isActive,'#00E676')}>{d.isActive?'● نشط DB':'○ DB'}</span>
                    {devStatus[d.id]&&(
                      <span style={{...S.tag(devStatus[d.id].online,'#00D4FF'),fontSize:9}} title={devStatus[d.id].reason}>
                        {devStatus[d.id].online?'🟢 متصل':'🔴 مفصول'}
                      </span>
                    )}
                  </div>
                </div>
                {devStatus[d.id]&&(
                  <div style={{fontSize:9,color:devStatus[d.id].online?'#00E676':'#FF6666',marginBottom:4,fontStyle:'italic'}}>{devStatus[d.id].reason}</div>
                )}
                <div style={{display:'flex',gap:10,fontSize:10,flexWrap:'wrap'}}>
                  <span style={{color:'#00E676'}}>📡 {d._count.sessions}</span>
                  <span style={{color:'#00D4FF'}}>🎫 {d._count.vouchers}</span>
                  {d.wifiSSID&&<span style={{color:'#6B8CAE'}}>📶 {d.wifiSSID}</span>}
                  {d.tunnelPort&&<span style={{color:'#818cf8',fontFamily:'monospace'}}>🔑 :{d.tunnelPort}</span>}
                </div>
                {d.sshPublicKey&&(
                  <div style={{marginTop:5,padding:'4px 7px',background:'rgba(129,140,248,0.08)',border:'1px solid rgba(129,140,248,0.2)',borderRadius:6}}>
                    <div style={{fontSize:9,color:'#818cf8',marginBottom:2}}>🔐 SSH Public Key</div>
                    <div style={{fontSize:8,color:'#6B8CAE',fontFamily:'monospace',wordBreak:'break-all',lineHeight:1.4,maxHeight:28,overflow:'hidden'}}>{d.sshPublicKey}</div>
                    <button onClick={()=>navigator.clipboard?.writeText(d.sshPublicKey)} style={{marginTop:3,fontSize:8,padding:'2px 6px',background:'#1C2A40',border:'none',borderRadius:4,color:'#818cf8',cursor:'pointer',fontFamily:'Cairo,sans-serif'}}>📋 نسخ</button>
                  </div>
                )}
                {!d.sshPublicKey&&(
                  <div style={{marginTop:4,fontSize:9,color:'#354E6A',fontStyle:'italic'}}>⏳ SSH Key لسه ما اتسجلش — سطّب الراوتر</div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div style={S.card}>
          <h3 style={{fontSize:12,fontWeight:700,color:'#E2F0FB',marginBottom:12}}>👤 الأدمنز</h3>
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {stats.admins.length===0?<div style={{textAlign:'center',color:'#6B8CAE',padding:20,fontSize:12}}>لا يوجد</div>:stats.admins.map((a:any)=>(
              <div key={a.id} style={{background:'#070B12',border:'1px solid #1C2A40',borderRadius:9,padding:'9px 11px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:700,color:'#E2F0FB'}}>{a.name}</span>
                  <span style={{fontSize:10,color:a.activeSessionsCount>0?'#00E676':'#6B8CAE'}}>📡 {a.activeSessionsCount}</span>
                </div>
                <div style={{display:'flex',gap:8,fontSize:10,flexWrap:'wrap'}}>
                  <span style={{color:'#00D4FF'}}>🎫 {a.activeVouchers}</span>
                  <span style={{color:'#6B8CAE'}}>{a.unusedVouchers} متاح</span>
                  <span style={{color:'#fb923c'}}>📊 {fmtMB(a.totalDataUsedMB)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={S.card}>
        <h3 style={{fontSize:12,fontWeight:700,color:'#E2F0FB',marginBottom:12}}>📊 تقرير الاستهلاك</h3>
        {stats.consumption.length===0?<div style={{textAlign:'center',color:'#6B8CAE',padding:20,fontSize:12}}>لا يوجد بيانات</div>:(
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:440}}>
              <thead><tr style={{borderBottom:'1px solid #1C2A40'}}>{['الجهاز','تنزيل','رفع','الإجمالي','جلسات','الوقت'].map(h=><th key={h} style={{padding:'7px 9px',color:'#6B8CAE',fontWeight:600,textAlign:'right',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
              <tbody>
                {stats.consumption.map((r,i)=>(
                  <tr key={r.deviceId} style={{borderBottom:'1px solid #070B12',background:i%2===0?'transparent':'rgba(255,255,255,0.01)'}}>
                    <td style={{padding:'7px 9px',color:'#E2F0FB',fontWeight:600}}>{r.deviceName}</td>
                    <td style={{padding:'7px 9px',color:'#22d3ee'}}>⬇️ {fmtMB(r.totalInMB)}</td>
                    <td style={{padding:'7px 9px',color:'#4ade80'}}>⬆️ {fmtMB(r.totalOutMB)}</td>
                    <td style={{padding:'7px 9px',color:'#fb923c',fontWeight:700}}>{fmtMB(r.totalMB)}</td>
                    <td style={{padding:'7px 9px',color:'#6B8CAE'}}>{r.sessions}</td>
                    <td style={{padding:'7px 9px',color:'#6B8CAE'}}>{fmtTime(r.timeMin)}</td>
                  </tr>
                ))}
                <tr style={{borderTop:'2px solid #1C2A40',background:'rgba(0,136,204,0.05)'}}>
                  <td style={{padding:'7px 9px',color:'#00D4FF',fontWeight:900}}>الإجمالي</td>
                  <td style={{padding:'7px 9px',color:'#22d3ee',fontWeight:700}}>{fmtMB(stats.consumption.reduce((s,r)=>s+r.totalInMB,0))}</td>
                  <td style={{padding:'7px 9px',color:'#4ade80',fontWeight:700}}>{fmtMB(stats.consumption.reduce((s,r)=>s+r.totalOutMB,0))}</td>
                  <td style={{padding:'7px 9px',color:'#fb923c',fontWeight:900}}>{fmtMB(stats.consumption.reduce((s,r)=>s+r.totalMB,0))}</td>
                  <td style={{padding:'7px 9px',color:'#6B8CAE',fontWeight:700}}>{stats.consumption.reduce((s,r)=>s+r.sessions,0)}</td>
                  <td style={{padding:'7px 9px',color:'#6B8CAE',fontWeight:700}}>{fmtTime(stats.consumption.reduce((s,r)=>s+r.timeMin,0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function VouchersTab() {
  const [admins,setAdmins]=useState<Admin[]>([]); const [selAdmin,setSelAdmin]=useState(''); const [status,setStatus]=useState('USED')
  const [vouchers,setVouchers]=useState<VoucherItem[]>([]); const [total,setTotal]=useState(0); const [loading,setLoading]=useState(false)
  const [msg,setMsg]=useState(''); const [selected,setSelected]=useState<Set<string>>(new Set()); const [confirm,setConfirm]=useState<null|{action:string;label:string}>(null)

  useEffect(()=>{fetch('/api/superadmin/admins').then(r=>r.json()).then(d=>{if(Array.isArray(d)) setAdmins(d)})},[])
  const loadVouchers=useCallback(async()=>{
    if(!selAdmin&&status!=='ALL'){setVouchers([]);return}
    setLoading(true)
    const params=new URLSearchParams({limit:'300'})
    if(selAdmin) params.set('adminId',selAdmin)
    if(status!=='ALL') params.set('status',status)
    const r=await fetch(`/api/superadmin/vouchers?${params}`);const d=await r.json()
    if(d.vouchers){setVouchers(d.vouchers);setTotal(d.total)}
    setSelected(new Set());setLoading(false)
  },[selAdmin,status])
  useEffect(()=>{if(selAdmin) loadVouchers()},[selAdmin,status])

  const toggleSel=(id:string)=>setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n})
  const selAll=selected.size===vouchers.length&&vouchers.length>0
  const toggleAll=()=>selAll?setSelected(new Set()):setSelected(new Set(vouchers.map(v=>v.id)))

  const doAction=async()=>{
    if(!confirm) return; setLoading(true); setMsg('')
    try{
      const ids=selected.size>0?[...selected]:undefined
      let res:Response
      if(confirm.action==='delete'){
        res=await fetch('/api/superadmin/vouchers',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,adminId:selAdmin||undefined,status:ids?undefined:status})})
      } else {
        res=await fetch('/api/superadmin/vouchers',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,adminId:selAdmin||undefined,fromStatus:ids?undefined:status,toStatus:'EXPIRED'})})
      }
      const d=await res.json()
      if(d.success){setMsg(`✅ تم — ${d.deleted||d.updated||0} كارت`);loadVouchers()} else setMsg('❌ '+d.error)
    }catch(e:any){setMsg('❌ '+e.message)}
    setConfirm(null);setLoading(false)
  }

  const sColor:Record<string,string>={UNUSED:'#6B8CAE',ACTIVE:'#00E676',DEPLETED:'#FF4444',EXPIRED:'#fb923c'}
  const sLabel:Record<string,string>={UNUSED:'غير مستخدم',ACTIVE:'نشط',DEPLETED:'نفدت',EXPIRED:'انتهى'}

  return (
    <div>
      {confirm&&(
        <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setConfirm(null)}>
          <div style={{...S.card,width:'100%',maxWidth:340}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:36,textAlign:'center',marginBottom:10}}>{confirm.action==='delete'?'🗑️':'⛔'}</div>
            <div style={{fontSize:14,fontWeight:700,color:'#E2F0FB',textAlign:'center',marginBottom:6}}>{confirm.label}</div>
            <div style={{fontSize:12,color:'#6B8CAE',textAlign:'center',marginBottom:18}}>{selected.size>0?`${selected.size} كارت`:`كل الكروت (${total})`}</div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={doAction} style={{...S.btn(confirm.action==='delete'?'#FF4444':'#fb923c','#fff'),flex:1}}>{confirm.label}</button>
              <button onClick={()=>setConfirm(null)} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',flex:1}}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
      <div style={{...S.card,marginBottom:12,padding:12}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{flex:'1 1 160px'}}><label style={S.label}>الأدمن</label><select style={{...S.input,padding:'8px 11px',fontSize:12}} value={selAdmin} onChange={e=>setSelAdmin(e.target.value)}><option value="">كل الأدمنز</option>{admins.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          <div style={{flex:'1 1 130px'}}><label style={S.label}>الحالة</label><select style={{...S.input,padding:'8px 11px',fontSize:12}} value={status} onChange={e=>setStatus(e.target.value)}><option value="USED">مستخدمة</option><option value="UNUSED">غير مستخدمة</option><option value="ACTIVE">نشطة</option><option value="DEPLETED">نفدت</option><option value="EXPIRED">انتهى</option><option value="ALL">الكل</option></select></div>
          <button onClick={loadVouchers} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',padding:'8px 14px',fontSize:12}}>🔍 بحث</button>
        </div>
      </div>
      {msg&&<div style={S.msg(msg.startsWith('✅'))}>{msg}<span onClick={()=>setMsg('')} style={{cursor:'pointer'}}>✕</span></div>}
      {vouchers.length>0&&(
        <div style={{...S.card,marginBottom:12,padding:10,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'#6B8CAE'}}>{selected.size>0?`${selected.size} محدد`:`${vouchers.length} كارت`}</span>
          <button onClick={toggleAll} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'5px 10px'}}>{selAll?'إلغاء الكل':'تحديد الكل'}</button>
          <div style={{flex:1}}/>
          <button onClick={()=>{
            const ids = selected.size>0 ? [...selected] : vouchers.map(v=>v.id)
            window.open(`/print?ids=${ids.join(',')}&sa=1`, '_blank')
          }} style={{...S.btn('rgba(0,212,255,0.12)','#00D4FF'),border:'1px solid rgba(0,212,255,0.3)',fontSize:11,padding:'6px 12px'}}>🖨️ طباعة{selected.size>0?` (${selected.size})`:` (${vouchers.length})`}</button>
          <button onClick={()=>setConfirm({action:'disable',label:'⛔ تعطيل'})} style={{...S.btn('rgba(251,146,60,0.12)','#fb923c'),border:'1px solid rgba(251,146,60,0.3)',fontSize:11,padding:'6px 12px'}}>⛔ تعطيل{selected.size>0?` (${selected.size})`:''}</button>
          <button onClick={()=>setConfirm({action:'delete',label:'🗑️ حذف'})} style={{...S.btn('rgba(255,68,68,0.12)','#FF4444'),border:'1px solid rgba(255,68,68,0.3)',fontSize:11,padding:'6px 12px'}}>🗑️ حذف{selected.size>0?` (${selected.size})`:''}</button>
        </div>
      )}
      <div style={S.card}>
        {loading?<div style={{textAlign:'center',padding:40,color:'#6B8CAE'}}>⏳</div>:vouchers.length===0?(
          <div style={{textAlign:'center',padding:40,color:'#6B8CAE'}}><div style={{fontSize:40,marginBottom:8}}>🎫</div><div>حدد أدمن واضغط بحث</div></div>
        ):(
          <div style={{overflowX:'auto'}}>
            <div style={{fontSize:11,color:'#6B8CAE',marginBottom:8}}>إجمالي: {total} (يعرض {vouchers.length})</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:460}}>
              <thead><tr style={{borderBottom:'1px solid #1C2A40'}}><th style={{padding:'7px 8px',width:28}}></th>{['الكود','الحالة','الباقة','الأدمن','الجهاز'].map(h=><th key={h} style={{padding:'7px 8px',color:'#6B8CAE',fontWeight:600,textAlign:'right',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
              <tbody>
                {vouchers.map(v=>(
                  <tr key={v.id} style={{borderBottom:'1px solid #0C1420',background:selected.has(v.id)?'rgba(0,136,204,0.05)':'transparent'}}>
                    <td style={{padding:'6px 8px'}}><div onClick={()=>toggleSel(v.id)} style={{width:14,height:14,borderRadius:3,cursor:'pointer',background:selected.has(v.id)?'#0088CC':'transparent',border:`2px solid ${selected.has(v.id)?'#0088CC':'#354E6A'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff'}}>{selected.has(v.id)?'✓':''}</div></td>
                    <td style={{padding:'6px 8px',fontFamily:'monospace',color:'#00D4FF',fontSize:10}}>{v.code}</td>
                    <td style={{padding:'6px 8px'}}><span style={{...S.tag(true,sColor[v.status]||'#6B8CAE')}}>{sLabel[v.status]||v.status}</span></td>
                    <td style={{padding:'6px 8px',color:'#6B8CAE'}}>{v.packageType==='BOTH'?'داتا+وقت':v.packageType==='DATA_ONLY'?'داتا':'وقت'}</td>
                    <td style={{padding:'6px 8px',color:'#6B8CAE'}}>{v.hotspotAdmin?.name||'—'}</td>
                    <td style={{padding:'6px 8px',color:'#6B8CAE'}}>{v.device?.name||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function GenerateTab({ sa }:{ sa:SA }) {
  const [admins,setAdmins]=useState<Admin[]>([]); const [devices,setDevices]=useState<any[]>([]); const [msg,setMsg]=useState(''); const [loading,setLoading]=useState(false)
  const [gen,setGen]=useState({hotspotAdminId:'',deviceId:'',count:1,packageType:'BOTH',voucherType:'STANDARD',dataLimitMB:1024,timeLimitMin:60,speedLimitMbps:'',maxUsageCount:1,codeType:'mix',validityDays:'',isRenewable:false,codeLength:16})

  useEffect(()=>{fetch('/api/superadmin/admins').then(r=>r.json()).then(d=>{if(Array.isArray(d)) setAdmins(d)})},[])
  useEffect(()=>{
    if(!gen.hotspotAdminId){setDevices([]);setGen(g=>({...g,deviceId:''}));return}
    fetch(`/api/admin/devices?adminId=${gen.hotspotAdminId}`).then(r=>r.json()).then(d=>{if(Array.isArray(d)) setDevices(d)})
  },[gen.hotspotAdminId])

  const isQRType=gen.voucherType==='QR'; const isUnlimited=gen.packageType==='UNLIMITED'

  const generate=async()=>{
    if(!gen.hotspotAdminId){setMsg('❌ اختار الأدمن أولاً');return}
    if(!gen.deviceId){setMsg('❌ اختار الجهاز أولاً');return}
    setLoading(true);setMsg('')
    const body:any={hotspotAdminId:gen.hotspotAdminId,deviceId:gen.deviceId,isSuperAdmin:true,count:isQRType?1:+gen.count,packageType:gen.packageType,voucherType:gen.voucherType,maxUsageCount:isQRType?+gen.maxUsageCount:1,codeType:gen.codeType,isRenewable:gen.isRenewable,codeLength:gen.codeLength}
    if(!isUnlimited&&gen.packageType!=='TIME_ONLY') body.dataLimitMB=+gen.dataLimitMB
    if(!isUnlimited&&gen.packageType!=='DATA_ONLY') body.timeLimitMin=+gen.timeLimitMin
    if(gen.speedLimitMbps) body.speedLimitMbps=+gen.speedLimitMbps
    if(gen.validityDays) body.validityDays=+gen.validityDays
    const res=await fetch('/api/vouchers/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    const d=await res.json()
    if(d.success){setMsg(`✅ تم توليد ${d.count} كارت`);window.open(`${d.isQR?'/print-qr':'/print'}?batch=${d.printBatch}&sa=1`,'_blank')}
    else setMsg('❌ '+d.error)
    setLoading(false)
  }

  return (
    <div style={S.card}>
      <h3 style={{fontSize:14,fontWeight:700,color:'#E2F0FB',marginBottom:14}}>✨ توليد كروت (السوبر أدمن)</h3>
      {msg&&<div style={S.msg(msg.startsWith('✅'))}>{msg}<span onClick={()=>setMsg('')} style={{cursor:'pointer'}}>✕</span></div>}
      <div className="form-grid-2" style={{marginBottom:14}}>
        <div style={{gridColumn:'span 2'}}><label style={S.label}>👤 الأدمن</label><select style={S.input} value={gen.hotspotAdminId} onChange={e=>setGen({...gen,hotspotAdminId:e.target.value})}><option value="">اختر أدمن...</option>{admins.map(a=><option key={a.id} value={a.id}>{a.name} (@{a.username})</option>)}</select></div>
        <div style={{gridColumn:'span 2'}}>
          <label style={S.label}>🖥️ الجهاز <span style={{color:'#FF4444'}}>*</span></label>
          <select style={{...S.input,opacity:!gen.hotspotAdminId?0.4:1}} value={gen.deviceId} onChange={e=>setGen({...gen,deviceId:e.target.value})} disabled={!gen.hotspotAdminId}>
            <option value="">— اختر الجهاز —</option>
            {devices.map((d:any)=><option key={d.id} value={d.id}>{d.name} · {d.gatewayId}</option>)}
          </select>
          {gen.hotspotAdminId&&devices.length===0&&<div style={{fontSize:11,color:'#FF4444',marginTop:5}}>⚠️ هذا الأدمن ليس لديه أجهزة</div>}
        </div>
        <div><label style={S.label}>نوع الكارت</label><select style={S.input} value={gen.voucherType} onChange={e=>setGen({...gen,voucherType:e.target.value})}><option value="STANDARD">📄 عادي</option><option value="QR">📷 QR</option><option value="UNLIMITED">♾️ Unlimited</option></select></div>
        {isQRType?(<div><label style={S.label}>🔁 عدد مرات السكان</label><input style={S.input} type="number" min={1} value={gen.maxUsageCount} onChange={e=>setGen({...gen,maxUsageCount:+e.target.value})}/></div>):(<div><label style={S.label}>عدد الكروت</label><input style={S.input} type="number" min={1} value={gen.count} onChange={e=>setGen({...gen,count:+e.target.value})}/></div>)}
        <div><label style={S.label}>نوع الباقة</label><select style={S.input} value={gen.packageType} onChange={e=>setGen({...gen,packageType:e.target.value})}><option value="BOTH">داتا + وقت</option><option value="DATA_ONLY">داتا فقط</option><option value="TIME_ONLY">وقت فقط</option><option value="UNLIMITED">♾️ بلا حد</option></select></div>
        {!isUnlimited&&gen.packageType!=='TIME_ONLY'&&(<div><label style={S.label}>داتا (MB)</label><input style={S.input} type="number" min={1} value={gen.dataLimitMB} onChange={e=>setGen({...gen,dataLimitMB:+e.target.value})}/></div>)}
        {!isUnlimited&&gen.packageType!=='DATA_ONLY'&&(<div><label style={S.label}>وقت (دقيقة)</label><input style={S.input} type="number" min={1} value={gen.timeLimitMin} onChange={e=>setGen({...gen,timeLimitMin:+e.target.value})}/></div>)}
        <div><label style={S.label}>صلاحية (أيام)</label><input style={S.input} type="number" min={1} value={gen.validityDays} onChange={e=>setGen({...gen,validityDays:e.target.value})} placeholder="فارغ = بلا انتهاء"/></div>
        <div><label style={S.label}>سرعة (Mbps)</label><input style={S.input} type="number" min={0} value={gen.speedLimitMbps} onChange={e=>setGen({...gen,speedLimitMbps:e.target.value})} placeholder="فارغ = بلا حد"/></div>
        <div><label style={S.label}>نوع الكود</label><select style={S.input} value={gen.codeType} onChange={e=>setGen({...gen,codeType:e.target.value})}><option value="mix">حروف+أرقام</option><option value="letters">حروف</option><option value="numbers">أرقام</option></select></div>
        <div>
          <label style={S.label}>عدد حروف الكود: {gen.codeLength}</label>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={()=>setGen(g=>({...g,codeLength:Math.max(4,g.codeLength-4)}))} style={{width:34,height:34,background:'#1C2A40',border:'none',borderRadius:8,color:'#E2F0FB',fontSize:16,cursor:'pointer',flexShrink:0}}>−</button>
            <input type="range" min={4} max={32} step={4} value={gen.codeLength} onChange={e=>setGen({...gen,codeLength:+e.target.value})} style={{flex:1,accentColor:'#0088CC'}}/>
            <button onClick={()=>setGen(g=>({...g,codeLength:Math.min(32,g.codeLength+4)}))} style={{width:34,height:34,background:'#1C2A40',border:'none',borderRadius:8,color:'#E2F0FB',fontSize:16,cursor:'pointer',flexShrink:0}}>+</button>
          </div>
          <div style={{fontSize:10,color:'#6B8CAE',marginTop:3,fontFamily:'monospace',textAlign:'center'}}>{Array(Math.ceil(gen.codeLength/4)).fill('XXXX').join('-').slice(0,gen.codeLength+Math.ceil(gen.codeLength/4)-1)}</div>
        </div>
      </div>
      <button style={{...S.btn(),padding:'12px 28px',opacity:loading?0.7:1}} onClick={generate} disabled={loading||!gen.deviceId||!gen.hotspotAdminId}>{loading?'⏳ جاري التوليد...':'✨ توليد وطباعة'}</button>
    </div>
  )
}

function RewardsTab({ sa }:{ sa:SA }) {
  const [tasks,setTasks]=useState<any[]>([]); const [msg,setMsg]=useState(''); const [showNew,setShowNew]=useState(false)
  const [form,setForm]=useState({title:'',description:'',url:'',callbackSecret:'',rewardType:'EXTRA_TIME',rewardTimeMins:30,rewardDataMB:0,level:1,requiredCount:1,order:0})
  const load=useCallback(async()=>{const r=await fetch('/api/rewards/tasks');const d=await r.json();setTasks(d.tasks||[])},[])
  useEffect(()=>{load()},[load])
  const create=async()=>{
    const r=await fetch('/api/rewards/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,rewardTimeMins:+form.rewardTimeMins||null,rewardDataMB:+form.rewardDataMB||null,superAdminId:sa.id})})
    const d=await r.json()
    if(d.success){setMsg('✅ تم');load();setShowNew(false)} else setMsg('❌ '+d.error)
  }
  const toggle=async(t:any)=>{await fetch('/api/rewards/tasks',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:t.id,isActive:!t.isActive})});load()}
  const del=async(id:string)=>{if(!confirm('حذف؟')) return;await fetch('/api/rewards/tasks',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});load()}
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:14,fontWeight:700,color:'#E2F0FB'}}>🎁 مهام النت المجاني</h3>
        <button style={S.btn()} onClick={()=>setShowNew(!showNew)}>+ مهمة</button>
      </div>
      {msg&&<div style={S.msg(msg.startsWith('✅'))}>{msg}<span onClick={()=>setMsg('')} style={{cursor:'pointer'}}>✕</span></div>}
      {showNew&&(
        <div style={{...S.card,marginBottom:12}}>
          <div className="form-grid-2" style={{marginBottom:12}}>
            <div style={{gridColumn:'span 2'}}><label style={S.label}>عنوان المهمة</label><input style={S.input} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder='شوف الإعلان وكسب 30 دقيقة'/></div>
            <div style={{gridColumn:'span 2'}}><label style={S.label}>رابط الموقع</label><input style={S.input} dir="ltr" value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://example.com"/></div>
            <div style={{gridColumn:'span 2'}}><label style={S.label}>Callback Secret</label><input style={S.input} dir="ltr" value={form.callbackSecret} onChange={e=>setForm({...form,callbackSecret:e.target.value})}/></div>
            <div><label style={S.label}>نوع المكافأة</label><select style={{...S.input}} value={form.rewardType} onChange={e=>setForm({...form,rewardType:e.target.value})}><option value="EXTRA_TIME">⏱️ وقت</option><option value="EXTRA_DATA">📶 داتا</option><option value="BOTH">الاتنين</option></select></div>
            {(form.rewardType==='EXTRA_TIME'||form.rewardType==='BOTH')&&<div><label style={S.label}>دقائق إضافية</label><input style={S.input} type="number" value={form.rewardTimeMins} onChange={e=>setForm({...form,rewardTimeMins:+e.target.value})}/></div>}
            {(form.rewardType==='EXTRA_DATA'||form.rewardType==='BOTH')&&<div><label style={S.label}>MB إضافية</label><input style={S.input} type="number" value={form.rewardDataMB} onChange={e=>setForm({...form,rewardDataMB:+e.target.value})}/></div>}
          </div>
          <div style={{display:'flex',gap:8}}><button style={S.btn()} onClick={create}>💾 حفظ</button><button style={{...S.btn('#1C2A40','#6B8CAE')}} onClick={()=>setShowNew(false)}>إلغاء</button></div>
        </div>
      )}
      {tasks.map(t=>(
        <div key={t.id} style={{...S.card,marginBottom:8,opacity:t.isActive?1:0.55}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:'#E2F0FB',marginBottom:3}}>{t.title}</div>
              <div style={{fontSize:10,color:'#354E6A',fontFamily:'monospace',marginBottom:5,wordBreak:'break-all'}}>🔗 {t.url}</div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                <span style={S.tag(true)}>Lvl {t.level}</span>
                {t.rewardTimeMins&&<span style={S.tag(true,'#818cf8')}>⏱️ +{t.rewardTimeMins}د</span>}
                {t.rewardDataMB&&<span style={S.tag(true,'#22d3ee')}>📶 +{t.rewardDataMB}MB</span>}
              </div>
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              <button onClick={()=>toggle(t)} style={{...S.btn(t.isActive?'rgba(255,68,68,0.1)':'rgba(0,230,118,0.1)',t.isActive?'#FF4444':'#00E676'),border:`1px solid ${t.isActive?'rgba(255,68,68,0.3)':'rgba(0,230,118,0.3)'}`,fontSize:11,padding:'6px 10px'}}>{t.isActive?'⏸':'▶️'}</button>
              <button onClick={()=>del(t.id)} style={{...S.btn('rgba(255,68,68,0.08)','#FF4444'),border:'1px solid rgba(255,68,68,0.25)',fontSize:11,padding:'6px 10px'}}>🗑️</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function WifiTab() {
  const [admins,setAdmins]=useState<Admin[]>([]); const [devices,setDevices]=useState<any[]>([])
  const [selAdmin,setSelAdmin]=useState(''); const [selDev,setSelDev]=useState(''); const [newSSID,setNewSSID]=useState(''); const [msg,setMsg]=useState(''); const [loading,setLoading]=useState(false)
  useEffect(()=>{fetch('/api/superadmin/admins').then(r=>r.json()).then(d=>{if(Array.isArray(d)) setAdmins(d)})},[])
  useEffect(()=>{if(!selAdmin) return;fetch(`/api/admin/devices?adminId=${selAdmin}`).then(r=>r.json()).then(d=>{if(Array.isArray(d)) setDevices(d)})},[selAdmin])
  const change=async()=>{
    if(!selDev||!newSSID.trim()){setMsg('❌ اختار الجهاز وأدخل الاسم');return}
    setLoading(true)
    const r=await fetch('/api/admin/wifi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:selDev,newSSID})})
    const d=await r.json()
    setMsg(d.success?`✅ ${d.message}`:`❌ ${d.error}`)
    setLoading(false)
  }
  return (
    <div style={S.card}>
      <h3 style={{fontSize:14,fontWeight:700,color:'#E2F0FB',marginBottom:14}}>📶 تغيير اسم الـ WiFi</h3>
      {msg&&<div style={S.msg(msg.startsWith('✅'))}>{msg}<span onClick={()=>setMsg('')} style={{cursor:'pointer'}}>✕</span></div>}
      <div className="form-grid-2" style={{marginBottom:12}}>
        <div><label style={S.label}>الأدمن</label><select style={{...S.input}} value={selAdmin} onChange={e=>{setSelAdmin(e.target.value);setSelDev('')}}><option value="">اختر...</option>{admins.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label style={S.label}>الجهاز</label><select style={{...S.input}} value={selDev} onChange={e=>setSelDev(e.target.value)} disabled={!selAdmin}><option value="">اختر...</option>{devices.map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div style={{gridColumn:'span 2'}}><label style={S.label}>اسم الـ WiFi الجديد</label><input style={{...S.input,fontFamily:'monospace',direction:'ltr'}} value={newSSID} onChange={e=>setNewSSID(e.target.value)} placeholder="CafeNile_Free" maxLength={32}/></div>
      </div>
      <button style={{...S.btn(),opacity:loading?0.7:1}} onClick={change} disabled={loading}>{loading?'⏳ جاري...':'📶 تغيير'}</button>
    </div>
  )
}

function SASalesTab() {
  const [admins,setAdmins]=useState<Admin[]>([]); const [selAdmin,setSelAdmin]=useState(''); const [period,setPeriod]=useState('month')
  const [sales,setSales]=useState<any[]>([]); const [totals,setTotals]=useState({revenue:0,count:0}); const [loading,setLoading]=useState(false)

  useEffect(()=>{fetch('/api/superadmin/admins').then(r=>r.json()).then(d=>{if(Array.isArray(d)) setAdmins(d)})},[])
  const load=useCallback(async()=>{
    if(!selAdmin) return; setLoading(true)
    try{const r=await fetch(`/api/admin/sales?adminId=${selAdmin}&period=${period}`);const d=await r.json();setSales(d.sales||[]);setTotals({revenue:d.totalRevenue||0,count:d.totalCount||0})}catch{}
    setLoading(false)
  },[selAdmin,period])
  useEffect(()=>{load()},[selAdmin,period])

  const PMETHODS:Record<string,string>={CASH:'💵 كاش',CARD:'💳 كارت',TRANSFER:'📲 تحويل',OTHER:'🔄 أخرى'}
  const PERIODS=[{v:'day',l:'اليوم'},{v:'week',l:'الأسبوع'},{v:'month',l:'الشهر'},{v:'all',l:'الكل'}]

  return (
    <div>
      <div style={{...S.card,marginBottom:12,padding:12}}>
        <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
          <div style={{flex:'1 1 180px'}}><label style={S.label}>الأدمن</label><select style={{...S.input,padding:'8px 11px',fontSize:12}} value={selAdmin} onChange={e=>setSelAdmin(e.target.value)}><option value="">اختر أدمن...</option>{admins.map(a=><option key={a.id} value={a.id}>{a.name} (@{a.username})</option>)}</select></div>
          <div><label style={S.label}>الفترة</label><div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{PERIODS.map(p=>(<button key={p.v} onClick={()=>setPeriod(p.v)} style={{...S.btn(period===p.v?'#0088CC':'#111B2D',period===p.v?'#000':'#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'6px 10px'}}>{p.l}</button>))}</div></div>
        </div>
      </div>

      {!selAdmin&&(
        <div style={S.card}>
          <h3 style={{fontSize:12,fontWeight:700,color:'#E2F0FB',marginBottom:12}}>📊 نظرة عامة</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:8}}>
            {admins.map((a,i)=>(
              <div key={i} style={{background:'#070B12',border:'1px solid #1C2A40',borderRadius:10,padding:'11px 13px',cursor:'pointer'}} onClick={()=>setSelAdmin(a.id)}>
                <div style={{fontSize:12,fontWeight:700,color:'#E2F0FB',marginBottom:5}}>{a.name}</div>
                <div style={{fontSize:10,color:'#6B8CAE'}}>🎫 {a.totalVouchersGenerated}/{a.maxVouchersTotal}</div>
                <div style={{marginTop:7,height:3,background:'#1C2A40',borderRadius:2,overflow:'hidden'}}><div style={{width:`${Math.min(100,(a.totalVouchersGenerated/a.maxVouchersTotal)*100)}%`,height:'100%',background:'#0088CC',borderRadius:2}}/></div>
                <div style={{fontSize:9,color:'#354E6A',marginTop:3}}>اضغط لعرض المبيعات</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selAdmin&&(
        <>
          <div className="stats-grid-3" style={{marginBottom:12}}>
            {[{icon:'💰',label:'الإيرادات',val:totals.revenue.toFixed(2)+' ج',color:'#00E676'},{icon:'🎫',label:'المبيعات',val:totals.count,color:'#00D4FF'},{icon:'📈',label:'متوسط البيعة',val:totals.count?(totals.revenue/totals.count).toFixed(1)+' ج':'—',color:'#fb923c'}].map((s,i)=>(
              <div key={i} style={{...S.card,textAlign:'center',padding:14}}><div style={{fontSize:22,marginBottom:5}}>{s.icon}</div><div style={{fontSize:18,fontWeight:900,color:s.color}}>{s.val}</div><div style={{fontSize:10,color:'#354E6A',marginTop:2}}>{s.label}</div></div>
            ))}
          </div>
          <div style={S.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,gap:8,flexWrap:'wrap'}}>
              <h3 style={{fontSize:13,fontWeight:700,color:'#E2F0FB'}}>📋 مبيعات: {admins.find(a=>a.id===selAdmin)?.name}</h3>
              {loading&&<span style={{fontSize:12,color:'#6B8CAE'}}>⏳</span>}
            </div>
            {sales.length===0?(<div style={{textAlign:'center',padding:'28px 0',color:'#6B8CAE'}}><div style={{fontSize:36,marginBottom:8}}>💰</div><div>لا توجد مبيعات</div></div>):(
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:400}}>
                  <thead><tr style={{borderBottom:'1px solid #1C2A40'}}>{['الكارت','السعر','العميل','الدفع','التاريخ'].map(h=>(<th key={h} style={{padding:'7px 9px',color:'#6B8CAE',fontWeight:600,textAlign:'right',whiteSpace:'nowrap'}}>{h}</th>))}</tr></thead>
                  <tbody>
                    {sales.map((s:any)=>(
                      <tr key={s.id} style={{borderBottom:'1px solid #0C1420'}}>
                        <td style={{padding:'7px 9px',fontFamily:'monospace',color:'#00D4FF',fontSize:10}}>{s.voucher?.code||'—'}</td>
                        <td style={{padding:'7px 9px',color:'#00E676',fontWeight:700}}>{(s.amount||0).toFixed(2)} ج</td>
                        <td style={{padding:'7px 9px',color:'#E2F0FB'}}>{s.buyerName||'—'}</td>
                        <td style={{padding:'7px 9px'}}><span style={{padding:'2px 7px',borderRadius:20,fontSize:10,background:'rgba(0,212,255,0.08)',border:'1px solid rgba(0,212,255,0.2)',color:'#00D4FF'}}>{PMETHODS[s.paymentMethod]||s.paymentMethod}</span></td>
                        <td style={{padding:'7px 9px',color:'#354E6A',fontSize:10}}>{new Date(s.soldAt).toLocaleDateString('ar-EG',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{borderTop:'2px solid #1C2A40'}}><td style={{padding:'7px 9px',color:'#E2F0FB',fontWeight:700}}>الإجمالي ({sales.length})</td><td style={{padding:'7px 9px',color:'#00E676',fontWeight:900}}>{totals.revenue.toFixed(2)} ج</td><td colSpan={3}/></tr></tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Accounts Tab (Google Sheets Style) ─────────────────────────────────────
type SheetColumn = { id: string; label: string; type: 'text'|'number'|'date'|'currency'|'badge'; width?: number }
type SheetRow = Record<string, any>
type Sheet = { id: string; name: string; icon: string; columns: SheetColumn[]; rows: SheetRow[] }

const DEFAULT_SHEETS: Sheet[] = [
  {
    id: 'expenses', name: 'المصروفات', icon: '💸',
    columns: [
      { id:'date',     label:'التاريخ',    type:'date',     width:120 },
      { id:'category', label:'التصنيف',   type:'badge',    width:120 },
      { id:'desc',     label:'البيان',     type:'text',     width:200 },
      { id:'amount',   label:'المبلغ',     type:'currency', width:100 },
      { id:'note',     label:'ملاحظة',     type:'text',     width:160 },
    ],
    rows: [],
  },
  {
    id: 'revenue', name: 'الإيرادات', icon: '💰',
    columns: [
      { id:'date',     label:'التاريخ',    type:'date',     width:120 },
      { id:'source',   label:'المصدر',     type:'badge',    width:120 },
      { id:'admin',    label:'الأدمن',     type:'text',     width:150 },
      { id:'amount',   label:'المبلغ',     type:'currency', width:100 },
      { id:'note',     label:'ملاحظة',     type:'text',     width:160 },
    ],
    rows: [],
  },
  {
    id: 'subscriptions', name: 'الاشتراكات', icon: '📅',
    columns: [
      { id:'admin',    label:'الأدمن',     type:'text',     width:150 },
      { id:'plan',     label:'الخطة',      type:'badge',    width:100 },
      { id:'start',    label:'البداية',    type:'date',     width:120 },
      { id:'end',      label:'الانتهاء',   type:'date',     width:120 },
      { id:'amount',   label:'السعر',      type:'currency', width:100 },
      { id:'status',   label:'الحالة',     type:'badge',    width:100 },
    ],
    rows: [],
  },
]

const BADGE_COLORS: Record<string, string> = {
  'إيجار':'#818cf8','كهرباء':'#22d3ee','صيانة':'#fb923c','أخرى':'#6B8CAE',
  'مبيعات كروت':'#00E676','اشتراك شهري':'#00D4FF','إيراد آخر':'#4ade80',
  'أساسي':'#0088CC','مميز':'#7c3aed','مجاني':'#6B8CAE',
  'نشط':'#00E676','منتهي':'#FF4444','قريب من الانتهاء':'#fb923c',
}

function AccountsTab({ sa }: { sa: SA }) {
  const STORAGE_KEY = `hotspot_sheets_${sa.id}`
  const [sheets, setSheets] = useState<Sheet[]>(DEFAULT_SHEETS)
  const [sheetsLoaded, setSheetsLoaded] = useState(false)

  // تحميل البيانات من السيرفر عند الفتح
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/superadmin/sheets?key=${STORAGE_KEY}`)
        const d   = await res.json()
        if (d.data) setSheets(JSON.parse(d.data))
      } catch {
        // fallback للـ localStorage
        try { const s = localStorage.getItem(STORAGE_KEY); if (s) setSheets(JSON.parse(s)) } catch {}
      } finally { setSheetsLoaded(true) }
    }
    load()
  }, [STORAGE_KEY])
  const [activeSheet, setActiveSheet] = useState(0)
  const [editingCell, setEditingCell] = useState<{row:number;col:string}|null>(null)
  const [cellValue, setCellValue] = useState('')
  const [showAddCol, setShowAddCol] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [newCol, setNewCol] = useState<SheetColumn>({ id: '', label: '', type: 'text', width: 120 })
  const [newSheetName, setNewSheetName] = useState('')
  const [newSheetIcon, setNewSheetIcon] = useState('📋')
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<string|null>(null)
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  const save = (updated: Sheet[]) => {
    setSheets(updated)
    // حفظ على السيرفر (و localStorage كـ fallback)
    const payload = JSON.stringify(updated)
    try { localStorage.setItem(STORAGE_KEY, payload) } catch {}
    fetch('/api/superadmin/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: STORAGE_KEY, data: payload }),
    }).catch(() => {})
  }

  const sheet = sheets[activeSheet]
  if (!sheet) return null

  // فلترة وترتيب
  let rows = [...sheet.rows]
  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter(r => Object.values(r).some(v => String(v||'').toLowerCase().includes(q)))
  }
  if (sortCol) {
    rows.sort((a, b) => {
      const av = a[sortCol] ?? ''; const bv = b[sortCol] ?? ''
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }

  // إجمالي الأعمدة currency
  const totals: Record<string, number> = {}
  sheet.columns.filter(c => c.type === 'currency' || c.type === 'number').forEach(c => {
    totals[c.id] = sheet.rows.reduce((s, r) => s + (parseFloat(r[c.id]) || 0), 0)
  })

  const addRow = () => {
    const newRow: SheetRow = {}
    sheet.columns.forEach(c => { newRow[c.id] = c.type === 'date' ? new Date().toISOString().split('T')[0] : '' })
    const updated = sheets.map((s, i) => i === activeSheet ? { ...s, rows: [...s.rows, newRow] } : s)
    save(updated)
  }

  const updateCell = (rowIdx: number, colId: string, value: string) => {
    const updated = sheets.map((s, si) => si !== activeSheet ? s : {
      ...s,
      rows: s.rows.map((r, ri) => ri === rowIdx ? { ...r, [colId]: value } : r)
    })
    save(updated)
  }

  const deleteRows = (indices: number[]) => {
    const updated = sheets.map((s, i) => i !== activeSheet ? s : {
      ...s, rows: s.rows.filter((_, ri) => !indices.includes(ri))
    })
    save(updated)
    setSelectedRows(new Set())
  }

  const addColumn = () => {
    if (!newCol.label.trim()) return
    const id = newCol.id || newCol.label.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now()
    const col: SheetColumn = { ...newCol, id }
    const updated = sheets.map((s, i) => i !== activeSheet ? s : {
      ...s,
      columns: [...s.columns, col],
      rows: s.rows.map(r => ({ ...r, [col.id]: '' }))
    })
    save(updated)
    setNewCol({ id: '', label: '', type: 'text', width: 120 })
    setShowAddCol(false)
  }

  const addSheet = () => {
    if (!newSheetName.trim()) return
    const newSheet: Sheet = {
      id: Date.now().toString(), name: newSheetName, icon: newSheetIcon,
      columns: [
        { id: 'date', label: 'التاريخ', type: 'date', width: 120 },
        { id: 'desc', label: 'البيان',  type: 'text', width: 200 },
        { id: 'amount', label: 'المبلغ', type: 'currency', width: 100 },
      ],
      rows: [],
    }
    const updated = [...sheets, newSheet]
    save(updated)
    setActiveSheet(updated.length - 1)
    setNewSheetName('')
    setShowAddSheet(false)
  }

  const deleteSheet = (idx: number) => {
    if (sheets.length <= 1) return
    const updated = sheets.filter((_, i) => i !== idx)
    save(updated)
    setActiveSheet(Math.max(0, idx - 1))
  }

  const exportCSV = () => {
    const headers = sheet.columns.map(c => c.label).join(',')
    const rowsCSV = sheet.rows.map(r => sheet.columns.map(c => `"${String(r[c.id]||'').replace(/"/g,'""')}"`).join(','))
    const csv = '\uFEFF' + [headers, ...rowsCSV].join('\n')
    const b = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(b)
    a.download = `${sheet.name}.csv`; a.click()
  }

  const ICONS = ['📋','💸','💰','📅','📊','🏦','💳','📈','📉','🗂️','📝','🏪']
  const COL_TYPES = [{v:'text',l:'نص'},{v:'number',l:'رقم'},{v:'currency',l:'مبلغ (ج)'},{v:'date',l:'تاريخ'},{v:'badge',l:'تصنيف'}]

  const renderCell = (value: any, col: SheetColumn, rowIdx: number, isEditing: boolean) => {
    if (isEditing) return (
      <input
        autoFocus
        value={cellValue}
        onChange={e => setCellValue(e.target.value)}
        onBlur={() => { updateCell(rowIdx, col.id, cellValue); setEditingCell(null) }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') { updateCell(rowIdx, col.id, cellValue); setEditingCell(null) } if (e.key === 'Escape') setEditingCell(null) }}
        style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#E2F0FB', fontFamily: 'Cairo,sans-serif', fontSize: 12, padding: 0 }}
      />
    )
    const v = value ?? ''
    if (col.type === 'badge' && v) return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${BADGE_COLORS[v] || '#6B8CAE'}18`, border: `1px solid ${BADGE_COLORS[v] || '#6B8CAE'}40`, color: BADGE_COLORS[v] || '#6B8CAE', whiteSpace: 'nowrap' }}>{v}</span>
    if (col.type === 'currency' && v) return <span style={{ color: '#00E676', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{parseFloat(v).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج</span>
    if (col.type === 'number'   && v) return <span style={{ color: '#00D4FF', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    if (col.type === 'date'     && v) return <span style={{ color: '#818cf8', fontSize: 11 }}>{v}</span>
    return <span style={{ color: v ? '#E2F0FB' : '#354E6A' }}>{v || '—'}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: 'calc(100vh - 80px)', overflow: 'hidden' }}>

      {/* Sheet Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px 0 0', background: '#070B12', borderBottom: '1px solid #1C2A40', overflowX: 'auto', flexShrink: 0 }}>
        {sheets.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
            <button onClick={() => setActiveSheet(i)} style={{ padding: '10px 16px', background: activeSheet === i ? '#0C1420' : 'transparent', border: 'none', borderTop: activeSheet === i ? '2px solid #00D4FF' : '2px solid transparent', color: activeSheet === i ? '#00D4FF' : '#6B8CAE', fontFamily: 'Cairo,sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
              {s.icon} {s.name}
            </button>
            {activeSheet === i && sheets.length > 1 && (
              <button onClick={() => deleteSheet(i)} style={{ background: 'none', border: 'none', color: '#354E6A', cursor: 'pointer', fontSize: 11, padding: '0 4px 0 0' }} title="حذف الشيت">✕</button>
            )}
          </div>
        ))}
        <button onClick={() => setShowAddSheet(s => !s)} style={{ padding: '8px 14px', background: 'none', border: 'none', color: '#0088CC', cursor: 'pointer', fontSize: 18, flexShrink: 0 }}>+</button>
      </div>

      {/* Add Sheet Form */}
      {showAddSheet && (
        <div style={{ background: '#0C1420', borderBottom: '1px solid #1C2A40', padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4 }}>{ICONS.map(ic => <button key={ic} onClick={() => setNewSheetIcon(ic)} style={{ fontSize: 18, background: newSheetIcon === ic ? 'rgba(0,212,255,0.15)' : 'transparent', border: newSheetIcon === ic ? '1px solid #00D4FF' : '1px solid transparent', borderRadius: 6, cursor: 'pointer', padding: '2px 4px' }}>{ic}</button>)}</div>
          <input value={newSheetName} onChange={e => setNewSheetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSheet()} placeholder="اسم الشيت الجديد" style={{ ...S.input, width: 180, padding: '7px 10px', fontSize: 12 }} autoFocus />
          <button onClick={addSheet} style={S.btn()}>+ إضافة</button>
          <button onClick={() => setShowAddSheet(false)} style={{ ...S.btn('#1C2A40', '#6B8CAE') }}>إلغاء</button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#0C1420', borderBottom: '1px solid #1C2A40', flexWrap: 'wrap', flexShrink: 0 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث..." style={{ ...S.input, width: 160, padding: '6px 10px', fontSize: 12 }} />
        <button onClick={addRow} style={{ ...S.btn('linear-gradient(135deg,#0088CC,#00D4FF)'), padding: '7px 14px', fontSize: 12 }}>+ صف</button>
        <button onClick={() => setShowAddCol(c => !c)} style={{ ...S.btn('#111B2D', '#6B8CAE'), border: '1px solid #1C2A40', padding: '7px 12px', fontSize: 12 }}>+ عمود</button>
        {selectedRows.size > 0 && (
          <button onClick={() => deleteRows(Array.from(selectedRows))} style={{ ...S.btn('rgba(255,68,68,0.1)', '#FF4444'), border: '1px solid rgba(255,68,68,0.3)', padding: '7px 12px', fontSize: 12 }}>🗑️ حذف ({selectedRows.size})</button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={exportCSV} style={{ ...S.btn('#111B2D', '#6B8CAE'), border: '1px solid #1C2A40', padding: '7px 12px', fontSize: 11 }}>📊 تصدير CSV</button>
        {Object.keys(totals).length > 0 && (
          <div style={{ display: 'flex', gap: 12, padding: '4px 10px', background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 8 }}>
            {sheet.columns.filter(c => totals[c.id] !== undefined).map(c => (
              <span key={c.id} style={{ fontSize: 11, color: '#00E676' }}>
                {c.label}: <strong>{totals[c.id].toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {c.type === 'currency' ? 'ج' : ''}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Add Column Form */}
      {showAddCol && (
        <div style={{ background: '#070B12', borderBottom: '1px solid #1C2A40', padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
          <div><div style={S.label}>اسم العمود</div><input value={newCol.label} onChange={e => setNewCol({ ...newCol, label: e.target.value })} style={{ ...S.input, width: 150, padding: '7px 10px', fontSize: 12 }} placeholder="مثال: ملاحظة" autoFocus /></div>
          <div><div style={S.label}>النوع</div><select value={newCol.type} onChange={e => setNewCol({ ...newCol, type: e.target.value as any })} style={{ ...S.input, width: 120, padding: '7px 10px', fontSize: 12 }}>{COL_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select></div>
          <button onClick={addColumn} style={S.btn()}>+ إضافة</button>
          <button onClick={() => setShowAddCol(false)} style={{ ...S.btn('#1C2A40', '#6B8CAE') }}>إلغاء</button>
        </div>
      )}

      {/* Spreadsheet */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {sheet.rows.length === 0 && !search ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B8CAE' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{sheet.icon}</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>لا يوجد بيانات بعد</div>
            <div style={{ fontSize: 12 }}>اضغط «+ صف» عشان تضيف بيانات</div>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%', fontSize: 12, fontFamily: 'Cairo,sans-serif', direction: 'rtl' }}>
            <thead>
              <tr style={{ background: '#070B12', borderBottom: '2px solid #1C2A40', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ width: 36, padding: '8px 6px', border: '1px solid #0C1420' }}>
                  <input type="checkbox" onChange={e => setSelectedRows(e.target.checked ? new Set(rows.map((_, i) => i)) : new Set())} checked={selectedRows.size === rows.length && rows.length > 0} style={{ cursor: 'pointer' }} />
                </th>
                {sheet.columns.map(col => (
                  <th key={col.id} onClick={() => { if (sortCol === col.id) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col.id); setSortDir('asc') } }}
                    style={{ width: col.width || 120, minWidth: col.width || 120, padding: '8px 10px', border: '1px solid #0C1420', color: '#6B8CAE', fontWeight: 700, textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                    {col.label} {sortCol === col.id ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
                <th style={{ width: 40, padding: '8px 6px', border: '1px solid #0C1420' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx} style={{ background: selectedRows.has(rowIdx) ? 'rgba(0,136,204,0.08)' : rowIdx % 2 === 0 ? '#0C1420' : '#070B12', borderBottom: '1px solid #0C1420' }}
                  onDoubleClick={() => {}}>
                  <td style={{ padding: '6px', border: '1px solid #0C1420', textAlign: 'center' }}>
                    <input type="checkbox" checked={selectedRows.has(rowIdx)} onChange={e => { const n = new Set(selectedRows); e.target.checked ? n.add(rowIdx) : n.delete(rowIdx); setSelectedRows(n) }} style={{ cursor: 'pointer' }} />
                  </td>
                  {sheet.columns.map(col => (
                    <td key={col.id}
                      onClick={() => { setEditingCell({ row: rowIdx, col: col.id }); setCellValue(row[col.id] ?? '') }}
                      style={{ padding: '6px 10px', border: '1px solid #0C1420', cursor: 'cell', minWidth: col.width || 120, maxWidth: (col.width || 120) + 80, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {renderCell(row[col.id], col, rowIdx, editingCell?.row === rowIdx && editingCell?.col === col.id)}
                    </td>
                  ))}
                  <td style={{ padding: '4px 6px', border: '1px solid #0C1420', textAlign: 'center' }}>
                    <button onClick={() => deleteRows([rowIdx])} style={{ background: 'none', border: 'none', color: '#354E6A', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }} title="حذف">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {Object.keys(totals).length > 0 && (
              <tfoot>
                <tr style={{ background: '#0C1420', borderTop: '2px solid #1C2A40' }}>
                  <td style={{ padding: '7px 6px', border: '1px solid #1C2A40', color: '#6B8CAE', fontSize: 11, textAlign: 'center', fontWeight: 700 }}>Σ</td>
                  {sheet.columns.map(col => (
                    <td key={col.id} style={{ padding: '7px 10px', border: '1px solid #1C2A40' }}>
                      {totals[col.id] !== undefined ? (
                        <span style={{ color: '#00E676', fontWeight: 900, fontSize: 13 }}>
                          {totals[col.id].toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {col.type === 'currency' ? 'ج' : ''}
                        </span>
                      ) : null}
                    </td>
                  ))}
                  <td style={{ border: '1px solid #1C2A40' }} />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      <div style={{ padding: '6px 14px', background: '#0C1420', borderTop: '1px solid #1C2A40', fontSize: 11, color: '#354E6A', display: 'flex', gap: 16, flexShrink: 0 }}>
        <span>{sheet.rows.length} صف</span>
        <span>{sheet.columns.length} عمود</span>
        {search && <span style={{ color: '#fb923c' }}>نتائج البحث: {rows.length}</span>}
        <span style={{ color: '#354E6A', fontSize: 10, marginRight: 'auto' }}>💾 البيانات محفوظة محلياً في المتصفح</span>
      </div>
    </div>
  )
}

// ─── Import CSV Tab ──────────────────────────────────────────────────────────
function ImportTab({ sa }: { sa: SA }) {
  const [admins,  setAdmins]  = useState<Admin[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [selAdmin, setSelAdmin] = useState('')
  const [selDev,   setSelDev]   = useState('')
  const [csvText,  setCsvText]  = useState('')
  const [fileName, setFileName] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<any>(null)

  // default package settings
  const [pkg,      setPkg]      = useState('BOTH')
  const [dataLimitMB,   setDataLimitMB]   = useState('1024')
  const [timeLimitMin,  setTimeLimitMin]  = useState('120')
  const [validityDays,  setValidityDays]  = useState('')

  useEffect(() => {
    fetch('/api/superadmin/admins').then(r => r.json()).then(d => { if (Array.isArray(d)) setAdmins(d) })
  }, [])

  useEffect(() => {
    if (!selAdmin) { setDevices([]); setSelDev(''); return }
    fetch(`/api/admin/devices?adminId=${selAdmin}`).then(r => r.json()).then(d => { if (Array.isArray(d)) setDevices(d) })
  }, [selAdmin])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => setCsvText(ev.target?.result as string || '')
    reader.readAsText(file, 'UTF-8')
  }

  // معاينة الأكواد من الـ CSV
  const previewCodes = (() => {
    if (!csvText.trim()) return []
    const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\'"]/g, ''))
    const codeIdx = headers.indexOf('code') !== -1 ? headers.indexOf('code') : 0
    return lines.slice(1, 6).map(l => {
      const vals = l.split(',')
      return (vals[codeIdx] || '').trim().replace(/^["']|["']$/g, '')
    }).filter(Boolean)
  })()

  const totalCodes = (() => {
    if (!csvText.trim()) return 0
    return csvText.trim().split(/\r?\n/).filter(l => l.trim()).length - 1
  })()

  const doImport = async () => {
    if (!selAdmin) { setResult({ error: 'اختار الأدمن أولاً' }); return }
    if (!selDev)   { setResult({ error: 'اختار الجهاز أولاً' }); return }
    if (!csvText.trim()) { setResult({ error: 'ارفع ملف CSV أو الصق الأكواد' }); return }
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/superadmin/import-vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotspotAdminId: selAdmin,
          deviceId:       selDev,
          csvText,
          packageType:   pkg,
          dataLimitMB:   pkg !== 'TIME_ONLY'  ? parseInt(dataLimitMB)  || null : null,
          timeLimitMin:  pkg !== 'DATA_ONLY'  ? parseInt(timeLimitMin) || null : null,
          validityDays:  validityDays ? parseInt(validityDays) : null,
        }),
      })
      const d = await res.json()
      setResult(d)
    } catch (e: any) {
      setResult({ error: e.message })
    }
    setLoading(false)
  }

  const isOk = result?.success

  return (
    <div>
      <div style={{ ...S.card, marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#E2F0FB', marginBottom: 4 }}>📥 استيراد كروت من CSV</h3>
        <p style={{ fontSize: 12, color: '#6B8CAE', marginBottom: 14, lineHeight: 1.8 }}>
          ارفع ملف CSV يحتوي على الأكواد — عمود واحد اسمه <code style={{ color: '#00D4FF', background: '#070B12', padding: '1px 5px', borderRadius: 4 }}>code</code> أو أعمدة متعددة.
        </p>

        {/* اختيار أدمن + جهاز */}
        <div className="form-grid-2" style={{ marginBottom: 14 }}>
          <div>
            <label style={S.label}>👤 الأدمن</label>
            <select style={S.input} value={selAdmin} onChange={e => { setSelAdmin(e.target.value); setSelDev('') }}>
              <option value="">اختر أدمن...</option>
              {admins.map(a => <option key={a.id} value={a.id}>{a.name} (@{a.username})</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>🖥️ الجهاز</label>
            <select style={{ ...S.input, opacity: !selAdmin ? 0.4 : 1 }} value={selDev} onChange={e => setSelDev(e.target.value)} disabled={!selAdmin}>
              <option value="">— اختر الجهاز —</option>
              {devices.map((d: any) => <option key={d.id} value={d.id}>{d.name} · {d.gatewayId}</option>)}
            </select>
          </div>
        </div>

        {/* إعدادات الباقة الافتراضية */}
        <div style={{ background: '#070B12', border: '1px solid #1C2A40', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#6B8CAE', marginBottom: 10, fontWeight: 700 }}>⚙️ إعدادات الباقة الافتراضية (لو الـ CSV ما فيهوش أعمدة تفصيلية)</div>
          <div className="form-grid-2">
            <div>
              <label style={S.label}>نوع الباقة</label>
              <select style={S.input} value={pkg} onChange={e => setPkg(e.target.value)}>
                <option value="BOTH">داتا + وقت</option>
                <option value="DATA_ONLY">داتا فقط</option>
                <option value="TIME_ONLY">وقت فقط</option>
                <option value="UNLIMITED">♾️ بلا حد</option>
              </select>
            </div>
            {pkg !== 'TIME_ONLY' && pkg !== 'UNLIMITED' && (
              <div><label style={S.label}>داتا (MB)</label><input style={S.input} type="number" value={dataLimitMB} onChange={e => setDataLimitMB(e.target.value)} /></div>
            )}
            {pkg !== 'DATA_ONLY' && pkg !== 'UNLIMITED' && (
              <div><label style={S.label}>وقت (دقيقة)</label><input style={S.input} type="number" value={timeLimitMin} onChange={e => setTimeLimitMin(e.target.value)} /></div>
            )}
            <div><label style={S.label}>صلاحية (أيام)</label><input style={S.input} type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} placeholder="فارغ = بلا انتهاء" /></div>
          </div>
        </div>

        {/* رفع الملف */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ ...S.label, marginBottom: 8 }}>📎 ملف CSV</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#070B12', border: '2px dashed #1C2A40', borderRadius: 10, cursor: 'pointer', color: '#6B8CAE', fontSize: 13 }}>
            <span style={{ fontSize: 24 }}>📂</span>
            <span>{fileName || 'اضغط لرفع ملف CSV...'}</span>
            <input type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: 'none' }} />
          </label>
        </div>

        {/* أو الصق نصي */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ ...S.label, marginBottom: 6 }}>أو الصق محتوى الـ CSV مباشرة:</label>
          <textarea
            value={csvText}
            onChange={e => { setCsvText(e.target.value); setFileName('') }}
            placeholder={`code\nABC123\nXYZ789\nDEF456\n...`}
            dir="ltr"
            rows={6}
            style={{ ...S.input, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
          />
        </div>

        {/* معاينة */}
        {totalCodes > 0 && (
          <div style={{ background: '#070B12', border: '1px solid #1C2A40', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#6B8CAE', marginBottom: 6 }}>👁️ معاينة — إجمالي <strong style={{ color: '#00D4FF' }}>{totalCodes} كود</strong></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {previewCodes.map((c, i) => (
                <span key={i} style={{ padding: '2px 8px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 6, color: '#00D4FF', fontFamily: 'monospace', fontSize: 11 }}>{c}</span>
              ))}
              {totalCodes > 5 && <span style={{ color: '#354E6A', fontSize: 11, alignSelf: 'center' }}>... و {totalCodes - 5} أكثر</span>}
            </div>
          </div>
        )}

        {/* نتيجة */}
        {result && (
          <div style={{ ...S.msg(isOk), marginBottom: 14 }}>
            <span>{isOk ? result.message : ('❌ ' + result.error)}</span>
            {isOk && result.duplicateCount > 0 && (
              <span style={{ fontSize: 11, color: '#fb923c', marginRight: 8 }}>⚠️ {result.duplicateCount} مكرر تم تخطيه</span>
            )}
            <span onClick={() => setResult(null)} style={{ cursor: 'pointer', opacity: 0.6 }}>✕</span>
          </div>
        )}

        <button
          onClick={doImport}
          disabled={loading || !selAdmin || !selDev || !csvText.trim()}
          style={{ ...S.btn(), padding: '11px 24px', opacity: loading || !selAdmin || !selDev || !csvText.trim() ? 0.5 : 1 }}
        >
          {loading ? '⏳ جاري الاستيراد...' : `📥 استيراد ${totalCodes > 0 ? totalCodes + ' كود' : ''}`}
        </button>
      </div>

      {/* تعليمات صيغة الملف */}
      <div style={{ ...S.card, fontSize: 12, color: '#6B8CAE', lineHeight: 2 }}>
        <div style={{ fontWeight: 700, color: '#E2F0FB', marginBottom: 8 }}>📋 صيغة ملف الـ CSV</div>
        <div style={{ marginBottom: 8 }}><strong style={{ color: '#00D4FF' }}>أبسط صيغة (عمود واحد):</strong></div>
        <pre style={{ background: '#070B12', border: '1px solid #1C2A40', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#00E676', fontFamily: 'monospace', overflowX: 'auto', margin: '0 0 12px' }}>{`code
ABC123
XYZ789
DEF456`}</pre>
        <div style={{ marginBottom: 8 }}><strong style={{ color: '#00D4FF' }}>صيغة متقدمة (مع إعدادات لكل كارت):</strong></div>
        <pre style={{ background: '#070B12', border: '1px solid #1C2A40', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#00E676', fontFamily: 'monospace', overflowX: 'auto', margin: 0 }}>{`code,dataLimitMB,timeLimitMin,packageType
ABC123,1024,120,BOTH
XYZ789,512,60,DATA_ONLY
DEF456,,180,TIME_ONLY`}</pre>
        <div style={{ marginTop: 10, fontSize: 11 }}>• الأكواد المكررة بتتخطى تلقائياً بدون error<br/>• الكود الأدنى 4 حروف<br/>• UTF-8 encoding</div>
      </div>
    </div>
  )
}

// ─── Plans & Registrations Tab ──────────────────────────────────────────────
const PLAN_PRESETS = [
  { id:'free',       name:'🚀 مجاني',    color:'#6B8CAE', maxDevices:50, maxVouchersTotal:1000000, canCreateUnlimited:false, canCreateNFC:false, canCreateQR:false, canRenewVouchers:false },
  { id:'basic',     name:'⚡ أساسي',    color:'#00D4FF', maxDevices:50, maxVouchersTotal:1000000, canCreateUnlimited:false, canCreateNFC:false, canCreateQR:true,  canRenewVouchers:true  },
  { id:'pro',       name:'👑 احترافي',  color:'#7c3aed', maxDevices:50, maxVouchersTotal:1000000, canCreateUnlimited:true,  canCreateNFC:true,  canCreateQR:true,  canRenewVouchers:true  },
  { id:'enterprise',name:'🏢 مؤسسي',   color:'#f59e0b', maxDevices:50, maxVouchersTotal:1000000, canCreateUnlimited:true,  canCreateNFC:true,  canCreateQR:true,  canRenewVouchers:true  },
]

// ═══════════════════════════════════════════
// تاب طلبات الباقات — السوبر أدمن يوافق أو يرفض
// ═══════════════════════════════════════════
function PlanRequestsTab() {
  const [requests, setRequests]   = useState<any[]>([])
  const [filter, setFilter]       = useState<'PENDING'|'APPROVED'|'REJECTED'|'ALL'>('PENDING')
  const [loading, setLoading]     = useState(true)
  const [msg, setMsg]             = useState('')
  const [rejectModal, setRejectModal] = useState<{id:string,name:string}|null>(null)
  const [rejectNote, setRejectNote]   = useState('')
  const [acting, setActing]       = useState<string|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/superadmin/plan-requests?status=${filter}`)
      const d   = await res.json()
      if (Array.isArray(d)) setRequests(d)
    } catch {}
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const doAction = async (requestId: string, action: 'approve'|'reject', planName: string) => {
    if (action === 'reject' && !rejectNote.trim()) {
      setRejectModal({ id: requestId, name: planName }); return
    }
    setActing(requestId)
    try {
      const res = await fetch('/api/superadmin/plan-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, rejectNote: action==='reject'?rejectNote:undefined }),
      })
      const d = await res.json()
      if (d.success) {
        setMsg(action==='approve'?'✅ تمت الموافقة وتفعيل الباقة!':'❌ تم رفض الطلب')
        setRejectModal(null); setRejectNote('')
        load()
      } else { setMsg('❌ ' + (d.error||'خطأ')) }
    } catch { setMsg('❌ خطأ في الاتصال') }
    setActing(null)
  }

  const confirmReject = async () => {
    if (!rejectModal) return
    await doAction(rejectModal.id, 'reject', rejectModal.name)
  }

  const pendingCount = requests.filter(r => r.status==='PENDING').length

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        {(['PENDING','APPROVED','REJECTED','ALL'] as const).map(f => (
          <button key={f} onClick={()=>setFilter(f)} style={{...S.btn(filter===f?'#0088CC':'#111B2D',filter===f?'#000':'#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'6px 12px'}}>
            {f==='ALL'?'📋 الكل':f==='PENDING'?`⏳ بانتظار${pendingCount>0?` (${pendingCount})`:''}`:f==='APPROVED'?'✅ موافق عليها':'❌ مرفوضة'}
          </button>
        ))}
        <button onClick={load} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,marginRight:'auto'}}>🔄</button>
      </div>

      {msg && <div style={S.msg(msg.startsWith('✅'))}>{msg}<span onClick={()=>setMsg('')} style={{cursor:'pointer'}}>✕</span></div>}

      {loading ? (
        <div style={{textAlign:'center',padding:40,color:'#6B8CAE'}}>⏳ جاري التحميل...</div>
      ) : requests.length === 0 ? (
        <div style={{...S.card,textAlign:'center',padding:40,color:'#354E6A'}}>
          <div style={{fontSize:40,marginBottom:10}}>📨</div>
          <div>{filter==='PENDING'?'لا يوجد طلبات معلقة':'لا يوجد طلبات'}</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {requests.map(r => {
            const isPending = r.status === 'PENDING'
            const borderClr = r.status==='APPROVED'?'rgba(0,230,118,0.3)':r.status==='REJECTED'?'rgba(255,68,68,0.2)':'rgba(251,146,60,0.3)'
            return (
              <div key={r.id} style={{...S.card, border:`1px solid ${borderClr}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
                  {/* بيانات الطلب */}
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
                      <div style={{fontSize:13,fontWeight:900,color:'#E2F0FB'}}>💎 باقة: {r.planName}</div>
                      <span style={{padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700,
                        background:r.status==='APPROVED'?'rgba(0,230,118,0.12)':r.status==='REJECTED'?'rgba(255,68,68,0.12)':'rgba(251,146,60,0.12)',
                        color:r.status==='APPROVED'?'#00E676':r.status==='REJECTED'?'#FF4444':'#fb923c',
                        border:`1px solid ${r.status==='APPROVED'?'rgba(0,230,118,0.3)':r.status==='REJECTED'?'rgba(255,68,68,0.3)':'rgba(251,146,60,0.3)'}`
                      }}>{r.status==='APPROVED'?'✅ موافق':r.status==='REJECTED'?'❌ مرفوض':'⏳ منتظر'}</span>
                    </div>
                    {/* بيانات الأدمن */}
                    <div style={{fontSize:11,color:'#6B8CAE',marginBottom:4}}>
                      👤 <strong style={{color:'#00D4FF'}}>{r.hotspotAdmin?.name}</strong> · @{r.hotspotAdmin?.username} · {r.hotspotAdmin?.email}
                      <span style={{marginRight:6,fontSize:10,color:'#354E6A'}}>[باقته الحالية: {r.hotspotAdmin?.planName||'مجاني'}]</span>
                    </div>
                    <div style={{fontSize:10,color:'#354E6A',marginBottom:6}}>
                      📌 {new Date(r.createdAt).toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                      {r.reviewedAt && <span style={{marginRight:6}}> · راجع {new Date(r.reviewedAt).toLocaleDateString('ar-EG')}</span>}
                    </div>
                    {r.note && (
                      <div style={{background:'rgba(0,212,255,0.05)',border:'1px solid rgba(0,212,255,0.1)',borderRadius:8,padding:'8px 10px',marginBottom:6,fontSize:11,color:'#6B8CAE'}}>
                        📝 ملاحظة: {r.note}
                      </div>
                    )}
                    {r.receiptText && (
                      <div style={{background:'rgba(251,146,60,0.05)',border:'1px solid rgba(251,146,60,0.2)',borderRadius:8,padding:'8px 10px',marginBottom:6,fontSize:11,color:'#fb923c',whiteSpace:'pre-wrap',wordBreak:'break-all'}}>
                        💳 بيانات الحوالة:
                        <div style={{color:'#E2F0FB',marginTop:4,fontFamily:'monospace'}}>{r.receiptText}</div>
                      </div>
                    )}
                    {r.status==='REJECTED' && r.reviewNote && (
                      <div style={{fontSize:11,color:'#FF4444',marginTop:4}}>⚠️ سبب الرفض: {r.reviewNote}</div>
                    )}
                  </div>
                  {/* أزرار الموافقة/الرفض */}
                  {isPending && (
                    <div style={{display:'flex',gap:6,flexShrink:0,flexWrap:'wrap'}}>
                      <button onClick={()=>doAction(r.id,'approve',r.planName)} disabled={acting===r.id}
                        style={{...S.btn('rgba(0,230,118,0.12)','#00E676'),border:'1px solid rgba(0,230,118,0.3)',padding:'8px 14px',fontSize:12,opacity:acting===r.id?0.6:1}}>
                        {acting===r.id?'⏳':'✅ موافقة'}
                      </button>
                      <button onClick={()=>setRejectModal({id:r.id,name:r.planName})} disabled={acting===r.id}
                        style={{...S.btn('rgba(255,68,68,0.08)','#FF4444'),border:'1px solid rgba(255,68,68,0.2)',padding:'8px 14px',fontSize:12,opacity:acting===r.id?0.6:1}}>
                        ❌ رفض
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal سبب الرفض */}
      {rejectModal && (
        <div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setRejectModal(null)}>
          <div style={{...S.card,width:'100%',maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:15,fontWeight:700,color:'#FF4444',marginBottom:12}}>❌ رفض طلب باقة: {rejectModal.name}</h3>
            <div style={{marginBottom:14}}>
              <label style={S.label}>سبب الرفض (سيظهر للأدمن)</label>
              <textarea value={rejectNote} onChange={e=>setRejectNote(e.target.value)} rows={3}
                placeholder="مثال: بيانات الدفع غير مكتملة..."
                style={{...S.input,resize:'vertical',fontFamily:'Cairo,sans-serif',fontSize:13}}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={confirmReject} disabled={acting!==null}
                style={{...S.btn('rgba(255,68,68,0.15)','#FF4444'),border:'1px solid rgba(255,68,68,0.3)',flex:2,padding:'11px',opacity:acting?0.7:1}}>
                {acting?'⏳ جاري...':'❌ تأكيد الرفض'}
              </button>
              <button onClick={()=>setRejectModal(null)} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',flex:1}}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlansTab() {
  const [admins,setAdmins]     = useState<any[]>([])
  const [filter,setFilter]     = useState<'all'|'pending'|'active'|'suspended'>('all')
  const [search,setSearch]     = useState('')
  const [loading,setLoading]   = useState(true)
  const [msg,setMsg]           = useState('')
  const [editing,setEditing]   = useState<any|null>(null)
  const [editData,setEditData] = useState<any>({})
  const [saving,setSaving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/superadmin/plans${filter!=='all'?`?status=${filter}`:''}`)
    const d   = await res.json()
    if (Array.isArray(d)) setAdmins(d)
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const filtered = admins.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return a.name?.toLowerCase().includes(q) || a.username?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q)
  })

  const openEdit = (a: any) => {
    setEditing(a)
    setEditData({
      maxDevices:         a.maxDevices,
      maxVouchersTotal:   a.maxVouchersTotal,
      canCreateUnlimited: a.canCreateUnlimited,
      canCreateNFC:       a.canCreateNFC,
      canCreateQR:        a.canCreateQR,
      canRenewVouchers:   a.canRenewVouchers,
      isActive:           a.isActive,
      planNote:           a.planNote || '',
      plan:               'custom',
    })
  }

  const applyPreset = (presetId: string) => {
    const p = PLAN_PRESETS.find(x => x.id === presetId)
    if (!p) return
    setEditData((d:any) => ({ ...d, ...p, plan: presetId, isActive: true }))
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/superadmin/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: editing.id, ...editData }),
      })
      const d = await res.json()
      if (d.success) { setMsg('✅ تم الحفظ'); load(); setEditing(null) }
      else setMsg('❌ ' + (d.error || 'خطأ'))
    } catch { setMsg('❌ خطأ في الاتصال') }
    setSaving(false)
  }

  const quickAction = async (adminId: string, action: 'approve'|'suspend'|'activate') => {
    const body: any = { adminId }
    if (action === 'approve')  { body.approve  = true }
    if (action === 'suspend')  { body.isActive = false }
    if (action === 'activate') { body.isActive = true; body.approve = true }
    await fetch('/api/superadmin/plans', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
    load()
  }

  const planColor = (name: string) => {
    if (name?.includes('احترافي') || name?.includes('pro')) return '#7c3aed'
    if (name?.includes('أساسي')   || name?.includes('basic')) return '#00D4FF'
    if (name?.includes('مؤسسي'))  return '#f59e0b'
    return '#6B8CAE'
  }

  const pendingCount = admins.filter(a => !a.isEmailVerified || !a.isActive).length

  return (
    <div>
      {/* Stats row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10,marginBottom:14}}>
        {[
          {icon:'👤',label:'الإجمالي',     val:admins.length,                                     color:'#818cf8'},
          {icon:'⏳',label:'بانتظار التفعيل',val:pendingCount,                                     color:'#fb923c'},
          {icon:'✅',label:'نشطين',        val:admins.filter(a=>a.isActive&&a.isEmailVerified).length, color:'#00E676'},
          {icon:'⛔',label:'موقوفين',      val:admins.filter(a=>!a.isActive).length,              color:'#FF4444'},
        ].map((s,i) => (
          <div key={i} style={{...S.card,textAlign:'center',padding:12,border:s.val>0&&i===1?'1px solid rgba(251,146,60,0.3)':S.card.border}}>
            <div style={{fontSize:22,marginBottom:3}}>{s.icon}</div>
            <div style={{fontSize:20,fontWeight:900,color:s.color}}>{s.val}</div>
            <div style={{fontSize:9,color:'#354E6A',marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {msg && <div style={S.msg(msg.startsWith('✅'))}>{msg}<span onClick={()=>setMsg('')} style={{cursor:'pointer'}}>✕</span></div>}

      {/* Filters + Search */}
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        {(['all','pending','active','suspended'] as const).map(f => (
          <button key={f} onClick={()=>setFilter(f)} style={{
            ...S.btn(filter===f?'#0088CC':'#111B2D', filter===f?'#000':'#6B8CAE'),
            border:'1px solid #1C2A40', fontSize:11, padding:'6px 12px'
          }}>
            {f==='all'?'📋 الكل':f==='pending'?`⏳ انتظار${pendingCount>0?` (${pendingCount})`:''}`:f==='active'?'✅ نشطين':'⛔ موقوفين'}
          </button>
        ))}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 بحث..." style={{...S.input,width:180,padding:'6px 10px',fontSize:12,flex:'1 1 160px'}}/>
        <button onClick={load} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11}}>🔄</button>
      </div>

      {/* Admin cards */}
      {loading ? <div style={{textAlign:'center',padding:40,color:'#6B8CAE'}}>⏳ جاري التحميل...</div> : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.length === 0 && <div style={{...S.card,textAlign:'center',padding:32,color:'#6B8CAE'}}>لا يوجد نتائج</div>}
          {filtered.map(a => {
            const pending   = !a.isEmailVerified || !a.isActive
            const planClr   = planColor(a.detectedPlan || a.planName || '')
            return (
              <div key={a.id} style={{...S.card, border: pending ? '1px solid rgba(251,146,60,0.3)' : '1px solid #1C2A40'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,flexWrap:'wrap'}}>
                  {/* Info */}
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <div style={{width:36,height:36,borderRadius:10,background:`${planClr}18`,border:`1px solid ${planClr}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                        {(a.detectedPlan||a.planName||'').includes('احترافي')?'👑':(a.detectedPlan||a.planName||'').includes('أساسي')?'⚡':(a.detectedPlan||a.planName||'').includes('مؤسسي')?'🏢':'🚀'}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:'#E2F0FB'}}>{a.name}</div>
                        <div style={{fontSize:10,color:'#6B8CAE'}}>@{a.username} · {a.email}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',fontSize:10}}>
                      <span style={S.tag(true, planClr)}>{a.detectedPlan || a.planName || 'مجاني'}</span>
                      <span style={S.tag(a.isActive, a.isActive?'#00E676':'#FF4444')}>{a.isActive?'✅ نشط':'⛔ موقوف'}</span>
                      <span style={S.tag(a.isEmailVerified, a.isEmailVerified?'#00D4FF':'#fb923c')}>{a.isEmailVerified?'📧 مؤكد':'⏳ إيميل غير مؤكد'}</span>
                      <span style={{color:'#354E6A',fontSize:9}}>{new Date(a.createdAt).toLocaleDateString('ar-EG')}</span>
                    </div>
                    {a.planNote && <div style={{marginTop:6,fontSize:11,color:'#fb923c',fontStyle:'italic'}}>📝 {a.planNote}</div>}
                  </div>
                  {/* Stats */}
                  <div style={{display:'flex',gap:12,alignItems:'center',flexShrink:0}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:14,fontWeight:900,color:'#00D4FF'}}>{a._count?.devices||0}/{a.maxDevices}</div>
                      <div style={{fontSize:9,color:'#354E6A'}}>أجهزة</div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:14,fontWeight:900,color:'#818cf8'}}>{a.totalVouchersGenerated}/{a.maxVouchersTotal}</div>
                      <div style={{fontSize:9,color:'#354E6A'}}>كروت</div>
                    </div>
                    {/* Actions */}
                    <div style={{display:'flex',gap:5}}>
                      {pending && (
                        <button onClick={()=>quickAction(a.id,'approve')} style={{...S.btn('rgba(0,230,118,0.12)','#00E676'),border:'1px solid rgba(0,230,118,0.3)',fontSize:11,padding:'6px 10px'}} title="موافقة وتفعيل">✅ تفعيل</button>
                      )}
                      {a.isActive && !pending && (
                        <button onClick={()=>quickAction(a.id,'suspend')} style={{...S.btn('rgba(255,68,68,0.08)','#FF4444'),border:'1px solid rgba(255,68,68,0.2)',fontSize:10,padding:'5px 8px'}} title="إيقاف">⛔</button>
                      )}
                      {!a.isActive && (
                        <button onClick={()=>quickAction(a.id,'activate')} style={{...S.btn('rgba(0,212,255,0.08)','#00D4FF'),border:'1px solid rgba(0,212,255,0.2)',fontSize:10,padding:'5px 8px'}} title="تفعيل">▶️</button>
                      )}
                      <button onClick={()=>openEdit(a)} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'6px 10px'}}>✏️ باقة</button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Plan Modal */}
      {editing && (
        <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setEditing(null)}>
          <div style={{...S.card,width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 style={{fontSize:15,fontWeight:700,color:'#E2F0FB'}}>✏️ تعديل باقة: {editing.name}</h3>
              <button onClick={()=>setEditing(null)} style={{background:'none',border:'none',color:'#6B8CAE',fontSize:18,cursor:'pointer'}}>✕</button>
            </div>

            {/* اختيار باقة جاهزة */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:'#6B8CAE',marginBottom:8,fontWeight:700}}>⚡ باقات جاهزة:</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                {PLAN_PRESETS.map(p => (
                  <button key={p.id} onClick={()=>applyPreset(p.id)} style={{padding:'10px 6px',borderRadius:10,cursor:'pointer',textAlign:'center',border:`2px solid ${editData.plan===p.id?p.color:'#1C2A40'}`,background:editData.plan===p.id?`${p.color}12`:'#070B12',transition:'all 0.15s',color:editData.plan===p.id?p.color:'#6B8CAE',fontSize:12,fontWeight:700,fontFamily:'Cairo,sans-serif'}}>
                    {p.name.split(' ')[0]}<br/><span style={{fontSize:9,opacity:0.7}}>{p.name.split(' ').slice(1).join(' ')}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* تعديل يدوي */}
            <div style={{background:'#070B12',border:'1px solid #1C2A40',borderRadius:10,padding:'12px 14px',marginBottom:14}}>
              <div style={{fontSize:11,color:'#6B8CAE',marginBottom:10,fontWeight:700}}>⚙️ تعديل يدوي:</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                <div><label style={S.label}>أقصى أجهزة</label><input style={S.input} type="number" min={1} value={editData.maxDevices} onChange={e=>setEditData((d:any)=>({...d,maxDevices:+e.target.value,plan:'custom'}))}/></div>
                <div><label style={S.label}>أقصى كروت</label><input style={S.input} type="number" min={1} value={editData.maxVouchersTotal} onChange={e=>setEditData((d:any)=>({...d,maxVouchersTotal:+e.target.value,plan:'custom'}))}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:10}}>
                {[
                  {k:'canCreateUnlimited',l:'♾️ Unlimited'},{k:'canCreateNFC',l:'📶 NFC'},{k:'canCreateQR',l:'📷 QR'},{k:'canRenewVouchers',l:'🔄 تجديد'}
                ].map(p => (
                  <div key={p.k} onClick={()=>setEditData((d:any)=>({...d,[p.k]:!d[p.k],plan:'custom'}))} style={{padding:'8px 4px',borderRadius:8,cursor:'pointer',textAlign:'center',border:`1px solid ${editData[p.k]?'#00D4FF':'#1C2A40'}`,background:editData[p.k]?'rgba(0,212,255,0.06)':'transparent'}}>
                    <div style={{fontSize:14,marginBottom:2}}>{p.l.split(' ')[0]}</div>
                    <div style={{fontSize:9,color:editData[p.k]?'#00D4FF':'#6B8CAE',fontWeight:700}}>{p.l.split(' ').slice(1).join(' ')}</div>
                    <div style={{fontSize:8,color:editData[p.k]?'#00E676':'#354E6A',marginTop:1}}>{editData[p.k]?'✓':'○'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* الحالة */}
            <div style={{marginBottom:14}}>
              <label style={S.label}>الحالة:</label>
              <div style={{display:'flex',gap:8}}>
                {[{v:true,l:'✅ نشط'},{v:false,l:'⛔ موقوف'}].map(o=>(
                  <button key={String(o.v)} onClick={()=>setEditData((d:any)=>({...d,isActive:o.v}))} style={{...S.btn(editData.isActive===o.v?(o.v?'#00E676':'#FF4444'):'#111B2D',editData.isActive===o.v?'#000':'#6B8CAE'),border:'1px solid #1C2A40',flex:1,fontSize:12}}>{o.l}</button>
                ))}
              </div>
            </div>

            {/* ملاحظة */}
            <div style={{marginBottom:16}}>
              <label style={S.label}>📝 ملاحظة داخلية:</label>
              <input style={S.input} value={editData.planNote} onChange={e=>setEditData((d:any)=>({...d,planNote:e.target.value}))} placeholder="مثال: دفع شهر نوفمبر"/>
            </div>

            <div style={{display:'flex',gap:8}}>
              <button onClick={saveEdit} disabled={saving} style={{...S.btn(),flex:2,padding:'11px',opacity:saving?0.7:1}}>{saving?'⏳ جاري الحفظ...':'💾 حفظ'}</button>
              <button onClick={()=>setEditing(null)} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',flex:1}}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════
// إدارة الباقات — السوبر أدمن يضيف / يعدل / يحذف الباقات
// ═════════════════════════════════════════════
const EMOJIS = ['🎯','⚡','👑','🏢','🚀','💫','🔥','⭐','💼','🌐','💡','📈']
const COLORS = ['#0088CC','#00D4FF','#7c3aed','#f59e0b','#00E676','#6B8CAE','#fb923c','#FF4444','#22d3ee','#818cf8']

function ManagePlansTab() {
  const [plans, setPlans]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]         = useState('')
  const [editing, setEditing] = useState<any|null>(null) // null = new, object = edit
  const [saving, setSaving]   = useState(false)
  const [delConfirm, setDelConfirm] = useState<string|null>(null)

  const EMPTY = { name:'', emoji:'🎯', color:'#0088CC', price:0, maxDevices:50, maxVouchersTotal:1000000,
                  canCreateUnlimited:false, canCreateNFC:false, canCreateQR:false, canRenewVouchers:true,
                  description:'', order:0, isActive:true }
  const [form, setForm] = useState<any>(EMPTY)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/superadmin/manage-plans')
    const d   = await res.json()
    if (Array.isArray(d)) setPlans(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openNew  = () => { setForm(EMPTY); setEditing('new') }
  const openEdit = (p: any) => { setForm({...p}); setEditing(p.id) }

  const save = async () => {
    if (!form.name.trim()) { setMsg('❌ الاسم مطلوب'); return }
    setSaving(true); setMsg('')
    try {
      const isNew = editing === 'new'
      const res = await fetch('/api/superadmin/manage-plans', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? form : { id: editing, ...form }),
      })
      const d = await res.json()
      if (d.success) { setMsg('✅ تم الحفظ'); load(); setEditing(null) }
      else setMsg('❌ ' + (d.error || 'خطأ'))
    } catch { setMsg('❌ خطأ في الاتصال') }
    setSaving(false)
  }

  const deletePlan = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/superadmin/manage-plans', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
      const d = await res.json()
      if (d.success) { setMsg('✅ تم الحذف'); load(); setDelConfirm(null) }
      else setMsg('❌ ' + (d.error||'خطأ'))
    } catch { setMsg('❌ خطأ') }
    setSaving(false)
  }

  const PERMS = [{k:'canCreateUnlimited',l:'♾️ Unlimited'},{k:'canCreateNFC',l:'📶 NFC'},{k:'canCreateQR',l:'📷 QR'},{k:'canRenewVouchers',l:'🔄 تجديد'}]

  return (
    <div>
      {/* حذف مودل */}
      {delConfirm && (
        <div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setDelConfirm(null)}>
          <div style={{...S.card,width:'100%',maxWidth:340}} onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:'center',fontSize:36,marginBottom:10}}>🗑️</div>
            <div style={{fontSize:14,fontWeight:700,color:'#FF4444',textAlign:'center',marginBottom:6}}>حذف الباقة؟</div>
            <div style={{fontSize:12,color:'#6B8CAE',textAlign:'center',marginBottom:16}}>لن يؤثر على الأدمنز الحاليين.</div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>deletePlan(delConfirm)} disabled={saving} style={{...S.btn('rgba(255,68,68,0.15)','#FF4444'),border:'1px solid rgba(255,68,68,0.3)',flex:1,padding:'11px',opacity:saving?0.7:1}}>✅ تأكيد</button>
              <button onClick={()=>setDelConfirm(null)} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',flex:1}}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <h3 style={{fontSize:14,fontWeight:700,color:'#E2F0FB'}}>⚙️ إدارة الباقات</h3>
        <div style={{display:'flex',gap:8}}>
          <button onClick={load} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11}}>🔄</button>
          <button onClick={openNew} style={S.btn()}>➕ باقة جديدة</button>
        </div>
      </div>

      {msg && <div style={{padding:'10px 14px',borderRadius:9,marginBottom:12,background:msg.startsWith('✅')?'rgba(0,230,118,0.08)':'rgba(255,68,68,0.08)',border:`1px solid ${msg.startsWith('✅')?'rgba(0,230,118,0.25)':'rgba(255,68,68,0.25)'}`,color:msg.startsWith('✅')?'#00E676':'#FF4444',fontSize:12}}>{msg}<span onClick={()=>setMsg('')} style={{cursor:'pointer',float:'left',opacity:0.6}}>✕</span></div>}

      {/* فورم إضافة / تعديل */}
      {editing !== null && (
        <div style={{...S.card,marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <h3 style={{fontSize:14,fontWeight:700,color:'#E2F0FB'}}>{editing==='new'?'➕ باقة جديدة':'✏️ تعديل الباقة'}</h3>
            <button onClick={()=>setEditing(null)} style={{background:'none',border:'none',color:'#6B8CAE',fontSize:18,cursor:'pointer'}}>✕</button>
          </div>

          {/* اسم + إيموجي + لون */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <div style={{gridColumn:'span 2'}}>
              <label style={S.label}>اسم الباقة</label>
              <input style={S.input} value={form.name} onChange={e=>setForm((f:any)=>({...f,name:e.target.value}))} placeholder="مثال: احترافي"/>
            </div>
            <div>
              <label style={S.label}>إيموجي</label>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {EMOJIS.map(e=>(<span key={e} onClick={()=>setForm((f:any)=>({...f,emoji:e}))} style={{fontSize:20,cursor:'pointer',padding:'4px 6px',borderRadius:8,background:form.emoji===e?'rgba(0,212,255,0.15)':'transparent',border:form.emoji===e?'1px solid #00D4FF':'1px solid transparent'}}>{e}</span>))}
              </div>
            </div>
            <div>
              <label style={S.label}>لون</label>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {COLORS.map(c=>(<div key={c} onClick={()=>setForm((f:any)=>({...f,color:c}))} style={{width:24,height:24,borderRadius:6,background:c,cursor:'pointer',border:form.color===c?'3px solid #fff':'3px solid transparent'}}/>))}
              </div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
            <div><label style={S.label}>💰 سعر (ج/شهر)</label><input style={S.input} type="number" min={0} value={form.price} onChange={e=>setForm((f:any)=>({...f,price:+e.target.value}))}/></div>
            <div><label style={S.label}>🖥️ أجهزة</label><input style={S.input} type="number" min={1} value={form.maxDevices} onChange={e=>setForm((f:any)=>({...f,maxDevices:+e.target.value}))}/></div>
            <div><label style={S.label}>🎫 كروت</label><input style={S.input} type="number" min={1} value={form.maxVouchersTotal} onChange={e=>setForm((f:any)=>({...f,maxVouchersTotal:+e.target.value}))}/></div>
          </div>

          <div style={{marginBottom:12}}>
            <label style={{...S.label,marginBottom:8}}>🔑 الصلاحيات</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
              {PERMS.map(p=>(
                <div key={p.k} onClick={()=>setForm((f:any)=>({...f,[p.k]:!f[p.k]}))} style={{padding:'8px 4px',borderRadius:8,cursor:'pointer',textAlign:'center',border:`1px solid ${form[p.k]?'#00D4FF':'#1C2A40'}`,background:form[p.k]?'rgba(0,212,255,0.06)':'transparent'}}>
                  <div style={{fontSize:14,marginBottom:2}}>{p.l.split(' ')[0]}</div>
                  <div style={{fontSize:9,color:form[p.k]?'#00D4FF':'#6B8CAE',fontWeight:700}}>{p.l.split(' ').slice(1).join(' ')}</div>
                  <div style={{fontSize:8,color:form[p.k]?'#00E676':'#354E6A',marginTop:1}}>{form[p.k]?'✓':'○'}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{marginBottom:12}}>
            <label style={S.label}>📝 وصف (يظهر للأدمنز)</label>
            <input style={S.input} value={form.description} onChange={e=>setForm((f:any)=>({...f,description:e.target.value}))} placeholder="وصف مختصر للباقة"/>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
            <div>
              <label style={S.label}>ترتيب العرض</label>
              <input style={S.input} type="number" min={0} value={form.order} onChange={e=>setForm((f:any)=>({...f,order:+e.target.value}))}/>
            </div>
            <div>
              <label style={S.label}>الحالة</label>
              <div style={{display:'flex',gap:6}}>
                {[{v:true,l:'✅ نشط'},{v:false,l:'⛔ مخفي'}].map(o=>(
                  <button key={String(o.v)} onClick={()=>setForm((f:any)=>({...f,isActive:o.v}))} style={{...S.btn(form.isActive===o.v?(o.v?'#00E676':'#FF4444'):'#111B2D',form.isActive===o.v?'#000':'#6B8CAE'),border:'1px solid #1C2A40',flex:1,fontSize:11,padding:'8px 4px'}}>{o.l}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{display:'flex',gap:8}}>
            <button onClick={save} disabled={saving} style={{...S.btn(),flex:2,padding:'11px',opacity:saving?0.7:1}}>{saving?'⏳ جاري...':'💾 حفظ'}</button>
            <button onClick={()=>setEditing(null)} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',flex:1}}>إلغاء</button>
          </div>
        </div>
      )}

      {/* قائمة الباقات */}
      {loading ? <div style={{textAlign:'center',padding:40,color:'#6B8CAE'}}>⏳ جاري التحميل...</div> : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {plans.length === 0 && (
            <div style={{...S.card,textAlign:'center',padding:32,color:'#354E6A'}}>
              <div style={{fontSize:40,marginBottom:10}}>🎯</div>
              <div>لا يوجد باقات بعد</div>
              <button onClick={openNew} style={{...S.btn(),marginTop:12,padding:'10px 24px'}}>➕ أضف باقة أولى</button>
            </div>
          )}
          {plans.map(p => (
            <div key={p.id} style={{...S.card,border:`1px solid ${p.color}30`,opacity:p.isActive?1:0.55}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:42,height:42,borderRadius:12,background:`${p.color}18`,border:`1px solid ${p.color}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{p.emoji}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:900,color:p.color}}>{p.name}</div>
                    <div style={{fontSize:10,color:'#6B8CAE',marginTop:2}}>🖥️ {p.maxDevices} · 🎫 {p.maxVouchersTotal} · {p.price>0?p.price+' ج/شهر':'مجاني'}</div>
                  </div>
                </div>
                <div style={{display:'flex',gap:4,alignItems:'center',flexWrap:'wrap'}}>
                  {[{v:p.canCreateUnlimited,l:'♾️'},{v:p.canCreateNFC,l:'📶'},{v:p.canCreateQR,l:'📷'},{v:p.canRenewVouchers,l:'🔄'}].map((x,i)=><span key={i} style={{fontSize:14,opacity:x.v?1:0.2}}>{x.l}</span>)}
                  <span style={{padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700,background:p.isActive?'rgba(0,230,118,0.1)':'rgba(255,68,68,0.1)',color:p.isActive?'#00E676':'#FF4444',border:`1px solid ${p.isActive?'rgba(0,230,118,0.3)':'rgba(255,68,68,0.3)'}`}}>{p.isActive?'✅ نشط':'⛔ مخفي'}</span>
                  <button onClick={()=>openEdit(p)} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'5px 10px'}}>✏️ تعديل</button>
                  <button onClick={()=>setDelConfirm(p.id)} style={{...S.btn('rgba(255,68,68,0.08)','#FF4444'),border:'1px solid rgba(255,68,68,0.2)',fontSize:11,padding:'5px 8px'}}>🗑️</button>
                </div>
              </div>
              {p.description && <div style={{fontSize:11,color:'#6B8CAE',marginTop:8,paddingTop:8,borderTop:'1px solid #1C2A40'}}>{p.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// تاب CPA Offers — إدارة المصادر + عرض العروض
// ═══════════════════════════════════════════
function CpaTab({ sa }: { sa: SA }) {
  const [sources, setSources]     = useState<any[]>([])
  const [offers,  setOffers]      = useState<any[]>([])
  const [total,   setTotal]       = useState(0)
  const [page,    setPage]        = useState(1)
  const [selSrc,  setSelSrc]      = useState('')
  const [loading, setLoading]     = useState(false)
  const [syncing, setSyncing]     = useState(false)
  const [msg,     setMsg]         = useState('')
  const [view,    setView]        = useState<'offers'|'sources'>('offers')
  const [form,    setForm]        = useState({ name:'cpagrip', label:'CPAGrip', userId:'', apiKey:'', pubKey:'' })

  const loadSources = useCallback(async () => {
    const r = await fetch('/api/superadmin/cpa-sources')
    const d = await r.json()
    setSources(d.sources || [])
  }, [])

  const loadOffers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '30' })
    if (selSrc) params.set('source', selSrc)
    const r = await fetch(`/api/superadmin/cpa-offers?${params}`)
    const d = await r.json()
    setOffers(d.offers || [])
    setTotal(d.total  || 0)
    setLoading(false)
  }, [page, selSrc])

  useEffect(() => { loadSources(); loadOffers() }, [loadSources, loadOffers])

  const syncOffers = async () => {
    setSyncing(true); setMsg('')
    const r = await fetch('/api/cron/sync-offers', { headers: { 'x-cron-secret': process.env.NEXT_PUBLIC_CRON_SECRET || '' } })
    const d = await r.json()
    if (d.success) {
      setMsg(`✅ تمت المزامنة — ${Object.entries(d.results).map(([k,v]:any)=>`${k}: +${v.added} جديد، ${v.updated} محدّث`).join(' | ')}`)
      loadOffers()
    } else {
      setMsg('❌ ' + (d.error || 'خطأ في المزامنة'))
    }
    setSyncing(false)
  }

  const saveSource = async () => {
    const r = await fetch('/api/superadmin/cpa-sources', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
    const d = await r.json()
    if (d.success) { setMsg('✅ تم حفظ المصدر'); loadSources() } else setMsg('❌ ' + d.error)
  }

  const SOURCE_LABELS: Record<string,string> = { cpagrip:'CPAGrip', ogads:'OGAds', adgate:'AdGate', lootably:'Lootably' }

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <button onClick={()=>setView('offers')} style={{...S.btn(view==='offers'?'#0088CC':'#111B2D',view==='offers'?'#000':'#6B8CAE'),border:'1px solid #1C2A40',fontSize:12,padding:'7px 14px'}}>💸 العروض ({total})</button>
        <button onClick={()=>setView('sources')} style={{...S.btn(view==='sources'?'#0088CC':'#111B2D',view==='sources'?'#000':'#6B8CAE'),border:'1px solid #1C2A40',fontSize:12,padding:'7px 14px'}}>⚙️ المصادر ({sources.length})</button>
        <div style={{flex:1}}/>
        <button onClick={syncOffers} disabled={syncing} style={{...S.btn(syncing?'#1C2A40':'rgba(0,230,118,0.12)',syncing?'#6B8CAE':'#00E676'),border:'1px solid rgba(0,230,118,0.3)',fontSize:12,padding:'7px 14px',opacity:syncing?0.7:1}}>
          {syncing ? '⏳ مزامنة...' : '🔄 مزامنة الآن'}
        </button>
      </div>

      {msg && <div style={S.msg(msg.startsWith('✅'))}>{msg}<span onClick={()=>setMsg('')} style={{cursor:'pointer'}}>✕</span></div>}

      {/* Sources View */}
      {view === 'sources' && (
        <div>
          <div style={{...S.card, marginBottom:12}}>
            <h3 style={{fontSize:13,fontWeight:700,color:'#E2F0FB',marginBottom:12}}>➕ إضافة / تعديل مصدر</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              <div>
                <label style={S.label}>اسم المصدر</label>
                <select style={S.input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}>
                  <option value="cpagrip">CPAGrip</option>
                  <option value="ogads">OGAds</option>
                  <option value="adgate">AdGate</option>
                  <option value="lootably">Lootably</option>
                </select>
              </div>
              <div><label style={S.label}>العنوان</label><input style={S.input} value={form.label} onChange={e=>setForm({...form,label:e.target.value})} placeholder="CPAGrip"/></div>
              <div><label style={S.label}>User ID</label><input style={{...S.input,direction:'ltr'}} value={form.userId} onChange={e=>setForm({...form,userId:e.target.value})} placeholder="123456"/></div>
              <div><label style={S.label}>API Key</label><input style={{...S.input,direction:'ltr'}} value={form.apiKey} onChange={e=>setForm({...form,apiKey:e.target.value})} placeholder="xxxx..."/></div>
              <div style={{gridColumn:'span 2'}}><label style={S.label}>Pub Key</label><input style={{...S.input,direction:'ltr'}} value={form.pubKey} onChange={e=>setForm({...form,pubKey:e.target.value})} placeholder="xxxx..."/></div>
            </div>
            <button onClick={saveSource} style={S.btn()}>💾 حفظ المصدر</button>
          </div>

          {sources.length === 0 ? (
            <div style={{...S.card,textAlign:'center',padding:40,color:'#354E6A'}}>لا يوجد مصادر — أضف مصدر أولاً</div>
          ) : sources.map(src => (
            <div key={src.id} style={{...S.card,marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'#E2F0FB'}}>{src.label}</div>
                  <div style={{fontSize:10,color:'#354E6A',fontFamily:'monospace'}}>user_id: {src.userId||'—'}</div>
                  {src.lastSync && <div style={{fontSize:10,color:'#6B8CAE',marginTop:2}}>🕐 آخر مزامنة: {new Date(src.lastSync).toLocaleString('ar-EG')}</div>}
                </div>
                <span style={S.tag(src.isActive,'#00E676')}>{src.isActive?'✅ نشط':'⛔ معطل'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Offers View */}
      {view === 'offers' && (
        <div>
          <div style={{...S.card,marginBottom:10,padding:10,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <select style={{...S.input,width:160,padding:'7px 10px',fontSize:12}} value={selSrc} onChange={e=>{setSelSrc(e.target.value);setPage(1)}}>
              <option value="">كل المصادر</option>
              {sources.map(s=><option key={s.id} value={s.name}>{s.label}</option>)}
            </select>
            <button onClick={loadOffers} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'6px 12px'}}>🔍</button>
            <span style={{fontSize:11,color:'#354E6A',marginRight:'auto'}}>{total} عرض</span>
          </div>

          {loading ? (
            <div style={{textAlign:'center',padding:40,color:'#6B8CAE'}}>⏳ جاري التحميل...</div>
          ) : offers.length === 0 ? (
            <div style={{...S.card,textAlign:'center',padding:40,color:'#354E6A'}}>
              <div style={{fontSize:40,marginBottom:10}}>💸</div>
              <div>لا يوجد عروض — اضغط «مزامنة الآن» أولاً</div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {offers.map(o => (
                <div key={o.id} style={{...S.card,padding:'11px 13px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:'#E2F0FB',marginBottom:2}}>{o.title}</div>
                      <div style={{fontSize:10,color:'#354E6A',fontFamily:'monospace',marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.url}</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <span style={S.tag(true,'#00E676')}>💰 ${o.payout}</span>
                        {o.category && <span style={S.tag(true,'#818cf8')}>{o.category}</span>}
                        <span style={S.tag(true,'#00D4FF')}>{SOURCE_LABELS[o.source]||o.source}</span>
                        {o.countries && <span style={S.tag(true,'#fb923c')}>🌍 {o.countries}</span>}
                      </div>
                    </div>
                    <a href={o.url} target="_blank" rel="noopener" style={{...S.btn('rgba(0,136,204,0.12)','#00D4FF'),border:'1px solid rgba(0,136,204,0.3)',fontSize:11,padding:'6px 10px',textDecoration:'none',flexShrink:0}}>🔗 فتح</a>
                  </div>
                </div>
              ))}
              {/* Pagination */}
              <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:10}}>
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:12,padding:'6px 14px',opacity:page===1?0.4:1}}>◀ السابق</button>
                <span style={{fontSize:12,color:'#6B8CAE',padding:'6px 14px',background:'#0C1420',borderRadius:8,border:'1px solid #1C2A40'}}>صفحة {page}</span>
                <button onClick={()=>setPage(p=>p+1)} disabled={offers.length<30} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:12,padding:'6px 14px',opacity:offers.length<30?0.4:1}}>التالي ▶</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// تاب إدارة الأجهزة — إيقاف/تشغيل أجهزة كل أدمن
// ═══════════════════════════════════════════
function DevicesControlTab({ sa }: { sa: SA }) {
  const [admins,  setAdmins]  = useState<any[]>([])
  const [devices, setDevices] = useState<Record<string,any[]>>({})
  const [expanded,setExpanded]= useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling,setToggling]= useState<string|null>(null)
  const [msg,     setMsg]     = useState('')

  const loadAdmins = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/superadmin/admins')
    const d = await r.json()
    if (Array.isArray(d)) setAdmins(d)
    setLoading(false)
  }, [])

  useEffect(() => { loadAdmins() }, [loadAdmins])

  const loadDevices = async (adminId: string) => {
    if (expanded === adminId) { setExpanded(null); return }
    setExpanded(adminId)
    if (devices[adminId]) return
    const r = await fetch(`/api/superadmin/admin-devices?adminId=${adminId}`)
    const d = await r.json()
    setDevices(prev => ({ ...prev, [adminId]: d.devices || [] }))
  }

  const toggleDevice = async (adminId: string, deviceId: string, currentActive: boolean) => {
    setToggling(deviceId)
    const r = await fetch('/api/superadmin/admin-devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, isActive: !currentActive, adminId: sa.id }),
    })
    const d = await r.json()
    if (d.success) {
      setDevices(prev => ({
        ...prev,
        [adminId]: (prev[adminId] || []).map(dev => dev.id === deviceId ? { ...dev, isActive: !currentActive } : dev)
      }))
      setMsg(`✅ الجهاز ${!currentActive ? 'تم تفعيله' : 'تم إيقافه'}`)
    } else {
      setMsg('❌ ' + d.error)
    }
    setToggling(null)
  }

  const toggleAllDevices = async (adminId: string, activate: boolean) => {
    const devs = devices[adminId] || []
    for (const dev of devs) {
      if (dev.isActive !== activate) await toggleDevice(adminId, dev.id, !activate)
    }
    // reload
    const r = await fetch(`/api/superadmin/admin-devices?adminId=${adminId}`)
    const d = await r.json()
    setDevices(prev => ({ ...prev, [adminId]: d.devices || [] }))
  }

  return (
    <div>
      <div style={{...S.card,marginBottom:14,padding:12,background:'rgba(251,146,60,0.05)',border:'1px solid rgba(251,146,60,0.2)'}}>
        <div style={{fontSize:12,color:'#fb923c',fontWeight:700}}>⚠️ تنبيه مهم</div>
        <div style={{fontSize:11,color:'#6B8CAE',marginTop:4}}>إيقاف الجهاز هيقطع كل الجلسات النشطة عليه فوراً، وهيمنع الكروت من الاتصال. لازم تتأكد قبل الإيقاف.</div>
      </div>

      {msg && <div style={S.msg(msg.startsWith('✅'))}>{msg}<span onClick={()=>setMsg('')} style={{cursor:'pointer'}}>✕</span></div>}

      {loading ? (
        <div style={{textAlign:'center',padding:40,color:'#6B8CAE'}}>⏳ جاري التحميل...</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {admins.map(admin => {
            const isOpen    = expanded === admin.id
            const devList   = devices[admin.id] || []
            const activeCount  = devList.filter(d=>d.isActive).length
            const totalCount   = devList.length
            return (
              <div key={admin.id} style={{...S.card,border:!admin.isActive?'1px solid rgba(255,68,68,0.3)':S.card.border}}>
                {/* Header */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}} onClick={()=>loadDevices(admin.id)}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:admin.isActive?'#00E676':'#FF4444',boxShadow:admin.isActive?'0 0 5px rgba(0,230,118,0.5)':'none',flexShrink:0}}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:'#E2F0FB'}}>{admin.name}</div>
                      <div style={{fontSize:10,color:'#354E6A'}}>@{admin.username} · {admin.email}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    {isOpen && devList.length > 0 && (
                      <div style={{display:'flex',gap:5}} onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>toggleAllDevices(admin.id,false)} style={{...S.btn('rgba(255,68,68,0.1)','#FF4444'),border:'1px solid rgba(255,68,68,0.3)',fontSize:10,padding:'4px 8px'}}>⛔ إيقاف الكل</button>
                        <button onClick={()=>toggleAllDevices(admin.id,true)}  style={{...S.btn('rgba(0,230,118,0.1)','#00E676'),border:'1px solid rgba(0,230,118,0.3)',fontSize:10,padding:'4px 8px'}}>▶️ تشغيل الكل</button>
                      </div>
                    )}
                    <div style={{textAlign:'center',minWidth:40}}>
                      <div style={{fontSize:14,fontWeight:700,color:activeCount>0?'#00E676':'#354E6A'}}>{isOpen?`${activeCount}/${totalCount}`:admin._count?.devices||'—'}</div>
                      <div style={{fontSize:9,color:'#354E6A'}}>أجهزة</div>
                    </div>
                    <span style={{color:'#354E6A',fontSize:14,transition:'transform 0.2s',transform:isOpen?'rotate(180deg)':'none'}}>▾</span>
                  </div>
                </div>

                {/* Devices list */}
                {isOpen && (
                  <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid #1C2A40'}}>
                    {devList.length === 0 ? (
                      <div style={{fontSize:12,color:'#354E6A',textAlign:'center',padding:'16px 0'}}>لا يوجد أجهزة</div>
                    ) : devList.map(dev => (
                      <div key={dev.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',marginBottom:7,borderRadius:10,background:'#070B12',border:`1px solid ${dev.isActive?'rgba(0,230,118,0.2)':'rgba(255,68,68,0.2)'}`}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:3}}>
                            <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:dev.isActive?'#00E676':'#FF4444'}}/>
                            <div style={{fontSize:12,fontWeight:700,color:dev.isActive?'#E2F0FB':'#6B8CAE'}}>{dev.name}</div>
                          </div>
                          <div style={{fontSize:9,color:'#354E6A',fontFamily:'monospace'}}>{dev.gatewayId}</div>
                          {dev.wifiSSID && <div style={{fontSize:10,color:'#6B8CAE',marginTop:2}}>📶 {dev.wifiSSID}</div>}
                          <div style={{fontSize:10,color:'#354E6A',marginTop:2}}>
                            🟢 {dev._count?.sessions||0} جلسة · 🎫 {dev._count?.vouchers||0} كارت
                          </div>
                        </div>
                        <button
                          onClick={()=>toggleDevice(admin.id, dev.id, dev.isActive)}
                          disabled={toggling===dev.id}
                          style={{padding:'7px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Cairo,sans-serif',flexShrink:0,opacity:toggling===dev.id?0.6:1,
                            background:dev.isActive?'rgba(255,68,68,0.12)':'rgba(0,230,118,0.12)',
                            color:dev.isActive?'#FF4444':'#00E676'}}
                        >
                          {toggling===dev.id ? '⏳' : dev.isActive ? '⛔ إيقاف' : '▶️ تشغيل'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
// ─── PortalPageTab ─────────────────────────────────────
function PortalPageTab() {
  const [devices, setDevices] = useState<any[]>([])
  const [selDevice, setSelDevice] = useState('')
  const [html, setHtml] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/superadmin/all-devices').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setDevices(d)
    })
  }, [])

  const loadDevice = async (id: string) => {
    setSelDevice(id); setMsg('')
    const dev = devices.find(d => d.id === id)
    if (dev?.portalHtml) { setHtml(dev.portalHtml); return }
    const r = await fetch(`/api/portal/page?gw_id=${dev?.gatewayId || ''}`)
    setHtml(await r.text())
  }

  const save = async () => {
    if (!selDevice) return
    setLoading(true); setMsg('')
    const r = await fetch('/api/portal/page', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: selDevice, html })
    })
    const d = await r.json()
    setMsg(d.success ? '✅ تم الحفظ!' : `❌ ${d.error}`)
    setLoading(false)
  }

  const reset = async () => {
    if (!selDevice || !confirm('هتمسح HTML المخصص وترجع للـ Default؟')) return
    setLoading(true)
    await fetch('/api/portal/page', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: selDevice, html: null })
    })
    setMsg('✅ تم الإعادة للـ Default')
    loadDevice(selDevice)
    setLoading(false)
  }

  const selDev = devices.find(d => d.id === selDevice)

  return (
    <div style={{ direction: 'rtl' }}>
      <h2 style={{ color: '#00D4FF', marginBottom: 6, fontSize: 18 }}>🌐 صفحة البورتال HTML</h2>
      <p style={{ color: '#6B8CAE', fontSize: 12, marginBottom: 18 }}>
        الصفحة بتتحمل بدون Next.js — سريعة جداً ✅ | عدّل HTML لكل جهاز بشكل مستقل
      </p>
      <div style={{ ...S.card, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={S.label}>اختار الجهاز</label>
          <select style={S.input} value={selDevice} onChange={e => loadDevice(e.target.value)}>
            <option value=''>-- اختار جهاز --</option>
            {devices.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.hotspotAdmin?.name || '?'} {d.portalHtml ? '✏️' : '📄'}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn()} onClick={save} disabled={!selDevice || loading}>{loading ? '⏳' : '💾'} حفظ</button>
          <button style={S.btn('#1C3A50', '#6B8CAE')} onClick={reset} disabled={!selDevice || loading}>🔄 Default</button>
          {selDev && <a href={`/api/portal/page?gw_id=${selDev.gatewayId}`} target='_blank' style={{ ...S.btn('#00E676', '#000'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>👁️ معاينة</a>}
        </div>
      </div>
      {msg && <div style={{ ...S.msg(msg.includes('✅')), marginBottom: 14 }}><span>{msg}</span><button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button></div>}
      {selDevice ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#6B8CAE', fontSize: 11 }}>
              /api/portal/page?gw_id={selDev?.gatewayId} · {selDev?.portalHtml ? '✏️ مخصص' : '📄 Default'}
            </span>
            <span style={{ color: '#354E6A', fontSize: 10 }}>{html.length.toLocaleString()} حرف</span>
          </div>
          <textarea value={html} onChange={e => setHtml(e.target.value)}
            style={{ ...S.input, height: 520, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', direction: 'ltr', lineHeight: 1.5 }}
            spellCheck={false} />
        </>
      ) : (
        <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#354E6A' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
          <p>اختار جهاز لتعديل صفحة البورتال بتاعته</p>
          <p style={{ fontSize: 11, marginTop: 8 }}>✏️ = HTML مخصص | 📄 = Default Template</p>
        </div>
      )}
    </div>
  )
}
// ═══════════════════════════════════════════
// تاب السجلات — Logs مع فلاتر وبحث
// ═══════════════════════════════════════════
function LogsTab() {
  const [logs,    setLogs]    = useState<any[]>([])
  const [total,   setTotal]   = useState(0)
  const [stats,   setStats]   = useState<any[]>([])
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [actor,   setActor]   = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded,setExpanded]= useState<string|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (search) params.set('search', search)
    if (actor)  params.set('actorType', actor)
    const r = await fetch(`/api/superadmin/logs?${params}`)
    const d = await r.json()
    setLogs(d.logs   || [])
    setTotal(d.total || 0)
    setStats(d.stats || [])
    setLoading(false)
  }, [page, search, actor])

  useEffect(() => { load() }, [load])

  const ACTION_COLORS: Record<string,string> = {
    DEVICE_DISABLED:   '#FF4444',
    DEVICE_ENABLED:    '#00E676',
    SYNC_CPA_OFFERS:   '#00D4FF',
    SESSION_ENDED:     '#fb923c',
    SESSION_STARTED:   '#00E676',
    VOUCHER_CREATED:   '#818cf8',
    VOUCHER_DELETED:   '#FF4444',
    ADMIN_CREATED:     '#00D4FF',
    ADMIN_UPDATED:     '#fb923c',
    PLAN_UPDATED:      '#7c3aed',
  }

  const fmt = (dt: string) => new Date(dt).toLocaleString('ar-EG',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'})

  return (
    <div>
      {/* Stats */}
      {stats.length > 0 && (
        <div style={{...S.card,marginBottom:12,padding:12}}>
          <div style={{fontSize:11,color:'#6B8CAE',marginBottom:8,fontWeight:700}}>📊 أكثر العمليات</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {stats.map((s:any) => (
              <span key={s.action} style={{padding:'4px 10px',borderRadius:20,fontSize:10,fontWeight:700,background:`${ACTION_COLORS[s.action]||'#6B8CAE'}18`,border:`1px solid ${ACTION_COLORS[s.action]||'#6B8CAE'}40`,color:ACTION_COLORS[s.action]||'#6B8CAE'}}>
                {s.action} ({s._count.id})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{...S.card,marginBottom:10,padding:10}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="🔍 بحث في العمليات..." style={{...S.input,flex:'1 1 200px',padding:'7px 11px',fontSize:12}}/>
          <select value={actor} onChange={e=>{setActor(e.target.value);setPage(1)}} style={{...S.input,width:150,padding:'7px 10px',fontSize:12}}>
            <option value="">كل المنفذين</option>
            <option value="SUPER_ADMIN">السوبر أدمن</option>
            <option value="ADMIN">أدمن</option>
            <option value="SYSTEM">النظام</option>
            <option value="USER">مستخدم</option>
          </select>
          <button onClick={load} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'7px 12px'}}>🔄 تحديث</button>
          <span style={{fontSize:11,color:'#354E6A'}}>{total} سجل</span>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:40,color:'#6B8CAE'}}>⏳ جاري التحميل...</div>
      ) : logs.length === 0 ? (
        <div style={{...S.card,textAlign:'center',padding:40,color:'#354E6A'}}>
          <div style={{fontSize:40,marginBottom:10}}>📋</div>
          <div>لا يوجد سجلات</div>
        </div>
      ) : (
        <div style={{...S.card,padding:0,overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,direction:'rtl'}}>
              <thead>
                <tr style={{background:'#070B12',borderBottom:'2px solid #1C2A40'}}>
                  {['العملية','النوع','المنفذ','IP','التاريخ',''].map(h=>(
                    <th key={h} style={{padding:'9px 12px',color:'#6B8CAE',fontWeight:600,textAlign:'right',whiteSpace:'nowrap',fontSize:11}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const clr = ACTION_COLORS[log.action] || '#6B8CAE'
                  const isExp = expanded === log.id
                  return (
                    <>
                      <tr key={log.id} style={{borderBottom:'1px solid #0C1420',cursor:'pointer',background:isExp?'rgba(0,136,204,0.04)':'transparent'}}
                        onClick={()=>setExpanded(isExp?null:log.id)}>
                        <td style={{padding:'8px 12px'}}>
                          <span style={{padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700,background:`${clr}18`,border:`1px solid ${clr}40`,color:clr,whiteSpace:'nowrap'}}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{padding:'8px 12px',color:'#6B8CAE',fontSize:11}}>{log.entityType}{log.entityId&&<span style={{color:'#354E6A',fontSize:9}}> #{log.entityId.slice(-6)}</span>}</td>
                        <td style={{padding:'8px 12px',fontSize:11}}>
                          <span style={{color:log.actorType==='SUPER_ADMIN'?'#00D4FF':log.actorType==='SYSTEM'?'#818cf8':'#fb923c',fontWeight:600}}>{log.actorType}</span>
                          {log.actorId&&<span style={{color:'#354E6A',fontSize:9,display:'block'}}>#{log.actorId.slice(-6)}</span>}
                        </td>
                        <td style={{padding:'8px 12px',color:'#354E6A',fontSize:10,fontFamily:'monospace'}}>{log.ipAddress||'—'}</td>
                        <td style={{padding:'8px 12px',color:'#354E6A',fontSize:10,whiteSpace:'nowrap'}}>{fmt(log.createdAt)}</td>
                        <td style={{padding:'8px 12px',color:'#354E6A',fontSize:11,textAlign:'center'}}>{log.details?'▾':''}</td>
                      </tr>
                      {isExp && log.details && (
                        <tr style={{background:'#070B12',borderBottom:'1px solid #1C2A40'}}>
                          <td colSpan={6} style={{padding:'10px 14px'}}>
                            <pre style={{fontSize:10,color:'#00E676',fontFamily:'monospace',margin:0,whiteSpace:'pre-wrap',wordBreak:'break-all',background:'#0C1420',padding:'10px',borderRadius:8,border:'1px solid #1C2A40'}}>
                              {(() => { try { return JSON.stringify(JSON.parse(log.details as string),null,2) } catch { return String(log.details) } })()}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderTop:'1px solid #1C2A40'}}>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'6px 12px',opacity:page===1?0.4:1}}>◀ السابق</button>
            <span style={{fontSize:11,color:'#354E6A'}}>صفحة {page} من {Math.ceil(total/50)}</span>
            <button onClick={()=>setPage(p=>p+1)} disabled={logs.length<50} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'6px 12px',opacity:logs.length<50?0.4:1}}>التالي ▶</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── كل السيرفرات: عرض كل الكافيهات من كل النشرات في مكان واحد ──────────────
type AggAdmin = { id:string; name:string; username:string; isActive:boolean; totalVouchersGenerated:number; _count?:{devices:number;vouchers:number} }
type AggServer = { key:string; label:string; url:string; ok:boolean; self:boolean; error?:string|null; admins:AggAdmin[] }

function AllServersTab() {
  const [servers,setServers]=useState<AggServer[]|null>(null)
  const [total,setTotal]=useState(0)
  const [fetchedAt,setFetchedAt]=useState('')
  const [loading,setLoading]=useState(true)
  const [notAvailable,setNotAvailable]=useState(false)

  const load=useCallback(async()=>{
    setLoading(true); setNotAvailable(false)
    try{
      const r=await fetch('/api/superadmin/aggregate')
      if(!r.ok){ setNotAvailable(true); setServers(null) } 
      else{
        const d=await r.json()
        setServers(d.servers||[]); setTotal(d.totalCafes||0)
        setFetchedAt(d.fetchedAt?new Date(d.fetchedAt).toLocaleTimeString('ar-EG'):'')
      }
    }catch{ setNotAvailable(true); setServers(null) }
    setLoading(false)
  },[])
  useEffect(()=>{ load() },[load])

  if(loading) return <div style={{textAlign:'center',padding:60,color:'#6B8CAE'}}>⏳ جاري جمع الكافيهات من كل السيرفرات...</div>

  if(notAvailable) return (
    <div style={{...S.card,textAlign:'center',padding:40,color:'#6B8CAE'}}>
      <div style={{fontSize:40,marginBottom:10}}>🌍</div>
      <div style={{fontSize:14,fontWeight:700,color:'#E2F0FB',marginBottom:6}}>الميزة دي متاحة على السيرفر الرئيسي بس</div>
      <div style={{fontSize:12}}>افتح لوحة السوبر أدمن على: <code style={{color:'#00D4FF'}}>https://hotspot-system-gamma.vercel.app/superadmin</code></div>
    </div>
  )

  return (
    <div>
      {/* ملخص عام */}
      <div style={{...S.card,marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',gap:14,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{fontSize:16,fontWeight:800,color:'#E2F0FB'}}>🌍 كل الكافيهات على كل السيرفرات</div>
          <span style={S.tag(true)}>{total} كافيه</span>
          <span style={S.tag(true,'#00E676')}>{servers?.filter(s=>s.ok).length||0}/{servers?.length||0} سيرفر متصل</span>
          {fetchedAt&&<span style={{fontSize:10,color:'#354E6A'}}>آخر تحديث: {fetchedAt}</span>}
        </div>
        <button onClick={load} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'7px 14px'}}>🔄 تحديث</button>
      </div>

      {servers&&servers.map(sv=>(
        <div key={sv.key} style={{...S.card,marginBottom:14,padding:0,overflow:'hidden'}}>
          {/* هيدر السيرفر */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,padding:'11px 16px',background:sv.ok?'rgba(0,136,204,0.06)':'rgba(255,68,68,0.06)',borderBottom:'1px solid #1C2A40'}}>
            <div style={{display:'flex',gap:9,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:15}}>{sv.ok?'✅':'❌'}</span>
              <span style={{fontSize:13,fontWeight:800,color:sv.ok?'#00D4FF':'#FF4444'}}>{sv.label}</span>
              {sv.self&&<span style={S.tag(true,'#fb923c')}>السيرفر ده</span>}
              <span style={{fontSize:10,color:'#354E6A',fontFamily:'monospace',direction:'ltr'}}>{sv.url.replace('https://','')}</span>
              <span style={S.tag(sv.ok,'#00E676')}>{sv.admins.length} كافيه</span>
            </div>
            <a href={`${sv.url}/superadmin`} target="_blank" rel="noreferrer" style={{...S.btn('#111B2D','#6B8CAE'),textDecoration:'none',border:'1px solid #1C2A40',fontSize:10,padding:'5px 10px'}}>فتح لوحة السيرفر ↗</a>
          </div>

          {!sv.ok ? (
            <div style={{padding:16,color:'#FF4444',fontSize:12}}>⚠️ السيرفر مش متاح حالياً — {sv.error}</div>
          ) : sv.admins.length===0 ? (
            <div style={{padding:16,color:'#354E6A',fontSize:12,textAlign:'center'}}>مفيش كافيهات على السيرفر ده</div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,direction:'rtl'}}>
                <thead>
                  <tr style={{background:'#070B12',borderBottom:'1px solid #1C2A40'}}>
                    {['الكافيه','اليوزر','الحالة','أجهزة','كروت','إجمالي المولد','اللوحة'].map(h=>(
                      <th key={h} style={{padding:'8px 12px',color:'#6B8CAE',fontWeight:600,textAlign:'right',fontSize:11,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sv.admins.map((a)=>(
                    <tr key={a.id} style={{borderBottom:'1px solid #0C1420'}}>
                      <td style={{padding:'8px 12px',color:'#E2F0FB',fontWeight:700,fontSize:12}}>{a.name}</td>
                      <td style={{padding:'8px 12px',color:'#6B8CAE',fontFamily:'monospace',fontSize:11,direction:'ltr',textAlign:'right'}}>@{a.username}</td>
                      <td style={{padding:'8px 12px'}}><span style={S.tag(a.isActive,a.isActive?'#00E676':'#FF4444')}>{a.isActive?'نشط':'موقوف'}</span></td>
                      <td style={{padding:'8px 12px',color:'#00D4FF',fontWeight:700}}>{a._count?.devices??0}</td>
                      <td style={{padding:'8px 12px',color:'#00D4FF',fontWeight:700}}>{a._count?.vouchers??0}</td>
                      <td style={{padding:'8px 12px',color:'#6B8CAE'}}>{(a.totalVouchersGenerated||0).toLocaleString('ar-EG')}</td>
                      <td style={{padding:'8px 12px'}}><a href={`${sv.url}/dashboard`} target="_blank" rel="noreferrer" style={{color:'#0088CC',fontSize:11,textDecoration:'none'}}>فتح ↗</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      <div style={{fontSize:11,color:'#354E6A',padding:'4px 6px',lineHeight:1.8}}>
        ℹ️ كل سيرفر ليه قاعدة بيانات لوحدها (لتوزيع الطاقة المجانية) — الكروت بتشتغل على سيرفر الكافيه اللي هي مسجل عليه، والراوتر بيتصل بسيرفره.
      </div>
    </div>
  )
}

export default function SuperAdminPage() {
  const [sa,setSA]=useState<SA|null>(null)
  const [tab,setTab]=useState('allservers')
  const [sideOpen,setSideOpen]=useState(false)

  if(!sa) return <LoginScreen onLogin={setSA}/>

  const navClick=(key:string)=>{setTab(key);setSideOpen(false)}

  return (
    <div style={{minHeight:'100vh',background:'#070B12',direction:'rtl',fontFamily:'Cairo,sans-serif'}}>
      {/* Overlay */}
      <div className={`sidebar-overlay${sideOpen?' open':''}`} onClick={()=>setSideOpen(false)}/>

      {/* Header */}
      <div style={{background:'#0C1420',borderBottom:'1px solid #1C2A40',padding:'0 14px',height:58,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="menu-toggle" onClick={()=>setSideOpen(o=>!o)}>☰</button>
          <div style={{width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,#0044AA,#0088CC)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>👑</div>
          <div><div style={{fontSize:13,fontWeight:900,color:'#00D4FF'}}>Super Admin</div><div style={{fontSize:10,color:'#6B8CAE',lineHeight:1}}>@{sa.username}</div></div>
        </div>
        <div style={{display:'flex',gap:7}}>
          <a href="/setup" target="_blank" style={{...S.btn('#111B2D','#6B8CAE'),textDecoration:'none',border:'1px solid rgba(0,212,255,0.2)',fontSize:11,padding:'5px 10px',display:'inline-flex',alignItems:'center'}}>🔧 SSH</a>
          <button style={{...S.btn('rgba(255,68,68,0.12)','#FF4444'),border:'1px solid rgba(255,68,68,0.25)',fontSize:11,padding:'6px 12px'}} onClick={()=>setSA(null)}>خروج</button>
        </div>
      </div>

      <div className="layout-shell">
        {/* Sidebar */}
        <div className={`app-sidebar${sideOpen?' open':''}`}>
          <div style={{marginBottom:14,paddingBottom:12,borderBottom:'1px solid #1C2A40',display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:20}}>👑</span>
            <div><div style={{fontSize:13,fontWeight:700,color:'#00D4FF'}}>Super Admin</div><div style={{fontSize:10,color:'#354E6A'}}>@{sa.username}</div></div>
          </div>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>navClick(t.key)} style={{width:'100%',padding:'10px 12px',background:tab===t.key?'#111B2D':'transparent',border:tab===t.key?'1px solid #1C2A40':'1px solid transparent',borderRadius:9,color:tab===t.key?'#00D4FF':'#6B8CAE',fontFamily:'Cairo,sans-serif',fontSize:12,fontWeight:600,cursor:'pointer',textAlign:'right',display:'flex',alignItems:'center',gap:7,marginBottom:3}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="app-content">
          {tab==='allservers'&& <AllServersTab />}
          {tab==='admins'    && <AdminsTab    sa={sa}/>}
          {tab==='cafestats' && <CafeStatsTab />}
          {tab==='monitor'   && <MonitorTab />}
          {tab==='vouchers' && <VouchersTab />}
          {tab==='generate' && <GenerateTab sa={sa}/>}
          {tab==='import'   && <ImportTab   sa={sa}/>}
          {tab==='rewards'  && <RewardsTab  sa={sa}/>}
          {tab==='cpa'      && <CpaTab      sa={sa}/>}
          {tab==='wifi'     && <WifiTab />}
          {tab==='sales'    && <SASalesTab />}
          {tab==='accounts' && <AccountsTab sa={sa}/>}
          {tab==='plans'       && <PlansTab />}
          {tab==='planreqs'   && <PlanRequestsTab />}
          {tab==='manageplans'&& <ManagePlansTab />}
          {tab==='devices'    && <DevicesControlTab sa={sa}/>}
          {tab==='portalpage' && <PortalPageTab />}
          {tab==='logs'       && <LogsTab />}
        </div>
      </div>

      <style>{`select option{background:#0C1420;color:#E2F0FB}`}</style>
    </div>
  )
}
