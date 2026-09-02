// GET/POST/PUT /api/superadmin/cpa-sources
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sources = await prisma.cpaSource.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ sources })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, label, userId, apiKey, pubKey } = await req.json()
    if (!name || !label) return NextResponse.json({ error: 'name و label مطلوبين' }, { status: 400 })
    const source = await prisma.cpaSource.upsert({
      where: { name },
      create: { name, label, userId, apiKey, pubKey },
      update: { label, userId, apiKey, pubKey, isActive: true },
    })
    return NextResponse.json({ success: true, source })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, ...data } = await req.json()
    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })
    const source = await prisma.cpaSource.update({ where: { id }, data })
    return NextResponse.json({ success: true, source })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
