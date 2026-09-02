// POST /api/superadmin/login
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password)
      return NextResponse.json({ error: 'أدخل البيانات' }, { status: 400 })

    const sa = await prisma.superAdmin.findUnique({ where: { username } })
    if (!sa)
      return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 401 })

    const ok = await bcrypt.compare(password, sa.password)
    if (!ok)
      return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 401 })

    const { password: _, ...safe } = sa
    return NextResponse.json({ success: true, superAdmin: safe })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
