// lib/email.ts — إرسال إيميلات عبر SMTP (بدون nodemailer)
// بيستخدم fetch مع Gmail SMTP عبر Resend أو raw SMTP

const CFG = {
  host:    process.env.SMTP_HOST    || '',
  port:    parseInt(process.env.SMTP_PORT || '587'),
  user:    process.env.SMTP_USER    || '',
  pass:    process.env.SMTP_PASS    || '',
  from:    process.env.SMTP_FROM    || 'HotSpot Pro <noreply@babreizk.online>',
  baseUrl: process.env.NEXTAUTH_URL || 'https://babreizk.online',
}

// ── إرسال إيميل ──────────────────────────────────────────────────────────────
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  // Dev mode — مفيش SMTP مضبوط
  if (!CFG.host || !CFG.user || !CFG.pass) {
    console.log('\n📧 [EMAIL - DEV MODE]')
    console.log(`To: ${to} | Subject: ${subject}`)
    return true
  }

  try {
    // Gmail SMTP عبر fetch مع basic auth (OAuth2 style)
    // بنستخدم smtplib workaround عبر external API
    return await sendViaGmail(to, subject, html)
  } catch (err) {
    console.error('[EMAIL ERROR]', err)
    return false
  }
}

// ── Gmail عبر HTTP API (بديل nodemailer) ─────────────────────────────────────
async function sendViaGmail(to: string, subject: string, html: string): Promise<boolean> {
  // استخدام Gmail SMTP عبر child_process (متاح في Node.js بدون مكتبات)
  const { execSync } = await import('child_process')

  const message = [
    `From: ${CFG.from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(html).toString('base64'),
  ].join('\r\n')

  // Python sendmail (موجود افتراضياً على Ubuntu)
  const script = `
import smtplib, base64, sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header

msg = MIMEMultipart('alternative')
msg['From'] = '${CFG.from.replace(/'/g, "\\'")}'
msg['To'] = '${to}'
msg['Subject'] = Header('${subject.replace(/'/g, "\\'")}', 'utf-8')

part = MIMEText(base64.b64decode(sys.argv[1]).decode('utf-8'), 'html', 'utf-8')
msg.attach(part)

try:
  server = smtplib.SMTP('${CFG.host}', ${CFG.port})
  server.starttls()
  server.login('${CFG.user}', '${CFG.pass}')
  server.sendmail('${CFG.user}', '${to}', msg.as_string())
  server.quit()
  print('OK')
except Exception as e:
  print('ERROR:', e)
  exit(1)
`

  try {
    const htmlB64 = Buffer.from(html).toString('base64')
    const result = execSync(`python3 -c "${script.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" "${htmlB64}"`, {
      timeout: 15000,
      encoding: 'utf8',
    })
    return result.includes('OK')
  } catch (e: any) {
    console.error('[GMAIL SMTP]', e.stderr || e.message)
    return false
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

export function welcomeEmail(name: string, verifyUrl: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#f0f4f8;margin:0;padding:20px}
.wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
.hdr{background:linear-gradient(135deg,#003080,#0088CC);padding:32px;text-align:center;color:#fff}
.hdr h1{margin:0;font-size:24px;font-weight:900}
.body{padding:32px}
.body p{color:#374151;font-size:15px;line-height:1.8;margin:0 0 16px}
.btn{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#0088CC,#00D4FF);border-radius:12px;color:#000;font-weight:900;font-size:15px;text-decoration:none;margin:8px 0}
.plan{background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:16px;margin:20px 0}
.plan-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e0f2fe;font-size:14px;color:#374151}
.ftr{background:#f9fafb;padding:20px 32px;text-align:center;color:#9ca3af;font-size:12px}
</style></head>
<body>
<div class="wrap">
  <div class="hdr">
    <div style="font-size:48px;margin-bottom:12px">📶</div>
    <h1>أهلاً بك في HotSpot Pro!</h1>
    <p style="margin:8px 0 0;opacity:0.8;font-size:14px">نظام إدارة الواي فاي الاحترافي</p>
  </div>
  <div class="body">
    <p>أهلاً <strong>${name}</strong>،</p>
    <p>تم إنشاء حسابك بنجاح! اضغط على الزر عشان تأكد إيميلك وتفعّل الحساب:</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${verifyUrl}" class="btn">✅ تأكيد الإيميل</a>
    </div>
    <div class="plan">
      <div style="font-weight:700;font-size:14px;margin-bottom:10px;color:#0369a1">🚀 خطتك الحالية: مجاني</div>
      <div class="plan-row"><span>الأجهزة</span><span><strong>1 جهاز</strong></span></div>
      <div class="plan-row"><span>الكروت</span><span><strong>30 كارت</strong></span></div>
      <div class="plan-row" style="border:none"><span>المدة</span><span><strong>بلا انتهاء</strong></span></div>
    </div>
    <p style="font-size:13px;color:#6b7280">لو مش أنت اللي سجّل — تجاهل الإيميل ده.</p>
  </div>
  <div class="ftr">© ${new Date().getFullYear()} HotSpot Pro · babreizk.online</div>
</div>
</body></html>`
}

export function notificationEmail(adminName: string, title: string, body: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#f0f4f8;margin:0;padding:20px}
.wrap{max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden}
.hdr{background:#0C1420;padding:24px;text-align:center;color:#fff}
.body{padding:28px}
.ftr{background:#f9fafb;padding:16px 28px;text-align:center;color:#9ca3af;font-size:12px}
</style></head>
<body>
<div class="wrap">
  <div class="hdr">
    <div style="font-size:36px;margin-bottom:8px">🔔</div>
    <div style="font-size:16px;font-weight:700;color:#00D4FF">${title}</div>
  </div>
  <div class="body">
    <p style="color:#374151;font-size:15px;line-height:1.8">أهلاً <strong>${adminName}</strong>،</p>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin:16px 0;color:#92400e">${body}</div>
    <div style="text-align:center;margin-top:20px">
      <a href="${CFG.baseUrl}/dashboard" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#0088CC,#00D4FF);border-radius:10px;color:#000;font-weight:900;font-size:14px;text-decoration:none">← لوحة التحكم</a>
    </div>
  </div>
  <div class="ftr">© ${new Date().getFullYear()} HotSpot Pro</div>
</div>
</body></html>`
}
