// GET  /api/admin/sales?adminId=xxx&period=month
// POST /api/admin/sales   — تسجيل بيعة جديدة (بيربط SaleRecord بـ Voucher)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const p       = new URL(req.url).searchParams
    const adminId = p.get('adminId')
    const period  = p.get('period') || 'month'

    if (!adminId) return NextResponse.json({ error: 'adminId مطلوب' }, { status: 400 })

    const now = new Date()
    let fromDate: Date | undefined
    if (period === 'day')   { fromDate = new Date(now); fromDate.setHours(0, 0, 0, 0) }
    if (period === 'week')  { fromDate = new Date(now); fromDate.setDate(now.getDate() - 7) }
    if (period === 'month') { fromDate = new Date(now.getFullYear(), now.getMonth(), 1) }

    const where: any = { hotspotAdminId: adminId }
    if (fromDate) where.createdAt = { gte: fromDate }

    const records = await prisma.saleRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        vouchers: {
          select: { id: true, code: true, packageType: true, dataLimitMB: true, timeLimitMin: true }
        }
      }
    })

    // نحوّل الـ SaleRecord لصيغة مناسبة للـ frontend
    const sales = records.map(r => ({
      id:            r.id,
      soldAt:        r.createdAt,
      amount:        r.totalAmount,
      buyerName:     r.customerName,
      paymentMethod: r.paymentMethod,
      note:          r.notes,
      status:        r.status,
      // أول كارت في الفاتورة (عادةً بيكون واحد)
      voucher:       r.vouchers[0] || null,
      vouchersCount: r.vouchers.length,
    }))

    const totalRevenue = records
      .filter(r => r.status !== 'CANCELLED')
      .reduce((s, r) => s + r.totalAmount, 0)

    return NextResponse.json({ sales, totalRevenue, totalCount: sales.length })
  } catch (err: any) {
    console.error('[sales GET]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { voucherId, hotspotAdminId, amount, note, buyerName, paymentMethod } = await req.json()

    if (!hotspotAdminId || amount === undefined)
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })

    // تأكد الأدمن موجود
    const admin = await prisma.hotspotAdmin.findUnique({ where: { id: hotspotAdminId } })
    if (!admin) return NextResponse.json({ error: 'الأدمن غير موجود' }, { status: 404 })

    // أنشئ SaleRecord
    const saleData: any = {
      totalAmount:   +amount,
      paidAmount:    +amount,
      paymentMethod: paymentMethod || 'CASH',
      status:        'PAID',
      hotspotAdminId,
    }
    if (buyerName) saleData.customerName = buyerName
    if (note)      saleData.notes        = note

    const sale = await prisma.saleRecord.create({ data: saleData })

    // ربط الكارت بالـ SaleRecord لو محدد
    if (voucherId) {
      await prisma.voucher.update({
        where: { id: voucherId },
        data:  { saleId: sale.id, salePrice: +amount }
      })
    }

    return NextResponse.json({ success: true, saleId: sale.id })
  } catch (err: any) {
    console.error('[sales POST]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
