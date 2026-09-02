'use client'
import { useState, useEffect } from 'react'
import { getLang, setLang, t, type Lang } from '@/lib/i18n'

const S = {
  card:  { background:'#0C1420', border:'1px solid #1C2A40', borderRadius:14, padding:20 } as React.CSSProperties,
  input: { width:'100%', padding:'11px 14px', background:'#070B12', border:'1px solid #1C2A40', borderRadius:10, color:'#E2F0FB', fontFamily:'Cairo,sans-serif', fontSize:14, outline:'none', boxSizing:'border-box' as const },
  label: { display:'block', fontSize:12, color:'#6B8CAE', marginBottom:6 } as React.CSSProperties,
  btn:   (bg='#0088CC',color='#000') => ({ padding:'10px 20px', background:bg, border:'none', borderRadius:10, color, fontFamily:'Cairo,sans-serif', fontSize:13, fontWeight:700, cursor:'pointer' } as React.CSSProperties),
}

type AdminProfile = {
  id:string; name:string; username:string; email:string; phone:string|null
  maxDevices:number; maxVouchersTotal:number; totalVouchersGenerated:number
  canCreateUnlimited:boolean; canCreateQR:boolean; isActive:boolean; createdAt:string
  _count:{ devices:number; vouchers:number; saleRecords:number }
}

