import sys, os
sys.stdout.reconfigure(encoding='utf-8')

path = r'C:/Users/احمد/Documents/projects/h/hotspot-system/hs/src/app/superadmin/page.tsx'
c = open(path, encoding='utf-8').read()

OLD = """      {view==='list'&&admins.map(a=>{
        const pct=a.maxVouchersTotal>0?Math.round(a.totalVouchersGenerated/a.maxVouchersTotal*100):0
        return(
          <div key={a.id} style={{...S.card,marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8,gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:'#E2F0FB'}}>{a.name}</div>
                <div style={{fontSize:10,color:'#6B8CAE',marginTop:2,wordBreak:'break-all'}}>@{a.username} · {a.email}</div>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                <span style={S.tag(a.isActive,a.isActive?'#00E676':'#FF4444')}>{a.isActive?'● نشط':'● موقوف'}</span>
                <button onClick={()=>{setEditing(a);setEditData({maxDevices:a.maxDevices,maxVouchersTotal:a.maxVouchersTotal,isActive:a.isActive,canCreateUnlimited:a.canCreateUnlimited,canCreateNFC:a.canCreateNFC,canCreateQR:a.canCreateQR,canRenewVouchers:a.canRenewVouchers});setView('edit')}} style={{...S.btn('#111B2D','#6B8CAE'),border:'1px solid #1C2A40',fontSize:11,padding:'5px 10px'}}>✏️</button>
              </div>
            </div>
            <div style={{display:'flex',gap:14,marginBottom:7,fontSize:11,color:'#6B8CAE',flexWrap:'wrap'}}>
              <span>🖥️ <strong style={{color:'#00D4FF'}}>{a._count?.devices||0}/{a.maxDevices}</strong></span>
              <span>🎫 <strong style={{color:'#00D4FF'}}>{a.totalVouchersGenerated}/{a.maxVouchersTotal}</strong></span>
            </div>
            <div style={{height:4,background:'#070B12',borderRadius:3,overflow:'hidden',border:'1px solid #1C2A40',marginBottom:7}}>
              <div style={{width:`${pct}%`,height:'100%',background:pct>90?'#FF4444':pct>70?'#fb923c':'#0088CC',borderRadius:3}}/>
            </div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              {[{v:a.canCreateUnlimited,l:'♾️'},{v:a.canCreateNFC,l:'📶 NFC'},{v:a.canCreateQR,l:'📷 QR'},{v:a.canRenewVouchers,l:'🔄'}].map((p,i)=><span key={i} style={S.tag(p.v)}>{p.l}</span>)}
            </div>
          </div>
        )
      })}"""

NEW = """      {view==='list'&&admins.map(a=>{
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
      })}"""

if OLD in c:
    c2 = c.replace(OLD, NEW, 1)
    open(path, 'w', encoding='utf-8').write(c2)
    print('SUCCESS')
else:
    print('NOT FOUND')
    # show what's actually there around line 175
    lines = c.split('\n')
    for i in range(173, 202):
        print(i, repr(lines[i][:60]))
