import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, welcomeEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { name, username, email, phone, password } = await req.json()

    if (!name || !username || !email || !password)
      return NextResponse.json({ error: 'أدخل كل البيانات المطلوبة' }, { status: 400 })

    if (password.length < 6)
      return NextResponse.json({ error: 'كلمة المرور 6 حروف على الأقل' }, { status: 400 })

    if (!/^[a-z0-9_]+$/i.test(username))
      return NextResponse.json({ error: 'اليوزرنيم: حروف وأرقام و _ فقط' }, { status: 400 })

    // تحقق من اليوزرنيم والإيميل
    const exists = await prisma.hotspotAdmin.findFirst({
      where: { OR: [{ username: username.toLowerCase().trim() }, { email: email.toLowerCase().trim() }] }
    })
    if (exists) {
      if (exists.username === username.toLowerCase().trim())
        return NextResponse.json({ error: 'اسم المستخدم مستخدم بالفعل' }, { status: 400 })
      return NextResponse.json({ error: 'الإيميل مستخدم بالفعل' }, { status: 400 })
    }

    // جيب أي سوبر أدمن
    const superAdmin = await prisma.superAdmin.findFirst()
    if (!superAdmin)
      return NextResponse.json({ error: 'النظام غير مهيأ بعد' }, { status: 500 })

    const hashed     = await bcrypt.hash(password, 10)
    const verifyToken = randomBytes(32).toString('hex')

    // إنشاء الحساب — Free Plan (غير مفعّل حتى التأكيد)
    const admin = await prisma.hotspotAdmin.create({
      data: {
        name:               name.trim(),
        username:           username.toLowerCase().trim(),
        email:              email.toLowerCase().trim(),
        phone:              phone || null,
        password:           hashed,
        superAdminId:       superAdmin.id,
        // Free Plan
        maxDevices:         1,
        maxVouchersTotal:   30,
        canCreateUnlimited: false,
        canCreateNFC:       false,
        canCreateQR:        false,
        canRenewVouchers:   false,
        planName:           'مجاني',
            // الحساب موقوف حتى تأكيد الإيميل
        isActive:           false,
        isEmailVerified:    false,
        emailVerifyToken:   verifyToken,
      }
    })

    // إرسال إيميل التأكيد
    const baseUrl  = process.env.NEXTAUTH_URL || new URL(req.url).origin
    const verifyUrl = `${baseUrl}/api/verify-email?token=${verifyToken}`

    const emailSent = await sendEmail(
      admin.email,
      '✅ أكّد إيميلك — HotSpot Pro',
      welcomeEmail(admin.name, verifyUrl)
    )

    // إشعار للسوبر أدمن
    await prisma.notification.create({
      data: {
        type:            'NEW_REGISTRATION',
        title:           '👤 تسجيل جديد',
        body:            `${name} (@${username}) سجّل حساب جديد — بانتظار التفعيل`,
        hotspotAdminId:  admin.id,
        isRead:          false,
      }
    }).catch(() => {}) // مش مهم لو فشل

    return NextResponse.json({
      success:    true,
      emailSent,
      message:    emailSent
        ? '✅ تم إنشاء حسابك! تحقق من إيميلك لتفعيل الحساب'
        : '✅ تم إنشاء حسابك! سيتم تفعيله قريباً من الإدارة',
    })

  } catch (err: any) {
    console.error('[register]', err)
    return NextResponse.json({ error: 'خطأ في السيرفر' }, { status: 500 })
  }
}
