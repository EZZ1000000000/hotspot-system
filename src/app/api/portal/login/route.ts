// POST /api/portal/login
// الـ captive portal بيبعت الكود والمعلومات هنا
// بيرجع token لو الكود صح
import { NextRequest, NextResponse } from 'next/server'
import { handlePortalLogin } from '@/wifidog/login-handler'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await handlePortalLogin(body)
    // دايماً 200 مع النتيجة في الـ JSON — الراوتر (wget/uclient-fetch) مش بيقرا
    // body الاستجابات 4xx، ولو رجعنا 400 هيظهر للمستخدم "مشكلة اتصال" غلط
    // صفحة البورتال بتعتمد على data.success مش على كود HTTP
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error' })
  }
}
