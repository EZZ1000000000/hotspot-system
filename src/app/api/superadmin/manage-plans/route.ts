// /api/superadmin/manage-plans
// CRUD للباقات — السوبر أدمن يضيف/يعدل/يحذف

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET — كل الباقات
export async function GET() {
  const plans = await prisma.plan.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json(plans)
}

// POST — إضافة باقة جديدة
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, emoji, color, price, maxDevices, maxVouchersTotal,
          canCreateUnlimited, canCreateNFC, canCreateQR, canRenewVouchers,
          description, order } = body
  if (!name) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })
  try {
    const plan = await prisma.plan.create({
      data: {
        name, emoji: emoji||'🎯', color: color||'#0088CC',
        price: price||0, maxDevices: maxDevices||1,
        maxVouchersTotal: maxVouchersTotal||100,
        canCreateUnlimited: !!canCreateUnlimited, canCreateNFC: !!canCreateNFC,
        canCreateQR: !!canCreateQR, canRenewVouchers: canRenewVouchers!==false,
        description: description||null, order: order||0,
      }
    })
    return NextResponse.json({ success: true, plan })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — تعديل باقة
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...data } = body
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })
  try {
    const plan = await prisma.plan.update({ where: { id }, data })
    return NextResponse.json({ success: true, plan })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE — حذف باقة
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })
  try {
    await prisma.plan.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
