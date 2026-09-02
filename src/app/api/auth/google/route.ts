// /api/auth/google — Google OAuth flow
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

function getConfig() {
  return {
    clientId:     process.env.GOOGLE_CLIENT_ID     || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    baseUrl:      process.env.NEXTAUTH_URL          || 'https://hotspot-system-gamma.vercel.app',
  }
}

function setSessionAndRedirect(adminId: string, to: string) {
  const res = NextResponse.redirect(to)
  res.cookies.set('google_session_id', adminId, {
    httpOnly: true,
    maxAge:   60 * 60 * 24 * 7,
    path:     '/',
    sameSite: 'lax',
  })
  return res
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const { clientId, clientSecret, baseUrl } = getConfig()
  const redirectUri = `${baseUrl}/api/auth/google`

  // لو مافيش credentials → error واضح
  if (!clientId || !clientSecret) {
    console.error('[google] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing')
    return NextResponse.redirect(`${baseUrl}/dashboard?google_error=config`)
  }

  if (error) {
    return NextResponse.redirect(`${baseUrl}/dashboard?google_error=denied`)
  }

  if (!code) {
    // ── Step 1: redirect لـ Google consent ──
    const plan = searchParams.get('plan') || 'free'
    const mode = searchParams.get('mode') || 'register'

    const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    googleUrl.searchParams.set('client_id',     clientId)
    googleUrl.searchParams.set('redirect_uri',  redirectUri)
    googleUrl.searchParams.set('response_type', 'code')
    googleUrl.searchParams.set('scope',         'openid email profile')
    googleUrl.searchParams.set('state',         `${mode}:${plan}`)
    googleUrl.searchParams.set('prompt',        'select_account')
    return NextResponse.redirect(googleUrl.toString())
  }

  // ── Step 2: callback من Google ──
  try {
    // Exchange code → tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('[google] token error:', JSON.stringify(tokenData))
      return NextResponse.redirect(`${baseUrl}/dashboard?google_error=token`)
    }

    // جيب بيانات المستخدم من Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const gUser = await userRes.json()

    if (!gUser.email) {
      return NextResponse.redirect(`${baseUrl}/dashboard?google_error=noemail`)
    }

    const [mode] = (state || 'register:free').split(':')

    // شوف لو الأكونت موجود
    let admin = await prisma.hotspotAdmin.findUnique({
      where: { email: gUser.email.toLowerCase() },
    })

    if (admin) {
      // حساب موجود → سجّل دخول
      if (!admin.isActive) {
        return NextResponse.redirect(`${baseUrl}/dashboard?google_error=inactive`)
      }
      // فعّل الإيميل تلقائياً لو pending
      if (!admin.isEmailVerified) {
        await prisma.hotspotAdmin.update({
          where: { id: admin.id },
          data:  { isEmailVerified: true, emailVerifyToken: null },
        })
      }
      return setSessionAndRedirect(admin.id, `${baseUrl}/dashboard`)
    }

    // مفيش حساب + mode=login
    if (mode === 'login') {
      return NextResponse.redirect(`${baseUrl}/dashboard?google_error=no_account`)
    }

    // ── إنشاء حساب جديد ──
    const superAdmin = await prisma.superAdmin.findFirst()
    if (!superAdmin) {
      return NextResponse.redirect(`${baseUrl}/dashboard?google_error=no_superadmin`)
    }

    // username فريد
    const base = (gUser.name || gUser.email.split('@')[0])
      .toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)
    let username = base, i = 0
    while (await prisma.hotspotAdmin.findUnique({ where: { username } })) {
      username = `${base}_${++i}`
    }

    admin = await prisma.hotspotAdmin.create({
      data: {
        name:               gUser.name || username,
        username,
        email:              gUser.email.toLowerCase(),
        password:           randomBytes(20).toString('hex'),
        superAdminId:       superAdmin.id,
        maxDevices:         1,
        maxVouchersTotal:   30,
        canCreateUnlimited: false,
        canCreateNFC:       false,
        canCreateQR:        false,
        canRenewVouchers:   false,
        planName:           'مجاني',
        isActive:           true,
        isEmailVerified:    true,
        emailVerifyToken:   null,
      },
    })

    await prisma.notification.create({
      data: {
        type:           'NEW_REGISTRATION',
        title:          '👤 تسجيل جديد بجوجل',
        body:           `${admin.name} (@${username}) سجّل بحساب جوجل`,
        hotspotAdminId: admin.id,
      },
    }).catch(() => {})

    return setSessionAndRedirect(admin.id, `${baseUrl}/dashboard?welcome=google`)

  } catch (err: any) {
    console.error('[google-oauth] error:', err?.message || err)
    return NextResponse.redirect(`${baseUrl}/dashboard?google_error=server`)
  }
}
