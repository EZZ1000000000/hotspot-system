import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const p       = new URL(req.url).searchParams
  const adminId = p.get('adminId')
  const status  = p.get('status')  // UNUSED | ACTIVE | DEPLETED | EXPIRED | ALL
  const page    = parseInt(p.get('page') || '1')
  const limit   = parseInt(p.get('limit') || '200')

  if (!adminId) return NextResponse.json({ error: 'adminId required' }, { status: 400 })

  const where: any = { hotspotAdminId: adminId }
  if (status && status !== 'ALL') where.status = status

  const vouchers = await prisma.voucher.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })
  return NextResponse.json(vouchers)
}

// PATCH /api/admin/vouchers — إيقاف/تشغيل كروت
// body: { adminId, ids?: string[], action: 'disable' | 'enable' }
// disable → status=DISABLED (الكرت ده بس ما يشتغلش — الشبكة وصفحة الدخول زي ما هي)
// enable  → status=UNUSED (يرجع يشتغل عادي)
export async function PATCH(req: NextRequest) {
  try {
    const { adminId, ids, action } = await req.json()
    if (!adminId)               return NextResponse.json({ error: 'adminId مطلوب' }, { status: 400 })
    if (!ids?.length)           return NextResponse.json({ error: 'حدد الكروت الأول' }, { status: 400 })
    if (action !== 'disable' && action !== 'enable')
      return NextResponse.json({ error: 'action لازم تكون disable أو enable' }, { status: 400 })

    // نتحقق إن الكروت بتاعة الأدمن ده فعلاً (أمان بسيط)
    const where: any = { id: { in: ids }, hotspotAdminId: adminId }
    const data = action === 'disable' ? { status: 'DISABLED' } : { status: 'UNUSED' }

    const result = await prisma.voucher.updateMany({ where, data })
    return NextResponse.json({ success: true, updated: result.count })
  } catch (err: any) {
    console.error('[admin vouchers PATCH]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
