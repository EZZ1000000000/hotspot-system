'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Voucher = {
  id: string; code: string
  dataLimitMB: number|null; timeLimitMin: number|null
  speedLimitMbps: number|null; maxUsageCount: number
  packageType: string; qrPayload?: string
}

const fmt = {
  data: (mb: number|null) => !mb ? '∞' : mb >= 1024 ? (mb/1024).toFixed(1)+'GB' : mb+'MB',
  time: (m:  number|null) => !m  ? '∞' : m  >= 60   ? `${Math.floor(m/60)}س${m%60?m%60+'د':''}` : m+'د',
}
const cleanCode = (c: string) => c.replace(/[-–—]/g,'')

function QRImg({ value, size=80 }: { value:string; size?:number }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=000000&margin=2`
  return <img src={url} width={size} height={size} style={{borderRadius:4,display:'block'}} alt="QR" crossOrigin="anonymous"/>
}

const TEMPLATES = [
  { id:'dark',       name:'🌑 داكن'        },
  { id:'blue',       name:'🔵 أزرق'        },
  { id:'purple',     name:'🟣 بنفسجي'      },
  { id:'green',      name:'🟢 أخضر'        },
  { id:'minimal',    name:'⬜ بسيط'        },
  { id:'receipt',    name:'🧾 إيصال'       },
  { id:'ticket',     name:'🎫 تذكرة'       },
  { id:'elegant',    name:'✨ ذهبي'        },
  { id:'neon',       name:'💜 نيون'        },
  { id:'ocean',      name:'🌊 أوشن'        },
  { id:'sunset',     name:'🌅 سنست'       },
  { id:'retro',      name:'📟 ريترو'      },
  { id:'cafe',       name:'☕ كافيه'       },
  { id:'midnight',   name:'🌙 منتصف الليل' },
  { id:'coral',      name:'🪸 كورال'       },
  { id:'forest',     name:'🌿 غابة'        },
  { id:'galaxy',     name:'🌌 جالاكسي'     },
  { id:'candy',      name:'🍬 كاندي'       },
  { id:'mono',       name:'🖤 مونو'        },
  { id:'fire',       name:'🔥 فاير'        },
  { id:'social_fb',  name:'📘 فيسبوك'     },
  { id:'social_ig',  name:'📸 إنستجرام'   },
  { id:'social_tw',  name:'🐦 تويتر/X'    },
  { id:'social_yt',  name:'▶️ يوتيوب'     },
  { id:'social_wa',  name:'💬 واتساب'     },
  { id:'social_tk',  name:'🎵 تيك توك'    },
  { id:'vip',        name:'👑 VIP'         },
  { id:'paper',      name:'📄 ورقي'        },
  { id:'bubble',     name:'🫧 فقاعة'       },
  { id:'matrix',     name:'🟩 ماتريكس'    },
]

function Card({ v, t, biz, logo, showQR, noSep }: {
  v:Voucher; t:string; biz:string; logo:string; showQR:boolean; noSep:boolean
}) {
  const code    = noSep ? cleanCode(v.code) : v.code
  const qrValue = v.qrPayload || `code:${v.code}`
  const B: React.CSSProperties = {
    fontFamily:'Cairo,Arial,sans-serif',
    breakInside:'avoid',
    pageBreakInside:'avoid',
    width:'100%',
    boxSizing:'border-box',
    WebkitFontSmoothing:'antialiased',
  }

  const Specs = () => (
    <div style={{display:'flex',justifyContent:'space-around',flexWrap:'wrap',gap:2,fontSize:10}}>
      {v.dataLimitMB    && <span>📊{fmt.data(v.dataLimitMB)}</span>}
      {v.timeLimitMin   && <span>⏱{fmt.time(v.timeLimitMin)}</span>}
      {v.speedLimitMbps && <span>⚡{v.speedLimitMbps}M</span>}
      {v.maxUsageCount>1 && <span>👥{v.maxUsageCount}</span>}
    </div>
  )
  const QRBlock = () => showQR ? (
    <div style={{display:'flex',justifyContent:'center',marginTop:6}}><QRImg value={qrValue} size={64}/></div>
  ) : null

  if (t==='dark') return (
    <div style={{...B,background:'#0d1b2a',border:'1px solid #1e3d5c',borderRadius:12,padding:'12px 10px',color:'white'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{fontSize:10,color:'#4a90d9',fontWeight:700,letterSpacing:1}}>WiFi ACCESS</span>
        <span style={{fontSize:15}}>{logo}</span>
      </div>
      {biz&&<div style={{fontSize:12,fontWeight:900,color:'#00d4ff',textAlign:'center',marginBottom:6}}>{biz}</div>}
      <div style={{background:'#0a1628',border:'1px dashed #1e3d5c',borderRadius:8,padding:'6px',textAlign:'center',marginBottom:6}}>
        <div style={{fontSize:9,color:'#4a90d9',marginBottom:2}}>كود الدخول</div>
        <div style={{fontSize:15,fontFamily:'monospace',fontWeight:900,color:'#00d4ff',letterSpacing:noSep?1:2}}>{code}</div>
      </div>
      <div style={{color:'#7ab3d4'}}><Specs/></div><QRBlock/>
    </div>
  )
  if (t==='blue') return (
    <div style={{...B,background:'white',border:'2px solid #1a56db',borderRadius:10,overflow:'hidden'}}>
      <div style={{background:'#1a56db',padding:'7px 10px',textAlign:'center'}}>
        <div style={{color:'white',fontWeight:900,fontSize:12}}>{logo} {biz||'WiFi Voucher'}</div>
      </div>
      <div style={{padding:'8px 10px'}}>
        <div style={{border:'2px dashed #1a56db',borderRadius:8,padding:'6px',textAlign:'center',marginBottom:6,background:'#eff6ff'}}>
          <div style={{fontSize:9,color:'#1e40af',marginBottom:2}}>كود الدخول</div>
          <div style={{fontSize:15,fontFamily:'monospace',fontWeight:900,color:'#1a56db',letterSpacing:noSep?1:2}}>{code}</div>
        </div>
        <div style={{color:'#374151'}}><Specs/></div><QRBlock/>
      </div>
    </div>
  )
  if (t==='purple') return (
    <div style={{...B,background:'linear-gradient(135deg,#667eea,#764ba2)',borderRadius:12,padding:'12px 10px',color:'white'}}>
      {biz&&<div style={{fontSize:11,fontWeight:900,textAlign:'center',marginBottom:6,opacity:.9}}>{logo} {biz}</div>}
      <div style={{background:'rgba(255,255,255,0.15)',borderRadius:8,padding:'6px',textAlign:'center',marginBottom:6}}>
        <div style={{fontSize:9,opacity:.7,marginBottom:2}}>كود الواي فاي</div>
        <div style={{fontSize:15,fontFamily:'monospace',fontWeight:900,letterSpacing:noSep?1:2}}>{code}</div>
      </div>
      <div style={{fontSize:10,opacity:.85}}><Specs/></div><QRBlock/>
    </div>
  )
  if (t==='green') return (
    <div style={{...B,background:'linear-gradient(135deg,#11998e,#38ef7d)',borderRadius:12,padding:'12px 10px',color:'white'}}>
      {biz&&<div style={{fontSize:11,fontWeight:900,textAlign:'center',marginBottom:6}}>{logo} {biz}</div>}
      <div style={{background:'rgba(0,0,0,0.15)',borderRadius:8,padding:'6px',textAlign:'center',marginBottom:6}}>
        <div style={{fontSize:9,opacity:.8,marginBottom:2}}>WiFi Code</div>
        <div style={{fontSize:15,fontFamily:'monospace',fontWeight:900,letterSpacing:noSep?1:2}}>{code}</div>
      </div>
      <div style={{fontSize:10}}><Specs/></div><QRBlock/>
    </div>
  )
  if (t==='minimal') return (
    <div style={{...B,background:'white',border:'1px solid #e5e7eb',borderRadius:8,padding:'10px'}}>
      {biz&&<div style={{fontSize:10,color:'#9ca3af',marginBottom:4,textAlign:'center'}}>{logo} {biz}</div>}
      <div style={{fontSize:15,fontFamily:'monospace',fontWeight:900,color:'#111827',letterSpacing:noSep?1:2,textAlign:'center',padding:'5px 0',borderTop:'1px solid #f3f4f6',borderBottom:'1px solid #f3f4f6',marginBottom:5}}>{code}</div>
      <div style={{fontSize:10,color:'#6b7280',textAlign:'center'}}><Specs/></div><QRBlock/>
    </div>
  )
  if (t==='receipt') return (
    <div style={{...B,background:'#fffef0',border:'1px dashed #d4c89a',borderRadius:4,padding:'8px 10px',fontFamily:'monospace'}}>
      <div style={{textAlign:'center',borderBottom:'1px dashed #d4c89a',marginBottom:6,paddingBottom:5}}>
        <div style={{fontSize:12,fontWeight:900,color:'#333'}}>{logo} {biz||'WiFi'}</div>
      </div>
      <div style={{textAlign:'center',marginBottom:6}}>
        <div style={{fontSize:10,color:'#666',marginBottom:2}}>كود الدخول:</div>
        <div style={{fontSize:16,fontWeight:900,color:'#111',letterSpacing:noSep?1:3}}>{code}</div>
      </div>
      <div style={{borderTop:'1px dashed #d4c89a',paddingTop:5,fontSize:9,color:'#666'}}>
        {v.dataLimitMB&&<div>داتا: {fmt.data(v.dataLimitMB)}</div>}
        {v.timeLimitMin&&<div>وقت: {fmt.time(v.timeLimitMin)}</div>}
      </div>
      <QRBlock/>
    </div>
  )
  if (t==='elegant') return (
    <div style={{...B,background:'white',border:'1px solid #c9a84c',borderRadius:8,padding:'10px',position:'relative'}}>
      <div style={{position:'absolute',top:3,right:3,left:3,height:2,background:'linear-gradient(90deg,#c9a84c,#f0d080,#c9a84c)',borderRadius:1}}/>
      <div style={{position:'absolute',bottom:3,right:3,left:3,height:2,background:'linear-gradient(90deg,#c9a84c,#f0d080,#c9a84c)',borderRadius:1}}/>
      {biz&&<div style={{fontSize:11,fontWeight:900,color:'#92701a',textAlign:'center',marginBottom:6,marginTop:3}}>{logo} {biz}</div>}
      <div style={{border:'1px solid #e8d5a3',borderRadius:5,padding:'6px',textAlign:'center',marginBottom:6,background:'#fffdf5'}}>
        <div style={{fontSize:9,color:'#b8861d',marginBottom:2,letterSpacing:2}}>WIFI ACCESS CODE</div>
        <div style={{fontSize:14,fontFamily:'monospace',fontWeight:900,color:'#92701a',letterSpacing:noSep?1:2}}>{code}</div>
      </div>
      <div style={{fontSize:10,color:'#b8861d',textAlign:'center'}}><Specs/></div><QRBlock/>
    </div>
  )
  if (t==='neon') return (
    <div style={{...B,background:'#0a0015',border:'1px solid #9333ea',borderRadius:12,padding:'12px 10px',color:'white'}}>
      <div style={{textAlign:'center',marginBottom:6}}>
        <span style={{fontSize:20}}>{logo}</span>
        {biz&&<div style={{fontSize:11,fontWeight:900,color:'#c084fc',marginTop:3}}>{biz}</div>}
      </div>
      <div style={{background:'rgba(147,51,234,0.15)',border:'1px solid #7c3aed',borderRadius:8,padding:'8px',textAlign:'center',marginBottom:6}}>
        <div style={{fontSize:8,color:'#c084fc',marginBottom:3,letterSpacing:2}}>◈ WIFI CODE ◈</div>
        <div style={{fontSize:16,fontFamily:'monospace',fontWeight:900,color:'#e879f9',letterSpacing:noSep?2:3}}>{code}</div>
      </div>
      <div style={{fontSize:10,color:'#c084fc',textAlign:'center'}}><Specs/></div><QRBlock/>
    </div>
  )
  if (t==='vip') return (
    <div style={{...B,background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',borderRadius:12,padding:'14px 12px',color:'white',border:'2px solid #e2b96a'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontSize:8,color:'#e2b96a',letterSpacing:3,fontWeight:700}}>V I P</div>
        <span style={{fontSize:18}}>👑</span>
        <div style={{fontSize:8,color:'#e2b96a',letterSpacing:3,fontWeight:700}}>PASS</div>
      </div>
      {biz&&<div style={{fontSize:12,fontWeight:900,color:'#ffd700',textAlign:'center',marginBottom:8}}>{biz}</div>}
      <div style={{background:'rgba(226,185,106,0.08)',border:'1px solid rgba(226,185,106,0.35)',borderRadius:8,padding:'8px',textAlign:'center',marginBottom:8}}>
        <div style={{fontSize:8,color:'#e2b96a',marginBottom:3,letterSpacing:3}}>ACCESS CODE</div>
        <div style={{fontSize:16,fontFamily:'monospace',fontWeight:900,color:'#ffd700',letterSpacing:noSep?2:3}}>{code}</div>
      </div>
      <div style={{fontSize:10,color:'#e2b96a',textAlign:'center'}}><Specs/></div><QRBlock/>
    </div>
  )
  if (t==='cafe') return (
    <div style={{...B,background:'#fdf8f0',border:'1px solid #c8a876',borderRadius:10,overflow:'hidden'}}>
      <div style={{background:'#4a2c0a',padding:'7px',textAlign:'center'}}>
        <span style={{fontSize:16}}>☕</span>
        {biz&&<span style={{color:'#f5c842',fontWeight:900,fontSize:12,marginRight:6}}> {biz}</span>}
      </div>
      <div style={{padding:'8px 10px'}}>
        <div style={{textAlign:'center',marginBottom:6}}>
          <div style={{fontSize:9,color:'#8b6914',marginBottom:3}}>~ كود الواي فاي ~</div>
          <div style={{fontSize:15,fontFamily:'monospace',fontWeight:900,color:'#3d1a08',letterSpacing:noSep?1:2,background:'#fff8e8',padding:'4px 8px',borderRadius:5,border:'1px dashed #c8a876'}}>{code}</div>
        </div>
        <div style={{fontSize:9,color:'#8b6914',textAlign:'center'}}><Specs/></div>
        <QRBlock/>
      </div>
    </div>
  )
  // default = dark style for remaining templates
  return (
    <div style={{...B,background:'#0d1b2a',border:'1px solid #1e3d5c',borderRadius:12,padding:'12px 10px',color:'white'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{fontSize:10,color:'#4a90d9',fontWeight:700,letterSpacing:1}}>WiFi ACCESS</span>
        <span style={{fontSize:15}}>{logo}</span>
      </div>
      {biz&&<div style={{fontSize:12,fontWeight:900,color:'#00d4ff',textAlign:'center',marginBottom:6}}>{biz}</div>}
      <div style={{background:'#0a1628',border:'1px dashed #1e3d5c',borderRadius:8,padding:'6px',textAlign:'center',marginBottom:6}}>
        <div style={{fontSize:9,color:'#4a90d9',marginBottom:2}}>كود الدخول</div>
        <div style={{fontSize:15,fontFamily:'monospace',fontWeight:900,color:'#00d4ff',letterSpacing:noSep?1:2}}>{code}</div>
      </div>
      <div style={{color:'#7ab3d4'}}><Specs/></div><QRBlock/>
    </div>
  )
}

const DARK_TEMPLATES = new Set(['dark','purple','green','neon','ocean','sunset','retro','midnight','forest','galaxy','fire','social_tw','social_tk','vip','mono','matrix'])

function PrintSelectedContent() {
  const params = useSearchParams()
  const ids    = params.getAll('ids')

  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [t,        setT]        = useState('dark')
  const [biz,      setBiz]      = useState('')
  const [logo,     setLogo]     = useState('📶')
  const [cols,     setCols]     = useState(3)
  const [showQR,   setShowQR]   = useState(true)
  const [noSep,    setNoSep]    = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    if (!ids.length) return
    setLoading(true)
    const q = ids.map(id=>`ids=${encodeURIComponent(id)}`).join('&')
    fetch(`/api/superadmin/vouchers-by-ids?${q}`)
      .then(r=>r.json())
      .then(d=>{ if(Array.isArray(d)) setVouchers(d) })
      .finally(()=>setLoading(false))
  }, [])

  const filtered = search ? TEMPLATES.filter(tmpl => tmpl.name.includes(search) || tmpl.id.includes(search.toLowerCase())) : TEMPLATES

  const Sinp: React.CSSProperties = { width:'100%', padding:'8px 12px', background:'#070B12', border:'1px solid #1C2A40', borderRadius:9, color:'#E2F0FB', fontFamily:'Cairo,sans-serif', fontSize:12, outline:'none' }
  const Slbl: React.CSSProperties = { display:'block', fontSize:10, color:'#6B8CAE', marginBottom:4 }
  const Scrd: React.CSSProperties = { background:'#0C1420', border:'1px solid #1C2A40', borderRadius:11, padding:13, marginBottom:10 }
  const EMOJIS = ['📶','☕','🍕','🏨','🏪','🎮','✈️','🍔','🎵','💼','🌟','🔥','📱','💻','🎯','🌐']

  return (
    <div style={{minHeight:'100vh',background:'#070B12',direction:'rtl',fontFamily:'Cairo,sans-serif'}}>
      {/* Header */}
      <div className="no-print" style={{background:'#0C1420',borderBottom:'1px solid #1C2A40',padding:'0 16px',height:50,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{fontSize:13,fontWeight:900,color:'#00D4FF'}}>👑 طباعة كروت السوبر أدمن ({vouchers.length})</div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>window.close()} style={{padding:'6px 12px',background:'#1C2A40',borderRadius:8,color:'#6B8CAE',fontSize:11,border:'none',cursor:'pointer',fontFamily:'Cairo,sans-serif'}}>✕ إغلاق</button>
          <button onClick={()=>{
            const cards = document.getElementById('print-area')?.innerHTML || ''
            const win = window.open('','_blank','width=900,height=700')
            if(!win) return
            win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:Cairo,Arial,sans-serif;
-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
html,body{background:white;direction:rtl}
@page{margin:4mm;size:A4 portrait}
.grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:7px;padding:7px}
</style></head><body>
<div class="grid">${cards}</div>
<script>window.onload=function(){setTimeout(function(){window.print()},800)}<\/script>
</body></html>`)
            win.document.close()
          }} style={{padding:'6px 16px',background:'linear-gradient(135deg,#0088CC,#00D4FF)',border:'none',borderRadius:8,color:'#000',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Cairo,sans-serif'}}>🖨️ طباعة / PDF</button>
        </div>
      </div>

      <div className="no-print print-shell">
        {/* Sidebar */}
        <div className="print-sidebar">
          <div style={Scrd}>
            <div style={{fontSize:12,fontWeight:700,color:'#E2F0FB',marginBottom:8}}>🎨 القالب</div>
            <input placeholder="🔍 ابحث..." value={search} onChange={e=>setSearch(e.target.value)} style={{...Sinp,marginBottom:8,fontSize:11}}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,maxHeight:320,overflowY:'auto'}}>
              {filtered.map(tmpl=>(
                <button key={tmpl.id} onClick={()=>setT(tmpl.id)}
                  style={{padding:'6px 4px',background:t===tmpl.id?'rgba(0,136,204,0.2)':'#111B2D',border:`1px solid ${t===tmpl.id?'#0088CC':'#1C2A40'}`,borderRadius:7,color:t===tmpl.id?'#00D4FF':'#6B8CAE',fontFamily:'Cairo,sans-serif',fontSize:10,cursor:'pointer',textAlign:'center'}}>
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>

          <div style={Scrd}>
            <div style={{fontSize:12,fontWeight:700,color:'#E2F0FB',marginBottom:9}}>🏪 المكان</div>
            <div style={{marginBottom:9}}><label style={Slbl}>اسم المكان</label><input style={Sinp} value={biz} onChange={e=>setBiz(e.target.value)} placeholder="كافيه النيل"/></div>
            <label style={Slbl}>أيقونة</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {EMOJIS.map(e=>(<button key={e} onClick={()=>setLogo(e)} style={{width:30,height:30,background:logo===e?'#0088CC':'#1C2A40',border:'none',borderRadius:7,fontSize:13,cursor:'pointer'}}>{e}</button>))}
            </div>
          </div>

          <div style={Scrd}>
            <div style={{fontSize:12,fontWeight:700,color:'#E2F0FB',marginBottom:9}}>⚙️ خيارات</div>
            <div style={{marginBottom:10}}><label style={Slbl}>عدد الأعمدة: {cols}</label><input type="range" min={1} max={4} value={cols} onChange={e=>setCols(+e.target.value)} style={{width:'100%',accentColor:'#0088CC'}}/></div>
            {[
              {val:showQR,set:setShowQR,label:'📷 QR Code'},
              {val:noSep, set:setNoSep, label:'🚫 إزالة الفواصل'},
            ].map((opt,i)=>(
              <div key={i} onClick={()=>opt.set((v:boolean)=>!v)}
                style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'7px 10px',background:opt.val?'rgba(0,212,255,0.08)':'#070B12',border:`1px solid ${opt.val?'#00D4FF':'#1C2A40'}`,borderRadius:8,marginBottom:7}}>
                <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${opt.val?'#00D4FF':'#354E6A'}`,background:opt.val?'#00D4FF':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#000'}}>{opt.val?'✓':''}</div>
                <span style={{fontSize:11,color:opt.val?'#00D4FF':'#6B8CAE',fontWeight:700}}>{opt.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="print-preview">
          {loading && <div style={{textAlign:'center',padding:40,color:'#6B8CAE',fontSize:13}}>⏳ جاري التحميل...</div>}
          {!loading && vouchers.length===0 && (
            <div style={{background:'#0C1420',border:'1px solid #1C2A40',borderRadius:14,padding:48,textAlign:'center',color:'#6B8CAE'}}>
              <div style={{fontSize:48,marginBottom:12}}>🎫</div>
              <p>لا يوجد كروت</p>
            </div>
          )}
          {!loading && vouchers.length>0 && (
            <div style={{background:DARK_TEMPLATES.has(t)?'#111':'white',borderRadius:12,padding:14}}>
              <div style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,gap:9}} id="preview-grid">
                {vouchers.map(v=><Card key={v.id} v={v} t={t} biz={biz} logo={logo} showQR={showQR} noSep={noSep}/>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print Area */}
      <div id="print-area" className="print-only">
        <div style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,gap:7,padding:7}}>
          {vouchers.map(v=><Card key={v.id} v={v} t={t} biz={biz} logo={logo} showQR={showQR} noSep={noSep}/>)}
        </div>
      </div>

      <style>{`
        @media print{
          .no-print{display:none!important}
          .print-only{display:block!important}
          .print-shell{display:none!important}
          @page{margin:4mm;size:A4 portrait}
          *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
          #print-area > div{display:grid!important}
        }
        @media screen{.print-only{display:none}}
        .print-shell{display:flex;gap:14px;padding:14px;max-width:1400px;margin:0 auto}
        .print-sidebar{width:250px;flex-shrink:0}
        .print-preview{flex:1;min-width:0}
        @media(max-width:900px){.print-shell{flex-direction:column;padding:10px}.print-sidebar{width:100%}}
        @media(max-width:600px){#preview-grid{grid-template-columns:1fr!important}}
        @media(max-width:768px){*{-webkit-text-fill-color:unset!important}}
      `}</style>
    </div>
  )
}

export default function PrintSelectedPage() {
  return (
    <Suspense fallback={<div style={{color:'white',padding:40,fontFamily:'Cairo,sans-serif',direction:'rtl'}}>⏳ جاري التحميل...</div>}>
      <PrintSelectedContent/>
    </Suspense>
  )
}
