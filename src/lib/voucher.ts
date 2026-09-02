// =============================================
// voucher.ts — منطق الكارت الموحد
//
// ── منطق الوقت ──────────────────────────────
// timeLimitMin = المدة الكلية من أول استخدام (مش من وقت التوليد)
// يعني لو الكارت ساعة:
//   - المستخدم فتح الساعة 10 → الكارت ينتهي الساعة 11
//   - لو خرج الساعة 10:30 ورجع الساعة 10:45 → يكمل عادي
//   - لو رجع الساعة 11:05 → انتهى الوقت ✗
//   - الداتا مش شرط تخلص — الوقت هو اللي يحكم (ايهما أقرب)
// =============================================

const CHARSET_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const CHARSET_NUMBERS = '23456789'
const CHARSET_MIX     = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type CodeType = 'letters' | 'numbers' | 'mix'

export function generateVoucherCode(
  type: CodeType = 'mix',
  totalLength = 16   // الطول الإجمالي للكود (بدون الشرطات)
): string {
  const charset = type === 'letters' ? CHARSET_LETTERS
    : type === 'numbers' ? CHARSET_NUMBERS
    : CHARSET_MIX

  // توليد الأحرف بالطول المطلوب
  const chars = Array.from(
    { length: Math.max(4, totalLength) },
    () => charset[Math.floor(Math.random() * charset.length)]
  )

  // قسّم على مجموعات كل 4 حروف
  const groups: string[] = []
  for (let i = 0; i < chars.length; i += 4) {
    groups.push(chars.slice(i, i + 4).join(''))
  }
  return groups.join('-')
}

export function generateBatchCodes(
  count: number,
  type: CodeType = 'mix',
  codeLength = 16
): string[] {
  const codes = new Set<string>()
  while (codes.size < count) codes.add(generateVoucherCode(type, codeLength))
  return Array.from(codes)
}

// ── isVoucherDepleted ────────────────────────────────────────────────────────
// timeUsedMin = الوقت الفعلي اللي استهلكه (من auth-handler — cumulative من startedAt)
// timeLimitMin = الحد الكلي (قد يزيد بالـ rewards)
// منطق الوقت: لو timeUsedMin >= timeLimitMin → انتهى
// مهم: الوقت بيستمر حتى لو الجهاز خرج من الشبكة (لأنه بيتحسب من startedAt)
export function isVoucherDepleted(voucher: {
  packageType:  string
  dataLimitMB:  number | null
  timeLimitMin: number | null
  dataUsedMB:   number
  timeUsedMin:  number
  expiresAt:    Date | null
}): { depleted: boolean; reason: 'DATA_DEPLETED' | 'TIME_EXPIRED' | null } {
  const now = new Date()

  // فحص تاريخ الانتهاء المطلق (تاريخ من التقويم)
  if (voucher.expiresAt && now > voucher.expiresAt)
    return { depleted: true, reason: 'TIME_EXPIRED' }

  // فحص الداتا (لو الباقة داتا أو داتا+وقت)
  if (
    voucher.packageType !== 'TIME_ONLY' &&
    voucher.dataLimitMB !== null &&
    voucher.dataUsedMB >= voucher.dataLimitMB
  ) return { depleted: true, reason: 'DATA_DEPLETED' }

  // فحص الوقت (لو الباقة وقت أو داتا+وقت)
  // timeUsedMin = الوقت المنقضي من بداية أول جلسة (حتى لو الجهاز خرج وعاد)
  if (
    voucher.packageType !== 'DATA_ONLY' &&
    voucher.timeLimitMin !== null &&
    voucher.timeUsedMin >= voucher.timeLimitMin
  ) return { depleted: true, reason: 'TIME_EXPIRED' }

  return { depleted: false, reason: null }
}

export const bytesToMB = (bytes: number) => bytes / 1024 / 1024
export const mbToBytes = (mb: number)    => mb * 1024 * 1024
