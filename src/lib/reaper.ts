// =============================================
// reaper.ts — حصاد الجلسات الشبح
//
// الجلسة ACTIVE اللي ما وصلهاش counters من الراوتر لأكتر من 10 دقايق
// = العميل مش متصل فعلاً (الراوتر بيبعت counters لكل عميل متصل كل دقيقة)
//
// ليه ده مهم؟
//  1) أرقام "الأجهزة المتصلة" في اللوحة تبقى حقيقية (كانت بتضخم ×20)
//  2) قفل باب ركوب الجلسات: جلسة شبح حالتها ACTIVE ممكن أي عميل جديد
//     يركب عليها لو اتركل فيها بالـ IP — الحصاد بيقتلها قبل ما تفيد حد
//
// كان زمان شغال من server.js (السيرفر القديم) — على Vercel مفيش cron
// فبيتنادي جنب الـ ping بتاع الراوترات وجنب محاولات الدخول (بخنق داخلي)
// =============================================
import { prisma } from './prisma'

const IDLE_CUTOFF_MS = 10 * 60 * 1000   // صمت 10 دقايق = الجلسة ميتة
const THROTTLE_MS    = 2 * 60 * 1000    // أقصى مرة كل دقيقتين لكل نسخة سيرفر
let lastRun = 0

export async function reapIdleSessions(): Promise<number> {
  const now = Date.now()
  if (now - lastRun < THROTTLE_MS) return 0
  lastRun = now
  try {
    const r = await prisma.session.updateMany({
      where: { status: 'ACTIVE', lastPingAt: { lt: new Date(now - IDLE_CUTOFF_MS) } },
      data:  { status: 'ENDED', endedAt: new Date(), endReason: 'IDLE_TIMEOUT' },
    })
    return r.count
  } catch {
    // الحصاد خدمة نظافة مش شرط للحياة — أي فشل ما يوقفش مسار الدخول
    return 0
  }
}
