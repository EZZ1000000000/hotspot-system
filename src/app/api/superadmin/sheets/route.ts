// GET  /api/superadmin/sheets?key=KEY   → جيب البيانات
// POST /api/superadmin/sheets           → { key, data } احفظ البيانات
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const key = new URL(req.url).searchParams.get('key')
    if (!key) return NextResponse.json({ error: 'key مطلوب' }, { status: 400 })

    const row = await prisma.keyValueStore.findUnique({ where: { key } }).catch(() => null)
    return NextResponse.json({ data: row?.value ?? null })
  } catch {
    return NextResponse.json({ data: null })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { key, data } = await req.json()
    if (!key || !data) return NextResponse.json({ error: 'key و data مطلوبين' }, { status: 400 })

    await prisma.keyValueStore.upsert({
      where:  { key },
      update: { value: data, updatedAt: new Date() },
      create: { key, value: data },
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    // لو الجدول مش موجود بعد → مش مشكلة، البيانات محفوظة في localStorage
    return NextResponse.json({ success: false, error: err.message })
  }
}
