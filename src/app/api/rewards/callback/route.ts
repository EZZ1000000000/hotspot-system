// POST /api/rewards/callback
// الموقع بيبعت ده بعد ما المستخدم يكمل المهمة
// GET  /api/rewards/callback?t=TOKEN  ← fallback لو الموقع بيعمل redirect
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function handleCallback(token: string, secret?: string) {
  const earning = await prisma.rewardEarning.findUnique({
    where: { callbackToken: token },
    include: { task: true },
  })

  if (!earning) return { ok: false, error: 'token غير صحيح' }
  if (earning.callbackReceived) return { ok: false, error: 'تم تسجيل هذه المكافأة من قبل' }

  // تحقق من الـ secret لو الموقع بعته (اختياري بس أأمن)
  if (secret && secret !== earning.task.callbackSecret)
    return { ok: false, error: 'secret غير صحيح' }

  const now  = new Date()
  const task = earning.task

  // أضيف المكافأة للفاوتشر لو موجود
  if (earning.voucherId) {
    const updates: any = {}
    if (task.rewardTimeMins) updates.timeLimitMin = { increment: task.rewardTimeMins }
    if (task.rewardDataMB)   updates.dataLimitMB  = { increment: task.rewardDataMB }
    if (Object.keys(updates).length > 0) {
      await prisma.voucher.update({ where: { id: earning.voucherId }, data: updates })
    }
  }

  // سجّل الـ earning
  await prisma.rewardEarning.update({
    where: { id: earning.id },
    data: {
      callbackReceived: true,
      callbackAt:       now,
      addedTimeMins:    task.rewardTimeMins || null,
      addedDataMB:      task.rewardDataMB  || null,
    },
  })

  return {
    ok: true,
    reward: {
      timeMins: task.rewardTimeMins,
      dataMB:   task.rewardDataMB,
      title:    task.title,
    },
  }
}

// POST — الموقع يبعت callback
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, secret } = body
    if (!token) return NextResponse.json({ error: 'token مطلوب' }, { status: 400 })

    const result = await handleCallback(token, secret)
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// GET — fallback لو الموقع بعمل redirect
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('t') || ''
  const result = await handleCallback(token)

  // رجّع صفحة HTML بسيطة تقول للمستخدم إن المكافأة اتسجلت
  if (result.ok) {
    return new Response(`
      <!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font-family:Cairo,sans-serif;background:#060D1F;color:#E2F0FB;
        display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
        .box{background:#0C1420;border:1px solid #1C2A40;border-radius:20px;padding:40px 32px;max-width:320px}
        h2{color:#00E676;font-size:22px}p{color:#6B8CAE;font-size:14px;line-height:1.8}
        .reward{background:rgba(0,230,118,0.1);border:1px solid rgba(0,230,118,0.3);border-radius:12px;
          padding:16px;margin:16px 0;font-size:16px;font-weight:700;color:#00E676}
        button{background:linear-gradient(135deg,#0088CC,#00D4FF);border:none;border-radius:12px;
          padding:14px 28px;color:#000;font-family:Cairo,sans-serif;font-size:15px;
          font-weight:700;cursor:pointer;margin-top:8px}
      </style></head><body>
      <div class="box">
        <div style="font-size:56px;margin-bottom:12px">🎉</div>
        <h2>تم! مبروك</h2>
        <div class="reward">
          ${result.reward?.timeMins ? `⏱️ +${result.reward.timeMins} دقيقة` : ''}
          ${result.reward?.dataMB   ? `📶 +${result.reward.dataMB} MB`       : ''}
        </div>
        <p>تمت إضافة مكافأتك على باقتك تلقائياً</p>
        <button onclick="window.close()">إغلاق</button>
      </div></body></html>
    `, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } else {
    return new Response(`
      <!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
      <style>body{font-family:Cairo,sans-serif;background:#060D1F;color:#E2F0FB;
        display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
        .box{background:#0C1420;border:1px solid #1C2A40;border-radius:20px;padding:40px 32px;max-width:320px}
      </style></head><body>
      <div class="box">
        <div style="font-size:56px;margin-bottom:12px">❌</div>
        <h2 style="color:#FF4444">حدث خطأ</h2>
        <p style="color:#6B8CAE">${result.error}</p>
      </div></body></html>
    `, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}
