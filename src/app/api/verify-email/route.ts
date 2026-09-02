import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/verify-email?token=xxx — تأكيد الإيميل
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return new NextResponse(htmlPage('❌ رابط غير صالح', 'هذا الرابط غير صالح أو منتهي الصلاحية.', false))
  }

  const admin = await prisma.hotspotAdmin.findFirst({
    where: { emailVerifyToken: token }
  })

  if (!admin) {
    return new NextResponse(htmlPage('❌ رابط غير صالح', 'الرابط مش شغّال — ممكن يكون اتستخدم من قبل أو انتهى.', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  if (admin.isEmailVerified) {
    return new NextResponse(htmlPage('✅ تم التأكيد مسبقاً', 'إيميلك مؤكد بالفعل — يمكنك الدخول.', true), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  await prisma.hotspotAdmin.update({
    where: { id: admin.id },
    data: { isEmailVerified: true, emailVerifyToken: null, isActive: true }
  })

  return new NextResponse(htmlPage('🎉 تم التأكيد!', `أهلاً ${admin.name}! إيميلك اتأكد بنجاح — حسابك جاهز الآن.`, true), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

function htmlPage(title: string, msg: string, ok: boolean) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#030712;font-family:Cairo,sans-serif;padding:20px}
    .card{background:#0C1420;border:1px solid ${ok?'rgba(0,230,118,0.2)':'rgba(255,68,68,0.2)'};border-radius:20px;padding:40px 32px;text-align:center;max-width:420px;width:100%;box-shadow:0 0 60px ${ok?'rgba(0,230,118,0.08)':'rgba(255,68,68,0.08)'}}
    .icon{font-size:64px;margin-bottom:20px}
    h1{font-size:24px;font-weight:900;color:${ok?'#00E676':'#FF6B6B'};margin-bottom:12px}
    p{color:#6B8CAE;font-size:15px;line-height:1.8;margin-bottom:28px}
    a{display:inline-block;padding:13px 32px;background:linear-gradient(135deg,#0088CC,#00D4FF);border-radius:12px;color:#000;font-weight:900;font-size:15px;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${ok?'✅':'❌'}</div>
    <h1>${title}</h1>
    <p>${msg}</p>
    ${ok?'<a href="/dashboard">← الدخول للوحة التحكم</a>':'<a href="/">← الصفحة الرئيسية</a>'}
  </div>
</body>
</html>`
}
