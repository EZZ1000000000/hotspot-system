import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dbDiag } from '@/lib/dbdiag'
import { maskDbUrl } from '@/lib/fleet'

export const dynamic = 'force-dynamic'

// فحص صحة النظام — تستخدمه منصات الاستضافة (Render/Koyeb) كـ health check
// لما الداتابيز تكون واقفة بيرجع كود وسبب الخطأ الحقيقي (منظّف بدون أسرار)
// ملاحظة: الفحص بيعدي على بروكسي الحماية — لو القاعدة الأساسية ماتت وفيه
// قاعدة احتياطية مسجلة، الفحص نفسه بيشغّل القلب التلقائي ويرجع db=up
export async function GET() {
  let db = 'up'
  let dbCode: string | undefined
  let dbBrief: string | undefined
  const primaryUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || ''
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (e) {
    db = 'down'
    const d = dbDiag(e)
    dbCode = d.code
    dbBrief = d.brief
  }
  // معلومات الحماية — بدون فحوصات إضافية عشان الـ health يفضل سريع
  const g = globalThis as any
  const envStandbys = (process.env.STANDBY_DB_URLS || '').split(/[,\n]+/).filter((s: string) => s.startsWith('postgres')).length
  return NextResponse.json({
    status: 'ok',
    db,
    ...(db === 'down' ? { dbCode, dbBrief } : {}),
    cluster: {
      active: maskDbUrl(g.__dbActiveUrl || primaryUrl || null),
      failoverActive: !!g.__dbActiveUrl && !!primaryUrl && g.__dbActiveUrl !== primaryUrl,
      envStandbys,
      lastEvent: g.__dbLastEvent || null,
    },
    service: 'hotspot-system',
    time: new Date().toISOString(),
  })
}
