import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// فحص صحة النظام — تستخدمه منصات الاستضافة (Render/Koyeb) كـ health check
export async function GET() {
  let db = 'up'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    db = 'down'
  }
  return NextResponse.json({
    status: 'ok',
    db,
    service: 'hotspot-system',
    time: new Date().toISOString(),
  })
}