export default function ProfilePage() {
  const [lang, setLangState] = useState<Lang>('ar')
  const [adminId, setAdminId] = useState<string|null>(null)
  const [profile, setProfile] = useState<AdminProfile|null>(null)
  const [loading, setLoading] = useState(true)

  // form بيانات
  const [name, setName]   = useState('')
  const [phone, setPhone] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoMsg, setInfoMsg] = useState('')

  // form كلمة المرور
  const [curPass, setCurPass]   = useState('')
  const [newPass, setNewPass]   = useState('')
  const [confPass, setConfPass] = useState('')
  const [savingPass, setSavingPass] = useState(false)
  const [passMsg, setPassMsg]   = useState('')

  // اللغة
  const toggleLang = () => {
    const nl: Lang = lang === 'ar' ? 'en' : 'ar'
    setLang(nl)
    setLangState(nl)
    document.documentElement.lang = nl
    document.documentElement.dir  = nl === 'ar' ? 'rtl' : 'ltr'
  }

  useEffect(() => {
    const l = getLang()
    setLangState(l)
    document.documentElement.lang = l
    document.documentElement.dir  = l === 'ar' ? 'rtl' : 'ltr'

    // جلب adminId من localStorage (محفوظ عند الدخول)
    const id = localStorage.getItem('adminId')
    if (!id) { window.location.href = '/dashboard'; return }
    setAdminId(id)
    loadProfile(id)
  }, [])

  const loadProfile = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/profile?adminId=${id}`)
      const data = await res.json()
      setProfile(data)
      setName(data.name || '')
      setPhone(data.phone || '')
    } catch {}
    setLoading(false)
  }

  const saveInfo = async () => {
    if (!adminId) return
    setSavingInfo(true); setInfoMsg('')
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, name, phone }),
      })
      const d = await res.json()
      if (d.success) { setInfoMsg(t(lang,'profile_saved')); setProfile(p => p ? {...p, name: d.admin.name, phone: d.admin.phone} : p) }
      else setInfoMsg('❌ ' + (d.error || 'خطأ'))
    } catch { setInfoMsg('❌ ' + t(lang,'error_conn')) }
    setSavingInfo(false)
  }

  const changePassword = async () => {
    if (!adminId) return
    setPassMsg('')
    if (newPass !== confPass) { setPassMsg('❌ ' + t(lang,'profile_mismatch')); return }
    setSavingPass(true)
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, currentPassword: curPass, newPassword: newPass }),
      })
      const d = await res.json()
      if (d.success) { setPassMsg(t(lang,'profile_changed')); setCurPass(''); setNewPass(''); setConfPass('') }
      else setPassMsg('❌ ' + (d.error || 'خطأ'))
    } catch { setPassMsg('❌ ' + t(lang,'error_conn')) }
    setSavingPass(false)
  }

  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  return (
    <div style={{ minHeight:'100vh', background:'#070B12', direction: dir, fontFamily:'Cairo,sans-serif', color:'#E2F0FB' }}>

      {/* Header */}
      <div style={{ background:'#0C1420', borderBottom:'1px solid #1C2A40', padding:'0 20px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <a href="/dashboard" style={{ padding:'7px 14px', background:'#111B2D', border:'1px solid #1C2A40', borderRadius:9, color:'#6B8CAE', fontSize:13, textDecoration:'none', fontFamily:'Cairo,sans-serif' }}>
            {dir === 'rtl' ? '← ' : '→ '}{dir === 'rtl' ? 'لوحة التحكم' : 'Dashboard'}
          </a>
          <span style={{ fontSize:16, fontWeight:700, color:'#00D4FF' }}>{t(lang,'profile_title')}</span>
        </div>
        <button onClick={toggleLang} style={{ padding:'7px 14px', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:9, color:'#00D4FF', fontSize:13, cursor:'pointer', fontFamily:'Cairo,sans-serif', fontWeight:700 }}>
          {lang === 'ar' ? '🇬🇧 English' : '🇸🇦 عربي'}
        </button>
      </div>

      <div style={{ maxWidth:760, margin:'0 auto', padding:'24px 16px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:60, color:'#6B8CAE' }}>⏳ {t(lang,'loading')}</div>
        ) : !profile ? (
          <div style={{ textAlign:'center', padding:60, color:'#FF4444' }}>❌ Profile not found</div>
        ) : (
          <>
            {/* بطاقة الملف الشخصي */}
            <div style={{ ...S.card, marginBottom:16, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'linear-gradient(135deg,#0088CC,#00D4FF)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, flexShrink:0 }}>
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:20, fontWeight:900, color:'#fff' }}>{profile.name}</div>
                <div style={{ fontSize:13, color:'#6B8CAE', marginTop:2, fontFamily:'monospace' }}>@{profile.username}</div>
                <div style={{ fontSize:12, color:'#354E6A', marginTop:2 }}>{profile.email}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                <span style={{ padding:'4px 12px', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:20, fontSize:12, color:'#00D4FF', textAlign:'center' }}>
                  {t(lang,'profile_plan_free')}
                </span>
                <span style={{ fontSize:11, color:'#354E6A', textAlign:'center' }}>
                  {t(lang,'profile_joined')}: {new Date(profile.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {year:'numeric',month:'long',day:'numeric'})}
                </span>
              </div>
            </div>

            {/* إحصائيات سريعة */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
              {[
                { label: lang==='ar' ? 'الأجهزة' : 'Devices', val:`${profile._count.devices}/${profile.maxDevices}`, color:'#00D4FF' },
                { label: lang==='ar' ? 'الكروت' : 'Vouchers', val:`${profile.totalVouchersGenerated}/${profile.maxVouchersTotal}`, color:'#818cf8' },
                { label: lang==='ar' ? 'المبيعات' : 'Sales', val: profile._count.saleRecords, color:'#00E676' },
              ].map((s,i) => (
                <div key={i} style={{ ...S.card, textAlign:'center', padding:14 }}>
                  <div style={{ fontSize:20, fontWeight:900, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:11, color:'#354E6A', marginTop:4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* تعديل البيانات */}
            <div style={{ ...S.card, marginBottom:16 }}>
              <h3 style={{ fontSize:15, fontWeight:700, color:'#E2F0FB', marginBottom:16 }}>✏️ {t(lang,'profile_info')}</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div>
                  <label style={S.label}>{t(lang,'profile_name')}</label>
                  <input style={S.input} value={name} onChange={e=>setName(e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>{t(lang,'profile_phone')}</label>
                  <input style={{...S.input, direction:'ltr'}} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="010xxxxxxxx" />
                </div>
                <div>
                  <label style={S.label}>{t(lang,'profile_email')}</label>
                  <input style={{...S.input, color:'#354E6A'}} value={profile.email} disabled />
                </div>
                <div>
                  <label style={S.label}>{t(lang,'profile_username')}</label>
                  <input style={{...S.input, color:'#354E6A', direction:'ltr'}} value={profile.username} disabled />
                </div>
              </div>
              {infoMsg && (
                <div style={{ padding:'10px 14px', borderRadius:9, marginBottom:12, background:infoMsg.startsWith('✅')?'rgba(0,230,118,0.08)':'rgba(255,68,68,0.08)', border:`1px solid ${infoMsg.startsWith('✅')?'rgba(0,230,118,0.25)':'rgba(255,68,68,0.25)'}`, color:infoMsg.startsWith('✅')?'#00E676':'#FF4444', fontSize:13 }}>{infoMsg}</div>
              )}
              <button style={{...S.btn(), opacity:savingInfo?0.7:1}} onClick={saveInfo} disabled={savingInfo}>
                {savingInfo ? t(lang,'profile_saving') : t(lang,'profile_save')}
              </button>
            </div>

            {/* تغيير كلمة المرور */}
            <div style={S.card}>
              <h3 style={{ fontSize:15, fontWeight:700, color:'#E2F0FB', marginBottom:16 }}>🔐 {t(lang,'profile_password')}</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={S.label}>{t(lang,'profile_current')}</label>
                  <input style={{...S.input, direction:'ltr'}} type="password" value={curPass} onChange={e=>setCurPass(e.target.value)} placeholder="••••••••" />
                </div>
                <div>
                  <label style={S.label}>{t(lang,'profile_new')}</label>
                  <input style={{...S.input, direction:'ltr'}} type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="••••••••" />
                </div>
                <div>
                  <label style={S.label}>{t(lang,'profile_confirm')}</label>
                  <input style={{...S.input, direction:'ltr'}} type="password" value={confPass} onChange={e=>setConfPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&changePassword()} placeholder="••••••••" />
                </div>
              </div>
              {passMsg && (
                <div style={{ padding:'10px 14px', borderRadius:9, marginBottom:12, background:passMsg.startsWith('✅')?'rgba(0,230,118,0.08)':'rgba(255,68,68,0.08)', border:`1px solid ${passMsg.startsWith('✅')?'rgba(0,230,118,0.25)':'rgba(255,68,68,0.25)'}`, color:passMsg.startsWith('✅')?'#00E676':'#FF4444', fontSize:13 }}>{passMsg}</div>
              )}
              <button style={{...S.btn('linear-gradient(135deg,#7c3aed,#0088CC)','#fff'), opacity:savingPass?0.7:1}} onClick={changePassword} disabled={savingPass}>
                {savingPass ? t(lang,'profile_saving') : t(lang,'profile_change')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
