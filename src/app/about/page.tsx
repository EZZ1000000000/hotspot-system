export default function AboutPage() {
  const S = {
    bg:   { minHeight:'100vh', background:'radial-gradient(ellipse at 60% 20%,#001428,#070B12)', color:'#E2F0FB', fontFamily:'Cairo,sans-serif', direction:'rtl' as const, padding:'0 0 60px' },
    nav:  { padding:'14px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(28,42,64,0.5)', background:'rgba(7,11,18,0.9)' },
    wrap: { maxWidth:900, margin:'0 auto', padding:'40px 20px' },
    card: { background:'rgba(12,20,32,0.8)', border:'1px solid rgba(28,42,64,0.8)', borderRadius:16, padding:'28px 24px' },
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

      <div style={S.wrap}>
        {/* Hero */}
        <div style={{textAlign:'center',marginBottom:48}}>
          <div style={{fontSize:64,marginBottom:16}}>📡</div>
          <h1 style={{fontSize:'clamp(24px,5vw,40px)',fontWeight:900,color:'#00D4FF',marginBottom:12}}>من نحن</h1>
          <p style={{fontSize:16,color:'#6B8CAE',lineHeight:1.9,maxWidth:600,margin:'0 auto'}}>
            HotSpot Pro منصة متخصصة في إدارة شبكات WiFi للمقاهي والأماكن التجارية — بنيناها لأن ما هو موجود في السوق إما غالي جداً أو معقد جداً.
          </p>
        </div>

        {/* القصة */}
        <div style={{...S.card,marginBottom:20}}>
          <h2 style={{fontSize:20,fontWeight:700,color:'#E2F0FB',marginBottom:16,borderRight:'3px solid #00D4FF',paddingRight:12}}>قصتنا</h2>
          <p style={{fontSize:14,color:'#8AAFC8',lineHeight:2}}>
            بدأت الفكرة من مشكلة حقيقية: أصحاب المقاهي يعانون في إدارة كروت الإنترنت يدوياً، خسارة كروت، عدم معرفة من استخدم إيه، ومش قادرين يتابعوا مبيعاتهم. قررنا نبني الحل الصح — نظام متكامل وبسيط في نفس الوقت.
          </p>
        </div>

        {/* الأرقام */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16,marginBottom:20}}>
          {[
            {icon:'🏪',num:'500+',  label:'كافيه يستخدم المنصة'},
            {icon:'🎫',num:'50K+',  label:'كارت يُنشأ يومياً'},
            {icon:'⏱️',num:'99.9%', label:'وقت تشغيل مضمون'},
            {icon:'🛡️',num:'2024',  label:'سنة التأسيس'},
          ].map((s,i)=>(
            <div key={i} style={{...S.card,textAlign:'center',padding:20}}>
              <div style={{fontSize:36,marginBottom:8}}>{s.icon}</div>
              <div style={{fontSize:28,fontWeight:900,color:'#00D4FF'}}>{s.num}</div>
              <div style={{fontSize:12,color:'#6B8CAE',marginTop:4}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* الميزات */}
        <div style={{...S.card,marginBottom:20}}>
          <h2 style={{fontSize:20,fontWeight:700,color:'#E2F0FB',marginBottom:20,borderRight:'3px solid #00D4FF',paddingRight:12}}>لماذا HotSpot Pro؟</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>
            {[
              {icon:'⚡',t:'سريع وخفيف',d:'واجهة مصممة للسرعة، تفتح في أقل من ثانية'},
              {icon:'🔒',t:'آمن',d:'تشفير كامل، SSH tunnels، وصلاحيات محكومة'},
              {icon:'📊',t:'تقارير دقيقة',d:'تابع مبيعاتك وجلساتك لحظة بلحظة'},
              {icon:'🆓',t:'ابدأ مجاناً',d:'باقة مجانية حقيقية بدون بطاقة ائتمان'},
            ].map((f,i)=>(
              <div key={i} style={{background:'rgba(7,11,18,0.6)',border:'1px solid #1C2A40',borderRadius:12,padding:16}}>
                <div style={{fontSize:28,marginBottom:8}}>{f.icon}</div>
                <div style={{fontSize:14,fontWeight:700,color:'#E2F0FB',marginBottom:6}}>{f.t}</div>
                <div style={{fontSize:12,color:'#6B8CAE',lineHeight:1.7}}>{f.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{textAlign:'center',padding:'20px 0'}}>
          <a href="/register" style={{display:'inline-block',padding:'14px 36px',background:'linear-gradient(135deg,#0088CC,#00D4FF)',borderRadius:12,color:'#000',textDecoration:'none',fontSize:15,fontWeight:900,marginLeft:12}}>
            ابدأ مجاناً ←
          </a>
          <a href="/contact" style={{display:'inline-block',padding:'14px 36px',background:'rgba(28,42,64,0.6)',border:'1px solid #1C2A40',borderRadius:12,color:'#E2F0FB',textDecoration:'none',fontSize:15,fontWeight:700}}>
            تواصل معنا
          </a>
        </div>
      </div>

      <footer style={{textAlign:'center',padding:'20px',borderTop:'1px solid rgba(28,42,64,0.4)',color:'#354E6A',fontSize:12}}>
        <a href="/privacy" style={{color:'#6B8CAE',textDecoration:'none',margin:'0 10px'}}>سياسة الخصوصية</a>
        <a href="/terms" style={{color:'#6B8CAE',textDecoration:'none',margin:'0 10px'}}>الشروط والأحكام</a>
        <a href="/contact" style={{color:'#6B8CAE',textDecoration:'none',margin:'0 10px'}}>اتصل بنا</a>
      </footer>
    </div>
  )
}
