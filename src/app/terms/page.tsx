export default function TermsPage() {
  const S = {
    bg:   { minHeight:'100vh', background:'radial-gradient(ellipse at 60% 20%,#001428,#070B12)', color:'#E2F0FB', fontFamily:'Cairo,sans-serif', direction:'rtl' as const, padding:'0 0 60px' },
    nav:  { padding:'14px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(28,42,64,0.5)', background:'rgba(7,11,18,0.9)' },
    wrap: { maxWidth:800, margin:'0 auto', padding:'40px 20px' },
    h1:   { fontSize:'clamp(22px,4vw,34px)', fontWeight:900, color:'#00D4FF', marginBottom:8 },
    h2:   { fontSize:18, fontWeight:700, color:'#E2F0FB', margin:'28px 0 10px', borderRight:'3px solid #00D4FF', paddingRight:12 },
    p:    { fontSize:14, color:'#8AAFC8', lineHeight:2, marginBottom:12 },
    card: { background:'rgba(12,20,32,0.8)', border:'1px solid rgba(28,42,64,0.8)', borderRadius:16, padding:'28px 24px', marginBottom:16 },
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
        <div style={{marginBottom:32}}>
          <h1 style={S.h1}>شروط الاستخدام</h1>
          <p style={{fontSize:13,color:'#6B8CAE'}}>آخر تحديث: مارس 2026</p>
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>١. قبول الشروط</h2>
          <p style={S.p}>باستخدامك لمنصة HotSpot Pro، فأنت توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي منها، يرجى التوقف عن استخدام الخدمة.</p>

          <h2 style={S.h2}>٢. وصف الخدمة</h2>
          <p style={S.p}>HotSpot Pro هو نظام إدارة WiFi مخصص لأصحاب المقاهي والأماكن التجارية، يتيح إنشاء كروت إنترنت، متابعة الجلسات، وتتبع المبيعات.</p>

          <h2 style={S.h2}>٣. إنشاء الحساب</h2>
          <p style={S.p}>يجب أن تكون المعلومات المقدمة عند التسجيل دقيقة وحقيقية. أنت مسؤول عن الحفاظ على سرية بيانات دخولك. يُمنع إنشاء حسابات متعددة لنفس الشخص أو المشروع.</p>

          <h2 style={S.h2}>٤. الاستخدام المقبول</h2>
          <p style={S.p}>يُمنع استخدام المنصة في: أي نشاط غير قانوني، مشاركة الكروت خارج نطاق عملك التجاري، محاولة اختراق أو التأثير على الخدمة، أو مشاركة بيانات الدخول مع أطراف غير مرخصة.</p>

          <h2 style={S.h2}>٥. الباقات والمدفوعات</h2>
          <p style={S.p}>الباقة المجانية متاحة بشكل دائم مع حدودها المحددة. الترقية للباقات المدفوعة تتم بعد المراجعة والتأكيد من الإدارة. المدفوعات غير قابلة للاسترداد إلا في حالات استثنائية.</p>

          <h2 style={S.h2}>٦. تعليق الخدمة</h2>
          <p style={S.p}>نحتفظ بالحق في تعليق أو إنهاء أي حساب يخالف هذه الشروط، مع إشعار مسبق قدر الإمكان.</p>

          <h2 style={S.h2}>٧. تحديث الشروط</h2>
          <p style={S.p}>قد نحدّث هذه الشروط من وقت لآخر. سيتم إشعارك عبر البريد الإلكتروني بأي تغييرات جوهرية. استمرار استخدامك للخدمة بعد التحديث يعني قبولك للشروط الجديدة.</p>
        </div>
      </div>

      <footer style={{textAlign:'center',padding:'20px',borderTop:'1px solid rgba(28,42,64,0.4)',color:'#354E6A',fontSize:12}}>
        <a href="/privacy" style={{color:'#6B8CAE',textDecoration:'none',margin:'0 10px'}}>سياسة الخصوصية</a>
        <a href="/about" style={{color:'#6B8CAE',textDecoration:'none',margin:'0 10px'}}>من نحن</a>
        <a href="/contact" style={{color:'#6B8CAE',textDecoration:'none',margin:'0 10px'}}>اتصل بنا</a>
      </footer>
    </div>
  )
}
