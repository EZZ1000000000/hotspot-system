// GET /api/superadmin/all-devices — جلب كل الأجهزة (للسوبر أدمن فقط)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const devices = await prisma.device.findMany({
      select: {
        id:          true,
        name:        true,
        gatewayId:   true,
        wifiSSID:    true,
        isActive:    true,
        portalHtml:  true,
        hotspotAdmin: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(devices)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
