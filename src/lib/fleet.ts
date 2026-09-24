// ═══ معلومات أسطول السيرفرات (Gamma / Kappa / Dun / Seven) ═══
// بتستخدمها طبقة الحماية: النسخ الاحتياطي المتبادل + الاسترجاع الذاتي بين السيرفرات
export const FLEET: Record<string, { url: string; label: string }> = {
  gamma: { url: 'https://hotspot-system-gamma.vercel.app',  label: 'السيرفر الرئيسي (ليالينا)' },
  kappa: { url: 'https://hotspot-system-kappa.vercel.app',  label: 'سيرفر الشعلة' },
  dun:   { url: 'https://hotspot-system-dun.vercel.app',    label: 'سيرفر السرايا' },
  seven: { url: 'https://hotspot-system-seven.vercel.app',  label: 'سيرفر البرنس' },
}
export const FLEET_KEYS = Object.keys(FLEET)

export function cronSecret(): string {
  return process.env.CRON_SECRET || 'hotspot-cron-2024'
}

// مفتاح السيرفر الحالي — من SERVER_KEY env أو الاستنتاج من اسم الدومين
export function serverKey(): string {
  const forced = process.env.SERVER_KEY
  if (forced && FLEET[forced]) return forced
  const host = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_SERVER_URL || ''
  if (host.includes('kappa')) return 'kappa'
  if (host.includes('dun'))   return 'dun'
  if (host.includes('seven')) return 'seven'
  return 'gamma'
}

// إخفاء كلمة السر من أي رابط قاعدة قبل عرضه/تسجيله
export function maskDbUrl(url?: string | null): string {
  if (!url) return '—'
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.username || 'user'}:***@${u.host}${u.pathname}`
  } catch { return '[bad-url]' }
}
