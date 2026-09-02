// PATCH /api/superadmin/admins/update
// زيادة أو تعديل حدود الادمن في أي وقت
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest) {
  try {
    const { adminId, maxDevices, maxVouchersTotal, isActive } = await req.json()

    const admin = await prisma.hotspotAdmin.update({
      where: { id: adminId },
      data: {
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
