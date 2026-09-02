// /api/superadmin/plan-requests
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const PLAN_PRESETS: Record<string, any> = {
  free:       { name:'مجاني',   maxDevices:1,  maxVouchersTotal:30,   canCreateUnlimited:false, canCreateNFC:false, canCreateQR:false, canRenewVouchers:false },
  basic:      { name:'أساسي',   maxDevices:3,  maxVouchersTotal:200,  canCreateUnlimited:false, canCreateNFC:false, canCreateQR:true,  canRenewVouchers:true  },
  pro:        { name:'احترافي', maxDevices:10, maxVouchersTotal:1000, canCreateUnlimited:true,  canCreateNFC:true,  canCreateQR:true,  canRenewVouchers:true  },
  enterprise: { name:'مؤسسي',  maxDevices:50, maxVouchersTotal:9999, canCreateUnlimited:true,  canCreateNFC:true,  canCreateQR:true,  canRenewVouchers:true  },
}

// GET — كل الطلبات
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') || 'PENDING'
  const where: any = status === 'ALL' ? {} : { status }
  const requests = await prisma.planRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { hotspotAdmin: { select: { id:true, name:true, username:true, email:true, planName:true, isActive:true } } },
  })
  return NextResponse.json(requests)
}

// PATCH — موافقة أو رفض
export async function PATCH(req: NextRequest) {
  const { requestId, action, rejectNote } = await req.json()
  // action: 'approve' | 'reject'
  if (!requestId || !action) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

  const planReq = await prisma.planRequest.findUnique({ where: { id: requestId } })
  if (!planReq) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (action === 'approve') {
    const preset = PLAN_PRESETS[planReq.planId]
    if (preset) {
      await prisma.hotspotAdmin.update({
        where: { id: planReq.hotspotAdminId },
        data: { ...preset, planName: preset.name, planUpdatedAt: new Date(), isActive: true, isEmailVerified: true },
      })
    }
    await prisma.planRequest.update({ where: { id: requestId }, data: { status: 'APPROVED', reviewedAt: new Date() } })
    await prisma.notification.create({
      data: {
        hotspotAdminId: planReq.hotspotAdminId,
        type: 'PLAN_APPROVED',
        title: `✅ تم تفعيل باقة "${planReq.planName}"`,
        body: `تهانينا! تم الموافقة على طلبك وتفعيل الباقة. يمكنك الآن الاستمتاع بجميع المزايا.`,
      },
    })
  } else {
    await prisma.planRequest.update({ where: { id: requestId }, data: { status: 'REJECTED', reviewNote: rejectNote || null, reviewedAt: new Date() } })
    await prisma.notification.create({
      data: {
        hotspotAdminId: planReq.hotspotAdminId,
        type: 'PLAN_REJECTED',
        title: `❌ تم رفض طلب الباقة "${planReq.planName}"`,
        body: rejectNote || 'تم رفض طلبك. يرجى التواصل مع الإدارة.',
      },
    })
  }

  return NextResponse.json({ success: true })
}
