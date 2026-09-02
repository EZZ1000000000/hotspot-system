// /api/admin/plan-request
// الأدمن يرسل طلب ترقية باقة
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { adminId, planId, planName, note, receiptText, receiptImageUrl } = await req.json()
    if (!adminId || !planId || !planName)
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })

    // تأكد مفيش طلب pending قديم
    const existing = await prisma.planRequest.findFirst({
      where: { hotspotAdminId: adminId, status: 'PENDING' },
    })
    if (existing)
      return NextResponse.json({ error: 'عندك طلب قيد المراجعة بالفعل — انتظر حتى يتم مراجعته' }, { status: 400 })

    const request = await prisma.planRequest.create({
      data: { hotspotAdminId: adminId, planId, planName, note, receiptText, receiptImageUrl },
    })

    // إشعار للأدمن
    await prisma.notification.create({
      data: {
        hotspotAdminId: adminId,
        type: 'PLAN_REQUEST_SENT',
        title: `📋 تم إرسال طلب باقة "${planName}"`,
        body: 'سيتم مراجعة طلبك من قبل الإدارة وسيصلك إشعار عند الموافقة.',
      },
    })

    return NextResponse.json({ success: true, requestId: request.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET — طلبات الأدمن نفسه
export async function GET(req: NextRequest) {
  const adminId = req.nextUrl.searchParams.get('adminId')
  if (!adminId) return NextResponse.json({ error: 'adminId مطلوب' }, { status: 400 })
  const requests = await prisma.planRequest.findMany({
    where: { hotspotAdminId: adminId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  return NextResponse.json(requests)
}
