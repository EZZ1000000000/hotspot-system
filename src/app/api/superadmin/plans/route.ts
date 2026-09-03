// /api/superadmin/plans
// إدارة باقات الأدمنز — عرض / رفع / تعطيل

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// الباقات المتاحة — غير مصدّرة عشان Next.js route ما يشتكيش
const PLAN_PRESETS = {
  free:       { name: 'مجاني',    maxDevices: 50, maxVouchersTotal: 1000000, canCreateUnlimited: false, canCreateNFC: false, canCreateQR: false, canRenewVouchers: false },
  basic:      { name: 'أساسي',    maxDevices: 50, maxVouchersTotal: 1000000, canCreateUnlimited: false, canCreateNFC: false, canCreateQR: true,  canRenewVouchers: true  },
  pro:        { name: 'احترافي',  maxDevices: 50, maxVouchersTotal: 1000000, canCreateUnlimited: true,  canCreateNFC: true,  canCreateQR: true,  canRenewVouchers: true  },
  enterprise: { name: 'مؤسسي',   maxDevices: 50, maxVouchersTotal: 1000000, canCreateUnlimited: true,  canCreateNFC: true,  canCreateQR: true,  canRenewVouchers: true  },
  custom:     null, // مخصص — يدوي
}

// GET — قائمة كل الأدمنز مع تفاصيل الباقة
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') // pending | active | suspended

  const where: any = {}
  if (status === 'pending')   where.isEmailVerified = false
  if (status === 'suspended') where.isActive = false
  if (status === 'active')    where.isActive = true

  const admins = await prisma.hotspotAdmin.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, username: true, email: true, phone: true,
      isActive: true, createdAt: true,
      maxDevices: true, maxVouchersTotal: true, totalVouchersGenerated: true,
      canCreateUnlimited: true, canCreateNFC: true, canCreateQR: true, canRenewVouchers: true,
      isEmailVerified: true, planName: true, planNote: true, planUpdatedAt: true,
      _count: { select: { devices: true, vouchers: true, saleRecords: true } },
    },
  })

  // احسب الـ plan لكل أدمن
  const result = admins.map(a => ({
    ...a,
    detectedPlan: detectPlan(a),
  }))

  return NextResponse.json(result)
}

// PATCH — تحديث باقة أو حالة أدمن
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { adminId, plan, isActive, maxDevices, maxVouchersTotal, canCreateUnlimited, canCreateNFC, canCreateQR, canRenewVouchers, planNote, approve } = body

  if (!adminId) return NextResponse.json({ error: 'missing adminId' }, { status: 400 })

  const updateData: any = {}

  // تفعيل / تعطيل
  if (isActive !== undefined)  updateData.isActive = isActive

  // الموافقة على تسجيل جديد
  if (approve) {
    updateData.isActive       = true
    updateData.isEmailVerified = true
  }

  // تطبيق باقة محددة مسبقاً
  if (plan && plan !== 'custom' && PLAN_PRESETS[plan as keyof typeof PLAN_PRESETS]) {
    const preset = PLAN_PRESETS[plan as keyof typeof PLAN_PRESETS] as any
    Object.assign(updateData, preset)
    updateData.planName = preset.name
    updateData.planUpdatedAt = new Date()
  }

  // تعديل يدوي
  if (maxDevices            !== undefined) updateData.maxDevices            = maxDevices
  if (maxVouchersTotal      !== undefined) updateData.maxVouchersTotal      = maxVouchersTotal
  if (canCreateUnlimited    !== undefined) updateData.canCreateUnlimited    = canCreateUnlimited
  if (canCreateNFC          !== undefined) updateData.canCreateNFC          = canCreateNFC
  if (canCreateQR           !== undefined) updateData.canCreateQR           = canCreateQR
  if (canRenewVouchers      !== undefined) updateData.canRenewVouchers      = canRenewVouchers
  if (planNote              !== undefined) updateData.planNote              = planNote
  if (!plan) updateData.planName = 'مخصص'

  updateData.planUpdatedAt = new Date()

  try {
    const admin = await prisma.hotspotAdmin.update({
      where: { id: adminId },
      data: updateData,
    })
    return NextResponse.json({ success: true, admin })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// حدد اسم الباقة من الإعدادات
function detectPlan(a: any): string {
  if (a.planName) return a.planName
  if (a.canCreateUnlimited && a.maxDevices >= 50) return 'مؤسسي'
  if (a.canCreateUnlimited && a.maxDevices >= 10) return 'احترافي'
  if (a.canCreateQR        && a.maxDevices >= 3)  return 'أساسي'
  return 'مجاني'
}
