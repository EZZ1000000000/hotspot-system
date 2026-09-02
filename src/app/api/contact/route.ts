import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json()
    if (!name || !email || !message)
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })

    const html = `
      <div style="font-family:Cairo,sans-serif;direction:rtl;background:#070B12;color:#E2F0FB;padding:32px;border-radius:12px;max-width:600px">
        <h2 style="color:#00D4FF;margin-bottom:20px">📬 رسالة جديدة من صفحة الاتصال</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#6B8CAE;width:120px">الاسم:</td><td style="padding:8px 0;color:#E2F0FB">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#6B8CAE">البريد:</td><td style="padding:8px 0;color:#00D4FF">${email}</td></tr>
          <tr><td style="padding:8px 0;color:#6B8CAE">الموضوع:</td><td style="padding:8px 0;color:#E2F0FB">${subject||'—'}</td></tr>
        </table>
        <div style="margin-top:20px;padding:16px;background:#0C1420;border-radius:8px;border:1px solid #1C2A40">
          <div style="color:#6B8CAE;font-size:12px;margin-bottom:8px">الرسالة:</div>
          <div style="color:#E2F0FB;line-height:1.8;white-space:pre-wrap">${message}</div>
        </div>
        <div style="margin-top:16px;font-size:12px;color:#354E6A">HotSpot Pro — نموذج الاتصال</div>
      </div>
    `

    await sendEmail(
      process.env.SMTP_USER || '4ahmedesampranks@gmail.com',
      `📬 رسالة جديدة: ${subject || 'تواصل من الموقع'} — ${name}`,
      html
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[contact]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
