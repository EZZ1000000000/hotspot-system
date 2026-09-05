// POST /api/setup/migrate
// ─── تبديل السيرفرات: نقل كافيه (أدمن + جهاز) من سيرفر لسيرفر تاني بنفس بيانات الدخول ───
//
// ليه؟ لو السيرفر فيه مشكلة أو الباقة المجانية خلصت — بتنقل الكافيه على سيرفر شغال
// وتطلع بسكربت تثبيت جديد يتثبت على الراوتر فيخلص التحويل.
//
// الجسم: {
//   targetServer: 'gamma'|'kappa'|'dun'|'seven',
//   admin:  { username, password, name, email? },
//   device: { name, location?, wifiSSID?, routerIp? },
// }
//
// ملاحظات:
// - الحساب القديم على السيرفر القديم ميتلمسش (زي ما هو)
// - لو اليوزر موجود بالفعل على السيرفر الهدف — بنستخدمه زي ما هو (إعادة تشغيل آمنة)
// - GatewayID + tunnelPort جداد بيولدوا تلقائي على السيرفر الهدف
// - نقل الكروت في خطوة منفصلة: /api/setup/migrate-vouchers

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SERVERS: Record<string, string> = {
  gamma: 'https://hotspot-system-gamma.vercel.app',
  kappa: 'https://hotspot-system-kappa.vercel.app',
  dun:   'https://hotspot-system-dun.vercel.app',
  seven: 'https://hotspot-system-seven.vercel.app',
}

async function jfetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
    headers: init?.body ? { 'Content-Type': 'application/json', ...(init?.headers || {}) } : init?.headers,
  })
  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('application/json') ? await res.json().catch(() => null) : await res.text()
  return { status: res.status, ok: res.ok, data }
}

export async function POST(req: NextRequest) {
  try {
    const { targetServer, admin, device } = await req.json()

    if (!SERVERS[targetServer])
      return NextResponse.json({ error: `سيرفر غير معروف: ${targetServer}` }, { status: 400 })
    if (!admin?.username || !admin?.password || !admin?.name)
      return NextResponse.json({ error: 'بيانات الأدمن ناقصة (username/password/name مطلوبة)' }, { status: 400 })
    if (!device?.name)
      return NextResponse.json({ error: 'اسم الجهاز مطلوب' }, { status: 400 })
    if (String(admin.password).length < 6)
      return NextResponse.json({ error: 'كلمة المرور قصيرة جداً (6 أحرف على الأقل)' }, { status: 400 })

    const base = SERVERS[targetServer]

    // 1) جيب أدمنز السيرفر الهدف — لتحديد السوبر أدمن + فحص وجود اليوزر مسبقاً
    const adminsRes = await jfetch(`${base}/api/superadmin/admins`)
    if (!Array.isArray(adminsRes.data) || adminsRes.data.length === 0)
      return NextResponse.json({ error: 'مفيش سوبر أدمن على السيرفر الهدف — متلغي حاجة غلط هناك' }, { status: 502 })
    const saId = adminsRes.data[0].superAdminId
    if (!saId) return NextResponse.json({ error: 'السيرفر الهدف مالوش سوبر أدمن صالح' }, { status: 502 })

    const existing = adminsRes.data.find((a: { username?: string }) => a.username === admin.username)

    // 2) الأدمن — موجود؟ استخدمه زي ما هو (بدون أي تعديل). مش موجود؟ أنشئه بنفس البيانات
    let adminId: string
    let existedAlready = false
    if (existing?.id) {
      adminId = existing.id
      existedAlready = true
    } else {
      const createRes = await jfetch(`${base}/api/superadmin/admins`, {
        method: 'POST',
        body: JSON.stringify({
          username:        admin.username,
          password:        admin.password,
          name:            admin.name,
          email:           admin.email || `${admin.username}@hotspot.local`,
          superAdminId:    saId,
          canRenewVouchers: true,
        }),
      })
      if (!createRes.ok) {
        // تعارض إيميل؟ حاول بإيميل بديل
        if (createRes.status === 409) {
          const retry = await jfetch(`${base}/api/superadmin/admins`, {
            method: 'POST',
            body: JSON.stringify({
              username: admin.username, password: admin.password, name: admin.name,
              email: `${admin.username}-${Date.now()}@migrate.local`,
              superAdminId: saId, canRenewVouchers: true,
            }),
          })
          if (!retry.ok || !(retry.data as { admin?: { id?: string } })?.admin?.id)
            return NextResponse.json({ error: 'فشل إنشاء الأدمن على السيرفر الهدف (تعارض بيانات)' }, { status: 502 })
          adminId = ((retry.data as { admin: { id: string } }).admin).id
        } else {
          const msg = (createRes.data as { error?: string })?.error || `HTTP ${createRes.status}`
          return NextResponse.json({ error: `فشل إنشاء الأدمن على السيرفر الهدف: ${msg}` }, { status: 502 })
        }
      } else {
        adminId = ((createRes.data as { admin: { id: string } }).admin).id
      }
    }

    // 3) الجهاز على السيرفر الهدف — GatewayID + tunnelPort بيولدوا هناك تلقائياً
    const devRes = await jfetch(`${base}/api/admin/devices`, {
      method: 'POST',
      body: JSON.stringify({
        hotspotAdminId: adminId,
        name:           device.name,
        location:       device.location || null,
        wifiSSID:       device.wifiSSID || null,
        routerIp:       device.routerIp || '192.168.1.1',
      }),
    })
    if (!devRes.ok || !(devRes.data as { device?: { id: string } })?.device?.id) {
      const msg = (devRes.data as { error?: string })?.error || `HTTP ${devRes.status}`
      return NextResponse.json({ error: `فشل إنشاء الجهاز على السيرفر الهدف: ${msg}` }, { status: 502 })
    }
    const newDevice = (devRes.data as { device: { id: string; gatewayId: string; tunnelPort: number; name: string } }).device

    // 4) أمر التثبيت الجديد — على الراوتر بيتثبت السكربت الجديد فيحول للسيرفر الجديد
    const installCommand = `wget -qO /tmp/i.sh "${base}/api/admin/config?deviceId=${newDevice.id}&type=script" && sh /tmp/i.sh`

    return NextResponse.json({
      success: true,
      targetServer,
      targetUrl: base,
      admin: { id: adminId, username: admin.username, existedAlready },
      device: newDevice,
      installCommand,
      nextStep: {
        endpoint: '/api/setup/migrate-vouchers',
        hint: 'نقل كروت الكافيه من السيرفر القديم للجديد',
      },
      message: `✅ تم إنشاء الكافيه على ${targetServer} — ثبّت السكربت الجديد على الراوتر عشان يتحول`,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
