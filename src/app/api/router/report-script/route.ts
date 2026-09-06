import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════
// GET/POST /api/router/report-script
//
// الراوتر بيبلّغ عن نسخة السكربت المركّبة عليه:
//   ?gw_id=GW-XXXX-XXXX&inst=3&wd=3
//
// inst = نسخة سكربت التسطيب الموحد (من /etc/hotspot-script-version)
//        0 أو ناقص = السكربت قديم أو مش متسجل (اللوحة تعرضه "محتاج تحديث")
// wd   = نسخة الحارس الذاتي (اختياري)
//
// مكانه تخزينه: KeyValueStore (مفتاح: script-report:<gw_id>)
// — عمداً من غير تعديل في الـ schema عشان يشتغل على كل
//   الـ deployments فوراً من غير db push على أي قاعدة بيانات.
//
// بيرجع "OK" نص عادي — صالح لأي أداة على الراوتر (wget/uclient-fetch)
// ═══════════════════════════════════════════════════════════

function ok() {
  return new Response('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  })
}

async function record(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const gwId = (sp.get('gw_id') || '').trim()
    if (!gwId) return ok() // من غير gw_id مفيش حاجة نعملها — بس مفيش خطأ

    const inst = (sp.get('inst') || '0').replace(/[^0-9]/g, '').slice(0, 4) || '0'
    const wd = (sp.get('wd') || '').replace(/[^0-9]/g, '').slice(0, 4)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null

    const value = JSON.stringify({
      inst,
      wd: wd || null,
      at: new Date().toISOString(),
      ip,
    })

    await prisma.keyValueStore.upsert({
      where: { key: `script-report:${gwId}` },
      update: { value },
      create: { key: `script-report:${gwId}`, value },
    })
  } catch {
    // أي خطأ → نتجاهل — الراوتر هيحاول تاني في الدورة الجاية
  }
  return ok()
}

export async function GET(req: NextRequest) {
  return record(req)
}
export async function POST(req: NextRequest) {
  return record(req)
}
