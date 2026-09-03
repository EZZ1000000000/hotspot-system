import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/devices/{id} — تعديل بيانات الجهاز (الاسم / SSID / الموقع)
// لو الـ wifiSSID اتغير → الراوتر هياخده تلقائيًا خلال 5 دقايق (hotspot-ssid-sync)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const data: Record<string, string> = {}

    if (typeof body.name === 'string' && body.name.trim())         data.name     = body.name.trim()
    if (typeof body.wifiSSID === 'string' && body.wifiSSID.trim()) data.wifiSSID = body.wifiSSID.trim()
    if (typeof body.location === 'string')                         data.location = body.location

    if (Object.keys(data).length === 0)
      return NextResponse.json({ error: 'مفيش حقول للتحديث (name / wifiSSID / location)' }, { status: 400 })

    const device = await prisma.device.update({
      where: { id: params.id },
      data,
    })

    // نرجّع الجهاز من غير الحقول الحساسة
    const { sshPassword: _sp, portalHtml: _ph, ...safe } = device as Record<string, unknown>
    return NextResponse.json({ success: true, device: safe })
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'الجهاز غير موجود' }, { status: 404 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
