'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Plan = { id:string; name:string; emoji:string; color:string; price:number; maxDevices:number; maxVouchersTotal:number; canCreateUnlimited:boolean; canCreateNFC:boolean; canCreateQR:boolean; description?:string }

const S = {
  card:  { background:'#0C1420', border:'1px solid #1C2A40', borderRadius:14, padding:18 } as React.CSSProperties,
  input: { width:'100%', padding:'10px 13px', background:'#070B12', border:'1px solid #1C2A40', borderRadius:9, color:'#E2F0FB', fontFamily:'Cairo,sans-serif', fontSize:13, outline:'none', boxSizing:'border-box' as const },
  label: { display:'block', fontSize:11, color:'#6B8CAE', marginBottom:5 } as React.CSSProperties,
  btn:   (bg='#0088CC', c='#000') => ({ padding:'10px 18px', background:bg, border:'none', borderRadius:9, color:c, fontFamily:'Cairo,sans-serif', fontSize:13, fontWeight:700, cursor:'pointer' } as React.CSSProperties),
}

function PlanRequestPage() {
  const params      = useSearchParams()
  const adminId     = params.get('adminId') || ''
  const defaultPlan = params.get('plan') || ''

  const [plans, setPlans]               = useState<Plan[]>([])
  const [selected, setSelected]         = useState(defaultPlan)
  const [note, setNote]                 = useState('')
  const [receipt, setReceipt]           = useState('')
  const [receiptImage, setReceiptImage] = useState<string|null>(null)
  const [imgName, setImgName]           = useState('')
  const [sending, setSending]           = useState(false)
  const [msg, setMsg]                   = useState('')
  const [myRequests, setMyRequests]     = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [viewImg, setViewImg]           = useState<string|null>(null)

  // تحميل الباقات والطلبات
  useEffect(() => {
    fetch('/api/plans').then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setPlans(d) }).catch(()=>{})
    if (adminId) {
      fetch(`/api/admin/plan-request?adminId=${adminId}`)
        .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setMyRequests(d) })
        .catch(()=>{}).finally(()=>setLoading(false))
    } else { setLoading(false) }
  }, [adminId])

  const handleImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 3*1024*1024) { setMsg('❌ الصورة أكبر من 3MB'); return }
    setImgName(f.name)
    const r = new FileReader()
    r.onload = ev => setReceiptImage(ev.target?.result as string)
    r.readAsDataURL(f)
  }

  const send = async () => {
    if (!adminId) { setMsg('❌ خطأ: adminId مفقود'); return }
    if (!selected) { setMsg('❌ اختر الباقة أولاً'); return }
    const plan = plans.find(p=>p.id===selected)
    if (!plan) return
    setSending(true); setMsg('')
    try {
      const res = await fetch('/api/admin/plan-request', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ adminId, planId:selected, planName:plan.name, note, receiptText:receipt, receiptImageUrl:receiptImage }),
      })
      const d = await res.json()
      if (d.success) {
        setMsg('✅ تم إرسال طلبك بنجاح!')
        setSelected(''); setNote(''); setReceipt(''); setReceiptImage(null); setImgName('')
        fetch(`/api/admin/plan-request?adminId=${adminId}`).then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setMyRequests(d) })
      } else { setMsg('❌ '+(d.error||'خطأ')) }
    } catch { setMsg('❌ خطأ في الاتصال') }
    setSending(false)
  }

  const sc = (s:string) => s==='APPROVED'?'#00E676':s==='REJECTED'?'#FF4444':'#fb923c'
  const sl = (s:string) => s==='APPROVED'?'✅ موافق':s==='REJECTED'?'❌ مرفوض':'⏳ قيد المراجعة'

  return (
    <div style={{minHeight:'100vh',background:'#070B12',color:'#E2F0FB',fontFamily:'Cairo,sans-serif',direction:'rtl',padding:'0 0 40px'}}>
      {/* Header */}
      <div style={{background:'#0C1420',borderBottom:'1px solid #1C2A40',padding:'14px 16px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10}}>
        <button onClick={()=>window.history.back()} style={{background:'none',border:'none',color:'#6B8CAE',fontSize:18,cursor:'pointer',padding:'0 4px'}}>←</button>
        <div style={{fontSize:14,fontWeight:700,color:'#E2F0FB'}}>💎 طلب الباقة</div>
      </div>

      {/* modal صورة */}
      {viewImg && (
        <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.92)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setViewImg(null)}>
          <img src={viewImg} alt="receipt" style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:10}}/>
        </div>
      )}

      <div style={{padding:14,maxWidth:600,margin:'0 auto'}}>
        {/* اختيار الباقة */}
        <div style={{...S.card,marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:'#E2F0FB',marginBottom:10}}>💎 اختر الباقة</div>
          {plans.length === 0 ? (
            <div style={{textAlign:'center',padding:20,color:'#354E6A',fontSize:12}}>⏳ جاري التحميل...</div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
              {plans.map(p=>(
                <div key={p.id} onClick={()=>setSelected(p.id)}
                  style={{padding:12,borderRadius:10,cursor:'pointer',border:`2px solid ${selected===p.id?p.color:'#1C2A40'}`,background:selected===p.id?`${p.color}10`:'#070B12',transition:'all 0.15s'}}>
                  <div style={{fontSize:22,textAlign:'center',marginBottom:4}}>{p.emoji}</div>
                  <div style={{fontSize:12,fontWeight:900,color:p.color,textAlign:'center'}}>{p.name}</div>
                  <div style={{fontSize:10,color:'#6B8CAE',textAlign:'center'}}>{p.price>0?p.price+' ج/شهر':'مجاني'}</div>
                  <div style={{fontSize:9,color:'#354E6A',textAlign:'center',marginTop:3}}>
                    🖥️{p.maxDevices} · 🎫{p.maxVouchersTotal>=9999?'∞':p.maxVouchersTotal}
                    {p.canCreateQR && ' · QR'}{p.canCreateNFC && ' · NFC'}
                  </div>
                  {p.description && <div style={{fontSize:9,color:'#354E6A',marginTop:4,textAlign:'center'}}>{p.description}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* الطلب */}
        {selected && (
          <div style={{...S.card,marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:'#E2F0FB',marginBottom:12}}>📋 تفاصيل الطلب</div>
            <div style={{marginBottom:10}}>
              <label style={S.label}>📝 ملاحظة (اختياري)</label>
              <input style={S.input} value={note} onChange={e=>setNote(e.target.value)} placeholder="ملاحظة للإدارة..."/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={S.label}>💳 بيانات الحوالة (نص)</label>
              <textarea value={receipt} onChange={e=>setReceipt(e.target.value)} rows={3} placeholder="رقم الإيصال أو بيانات التحويل..."
                style={{...S.input,resize:'vertical',fontSize:12,fontFamily:'Cairo,sans-serif'}}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={S.label}>📸 صورة الإيصال (اختياري)</label>
              <label style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',background:'#070B12',border:'2px dashed #1C2A40',borderRadius:9,cursor:'pointer',color:'#6B8CAE',fontSize:12}}>
                <span>📷</span><span>{imgName||'اضغط لرفع صورة...'}</span>
                <input type="file" accept="image/*" onChange={handleImg} style={{display:'none'}}/>
              </label>
              {receiptImage && (
                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                  <img src={receiptImage} onClick={()=>setViewImg(receiptImage)} alt="preview"
                    style={{width:64,height:48,objectFit:'cover',borderRadius:7,border:'1px solid #1C2A40',cursor:'pointer'}}/>
                  <button onClick={()=>{setReceiptImage(null);setImgName('')}}
                    style={{...S.btn('rgba(255,68,68,0.1)','#FF4444'),border:'1px solid rgba(255,68,68,0.25)',padding:'4px 8px',fontSize:10}}>✕ حذف</button>
                </div>
              )}
            </div>
            {msg && <div style={{padding:'9px 12px',borderRadius:8,marginBottom:10,background:msg.startsWith('✅')?'rgba(0,230,118,0.08)':'rgba(255,68,68,0.08)',border:`1px solid ${msg.startsWith('✅')?'rgba(0,230,118,0.25)':'rgba(255,68,68,0.25)'}`,color:msg.startsWith('✅')?'#00E676':'#FF4444',fontSize:12}}>{msg}</div>}
            <button onClick={send} disabled={sending}
              style={{...S.btn('linear-gradient(135deg,#0088CC,#00D4FF)','#000'),width:'100%',padding:'12px',opacity:sending?0.7:1}}>
              {sending?'⏳ جاري الإرسال...':'📤 إرسال الطلب'}
            </button>
          </div>
        )}

        {/* الطلبات السابقة */}
        <div style={S.card}>
          <div style={{fontSize:12,fontWeight:700,color:'#E2F0FB',marginBottom:10}}>📋 طلباتي</div>
          {loading ? <div style={{textAlign:'center',padding:20,color:'#6B8CAE',fontSize:12}}>⏳</div>
          : myRequests.length===0 ? <div style={{textAlign:'center',padding:20,color:'#354E6A',fontSize:12}}>لا يوجد طلبات سابقة</div>
          : myRequests.map(r=>(
            <div key={r.id} style={{background:'#070B12',border:`1px solid ${sc(r.status)}30`,borderRadius:9,padding:'10px 12px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:700,color:'#E2F0FB'}}>💎 {r.planName}</span>
                <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:`${sc(r.status)}12`,color:sc(r.status),border:`1px solid ${sc(r.status)}30`}}>{sl(r.status)}</span>
              </div>
              <div style={{fontSize:10,color:'#354E6A'}}>{new Date(r.createdAt).toLocaleDateString('ar-EG')}</div>
              {r.receiptText && <div style={{fontSize:10,color:'#6B8CAE',marginTop:4,fontFamily:'monospace'}}>{r.receiptText.slice(0,60)}{r.receiptText.length>60?'...':''}</div>}
              {r.receiptImageUrl && <img src={r.receiptImageUrl} onClick={()=>setViewImg(r.receiptImageUrl)} alt="receipt" style={{width:50,height:38,objectFit:'cover',borderRadius:5,marginTop:6,cursor:'pointer',border:'1px solid #1C2A40'}}/>}
              {r.status==='REJECTED'&&r.reviewNote&&<div style={{fontSize:10,color:'#FF4444',marginTop:4}}>⚠️ {r.reviewNote}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PlanRequestPageWrapper() {
  return <Suspense fallback={<div style={{color:'#6B8CAE',textAlign:'center',padding:40}}>⏳</div>}><PlanRequestPage/></Suspense>
}
