// صفحة سياسة الخصوصية — مطلوبة لجوجل OAuth verification
export default function PrivacyPage() {
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
          <h1 style={S.h1}>سياسة الخصوصية</h1>
          <p style={{fontSize:13,color:'#6B8CAE'}}>آخر تحديث: مارس 2026</p>
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>١. المعلومات التي نجمعها</h2>
          <p style={S.p}>عند تسجيلك في HotSpot Pro، نقوم بجمع البيانات التالية: الاسم الكامل، البريد الإلكتروني، رقم الهاتف (اختياري)، واسم المستخدم. عند تسجيل الدخول عبر Google، نحصل على الاسم والبريد الإلكتروني فقط من خلال بروتوكول OAuth 2.0 الآمن.</p>

          <h2 style={S.h2}>٢. كيف نستخدم بياناتك</h2>
          <p style={S.p}>نستخدم بياناتك حصرياً لأغراض تشغيل الخدمة: إنشاء وإدارة حسابك، إرسال إشعارات مهمة عبر البريد الإلكتروني، والتواصل معك بشأن طلباتك. لا نبيع بياناتك لأي طرف ثالث ولا نستخدمها في أغراض تسويقية بدون موافقتك.</p>

          <h2 style={S.h2}>٣. تسجيل الدخول بجوجل</h2>
          <p style={S.p}>عند استخدام ميزة "تسجيل الدخول بجوجل"، نحصل على: الاسم الأول والأخير، وعنوان البريد الإلكتروني. لا نحصل على كلمة المرور الخاصة بحسابك في جوجل ولا على أي بيانات أخرى خارج نطاق الأذونات المطلوبة (openid, email, profile).</p>

          <h2 style={S.h2}>٤. تخزين البيانات وحمايتها</h2>
          <p style={S.p}>تُخزَّن بياناتك على خوادم آمنة مع تشفير كلمات المرور باستخدام bcrypt. نستخدم HTTPS لتشفير جميع الاتصالات. نحتفظ ببياناتك طالما حسابك نشط، ويمكنك طلب حذفها في أي وقت.</p>

          <h2 style={S.h2}>٥. حقوقك</h2>
          <p style={S.p}>لديك الحق في: الاطلاع على بياناتك المحفوظة، طلب تصحيحها، أو طلب حذف حسابك كاملاً. للتواصل بشأن ذلك، استخدم صفحة <a href="/contact" style={{color:'#00D4FF'}}>اتصل بنا</a>.</p>

          <h2 style={S.h2}>٦. ملفات تعريف الارتباط (Cookies)</h2>
          <p style={S.p}>نستخدم cookies محدودة لحفظ جلسة تسجيل الدخول فقط. لا نستخدم cookies تتبعية أو تحليلية من طرف ثالث.</p>

          <h2 style={S.h2}>٧. التواصل</h2>
          <p style={S.p}>لأي استفسارات تتعلق بخصوصيتك، تواصل معنا عبر: <a href="/contact" style={{color:'#00D4FF'}}>صفحة الاتصال</a> أو بريدنا: <a href="mailto:4ahmedesampranks@gmail.com" style={{color:'#00D4FF'}}>4ahmedesampranks@gmail.com</a></p>
        </div>
      </div>

      <footer style={{textAlign:'center',padding:'20px',borderTop:'1px solid rgba(28,42,64,0.4)',color:'#354E6A',fontSize:12}}>
        <a href="/terms" style={{color:'#6B8CAE',textDecoration:'none',margin:'0 10px'}}>الشروط والأحكام</a>
        <a href="/about" style={{color:'#6B8CAE',textDecoration:'none',margin:'0 10px'}}>من نحن</a>
        <a href="/contact" style={{color:'#6B8CAE',textDecoration:'none',margin:'0 10px'}}>اتصل بنا</a>
      </footer>
    </div>
  )
}
