// GET /api/auth/me — يرجع بيانات الأدمن من google_session_id cookie
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const adminId = req.cookies.get('google_session_id')?.value
    if (!adminId) return NextResponse.json({ admin: null })

    const admin = await prisma.hotspotAdmin.findUnique({
      where: { id: adminId },
      select: {
        id: true, name: true, username: true,
        maxDevices: true, maxVouchersTotal: true,
        totalVouchersGenerated: true, isActive: true,
      },
    })

    if (!admin || !admin.isActive) return NextResponse.json({ admin: null })

    return NextResponse.json({ admin })
  } catch {
    return NextResponse.json({ admin: null })
  }
}
