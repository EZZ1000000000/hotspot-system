import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════
// GET/POST /api/router/report-script
//
// الراوتر بيبلّغ عن نسخة السكربت المركّبة عليه:
//   ?gw_id=GW-XXXX-XXXX&inst=3&wd=3&lanip=192.168.1.6
//
// inst = نسخة سكربت التسطيب الموحد (من /etc/hotspot-script-version)
//        0 أو ناقص = السكربت قديم أو مش متسجل (اللوحة تعرضه "محتاج تحديث")
// wd   = نسخة الحارس الذاتي (اختياري)
// lanip = العنوان الداخلي الحقيقي للراوتر (اختياري) — بيتحدث في Device.routerIp
//         عشان اللوحة تعرض العنوان الفعلي دايماً (المعيار: 192.168.1.6)
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
    // تشخيصات الحارس v9: حالة الراوتر من الداخل — بيساعد نكشف تسريبات «النت ببلاش» عن بُعد
    // clients = عدد العملاء في ذاكرة wifidog | ip6 = 1 لو قفل IPv6 شغال
    // tm = 1 لو TrustedMACList لسه موجودة | wupt = uptime بتاع wifidog نفسه
    // تشخيصات v10: fwd = 1 لو قواعد wifidog مربوطة فعلاً على FORWARD (قلب كشف «النت ببلاش»)
    // wdnat/wdfil = عدد قواعد wifidog في جدول nat/filter — wdfil كبير مع fwd=0 = «الفلتر اليتيم»
    const clients = (sp.get('clients') || '').replace(/[^0-9]/g, '').slice(0, 5)
    const ip6 = (sp.get('ip6') || '') === '1' ? 1 : 0
    const tm = (sp.get('tm') || '') === '1' ? 1 : 0
    const wupt = (sp.get('wupt') || '').replace(/[^0-9]/g, '').slice(0, 10)
    const fwd = (sp.get('fwd') || '') === '1' ? 1 : 0
    const wdnat = (sp.get('wdnat') || '').replace(/[^0-9]/g, '').slice(0, 4)
    const wdfil = (sp.get('wdfil') || '').replace(/[^0-9]/g, '').slice(0, 4)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null

    // العنوان الداخلي الحقيقي للراوتر (lanip) — بيجي من السكربت نفسه (192.168.1.6 المعيار الموحد)
    // بنحدّث routerIp في الجهاز مباشرة عشان اللوحة تعرض العنوان الحقيقي دايماً من غير أي تعديل يدوي
    const lanip = (sp.get('lanip') || '').trim()
    if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(lanip)) {
      try {
        await prisma.device.update({ where: { gatewayId: gwId }, data: { routerIp: lanip } })
      } catch {
        // الجهاز مش موجود أو خطأ مؤقت — مش مؤثر، التقرير الجاي هيعيد المحاولة
      }
    }

    const value = JSON.stringify({
      inst,
      wd: wd || null,
      at: new Date().toISOString(),
      ip,
      clients: clients || null,
      ip6,
      tm,
      wupt: wupt || null,
      fwd,
      wdnat: wdnat || null,
      wdfil: wdfil || null,
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
