import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dbDiag } from '@/lib/dbdiag'

export const dynamic = 'force-dynamic'

// فحص صحة النظام — تستخدمه منصات الاستضافة (Render/Koyeb) كـ health check
// لما الداتابيز تكون واقفة بيرجع كود وسبب الخطأ الحقيقي (منظّف بدون أسرار)
export async function GET() {
  let db = 'up'
  let dbCode: string | undefined
  let dbBrief: string | undefined
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (e) {
    db = 'down'
    const d = dbDiag(e)
    dbCode = d.code
    dbBrief = d.brief
  }
  return NextResponse.json({
    status: 'ok',
    db,
    ...(db === 'down' ? { dbCode, dbBrief } : {}),
    service: 'hotspot-system',
    time: new Date().toISOString(),
  })
}
