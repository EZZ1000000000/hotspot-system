// PATCH /api/superadmin/admins/update
// زيادة أو تعديل حدود الادمن في أي وقت + تغيير اسم الكافيه (الاسم المعروض)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest) {
  try {
    const { adminId, name, maxDevices, maxVouchersTotal, isActive } = await req.json()

    // اسم الكافيه (الاسم المعروض) — لو اتحدّث لازم ميبقاش فاضي
    const newName = (name !== undefined && name !== null) ? String(name).trim() : undefined
    if (newName === '') return NextResponse.json({ error: 'الاسم مينفعش يبقى فاضي' }, { status: 400 })

    const admin = await prisma.hotspotAdmin.update({
      where: { id: adminId },
      data: {
        ...(newName !== undefined && { name: newName }),
        ...(maxDevices !== undefined && { maxDevices }),
        ...(maxVouchersTotal !== undefined && { maxVouchersTotal }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ success: true, admin })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
