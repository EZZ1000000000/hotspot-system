// POST /api/portal/login
// الـ captive portal بيبعت الكود والمعلومات هنا
// بيرجع token لو الكود صح
import { NextRequest, NextResponse } from 'next/server'
import { handlePortalLogin } from '@/wifidog/login-handler'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await handlePortalLogin(body)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}
