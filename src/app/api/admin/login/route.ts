// POST /api/admin/login
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password)
      return NextResponse.json({ error: 'أدخل اسم المستخدم وكلمة المرور' }, { status: 400 })

    const admin = await prisma.hotspotAdmin.findUnique({ where: { username } })
    if (!admin || !admin.isActive)
      return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 })

    const ok = await bcrypt.compare(password, admin.password)
    if (!ok)
      return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 })

    const { password: _, ...safe } = admin
    return NextResponse.json({ success: true, admin: safe })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
