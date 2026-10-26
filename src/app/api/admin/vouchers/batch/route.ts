import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const p       = new URL(req.url).searchParams
  // 🛡️ حد أمان — طباعة 90 ألف كارت مرة واحدة كانت بتدبح ذاكرة قاعدة البيانات
  // (دي سبب مشكلة "اللوحة باظت" — استعلام عملاق آكل shared memory)
  // الطباعة عادية بتكون 20-30 كارت في الورقة — 5000 كارت في الطلب الواحد كتير جداً
  const MAX_PRINT = 5000
  const warn = { warning: '' }
  const batchId = p.get('batchId')
  const adminId = p.get('adminId')
  const status  = p.get('status')   // ALL | UNUSED | ACTIVE | DEPLETED
  const ids     = p.get('ids')      // comma-separated voucher IDs

  // طباعة بـ IDs محددة
  if (ids) {
    const idList = ids.split(',').filter(Boolean).slice(0, MAX_PRINT)
    if (ids.split(',').filter(Boolean).length > MAX_PRINT) warn.warning = `الحد الأقصى ${MAX_PRINT} كارت في الطلب`
    const vouchers = await prisma.voucher.findMany({
      where: { id: { in: idList } },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(warn.warning ? { ...warn, vouchers } : vouchers)
  }

  // طباعة كل كروت مكان
  if (adminId) {
    const where: any = { hotspotAdminId: adminId }
    if (status && status !== 'ALL') where.status = status
    const total = await prisma.voucher.count({ where })
    const vouchers = await prisma.voucher.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: MAX_PRINT,
    })
    if (total > MAX_PRINT) warn.warning = `عندك ${total} كارت — اتم طباعة أول ${MAX_PRINT} بس. طبّق على دفعات عشان السستم ما يتقلش`
    return NextResponse.json(warn.warning ? { ...warn, vouchers } : vouchers)
  }

  // طباعة batch محدد
  if (batchId) {
    const total = await prisma.voucher.count({ where: { printBatch: batchId } })
    const vouchers = await prisma.voucher.findMany({
      where: { printBatch: batchId },
      orderBy: { createdAt: 'asc' },
      take: MAX_PRINT,
    })
    if (total > MAX_PRINT) warn.warning = `الدفعة فيها ${total} كارت — اتم طباعة أول ${MAX_PRINT} بس. طبّق على دفعات صغيرة عشان السستم ما يتقلش`
    return NextResponse.json(warn.warning ? { ...warn, vouchers } : vouchers)
  }

  return NextResponse.json({ error: 'batchId or adminId or ids required' }, { status: 400 })
}
