// تشخيص أخطاء قاعدة البيانات — كود + سبب مختصر ومنظّف بدون أي أسرار
// (أسماء المضيفين بتتستبدل بكلمة host بين قوسين، وأي كلمات مرور محتملة بتتخفي)
const HOST_MASK = '[' + 'host' + ']'

export function dbDiag(e: unknown): { code: string; brief: string } {
  // فك الغلاف: كتير من أخطاء Prisma بتيجي متغلفة جوه cause، والكود الحقيقي (P1001 مثلا) جوه الرسالة
  let cur: any = e
  for (let i = 0; i < 5 && cur?.cause; i++) cur = cur.cause
  const anyE = cur || (e as any)
  let brief = String(anyE?.message || e || 'unknown')
  const code = String(anyE?.code || anyE?.error_code || brief.match(/P1\d{3}/)?.[0] || 'DB_ERROR')
  brief = brief.replace(/(password|pwd|secret|token)=[^&\s]+/gi, '$1=[HIDDEN]')
  brief = brief.replace(/`[^`]*`/g, '`' + HOST_MASK + '`')
  brief = brief.replace(/\s+/g, ' ').trim().slice(0, 160)
  return { code, brief }
}
