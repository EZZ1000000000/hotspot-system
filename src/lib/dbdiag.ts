// تشخيص أخطاء قاعدة البيانات — كود + سبب مختصر ومنظّف بدون أي أسرار
// (أسماء المضيفين بتتستبدل بكلمة host بين قوسين، وأي كلمات مرور محتملة بتتخفي)
const HOST_MASK = '[' + 'host' + ']'

export function dbDiag(e: unknown): { code: string; brief: string } {
  const anyE = e as any
  const code = String(anyE?.code || anyE?.error_code || 'UNKNOWN')
  let brief = String(anyE?.message || e || 'unknown')
  brief = brief.replace(/(password|pwd|secret|token)=[^&\s]+/gi, '$1=[HIDDEN]')
  brief = brief.replace(/`[^`]*`/g, '`' + HOST_MASK + '`')
  brief = brief.replace(/\s+/g, ' ').trim().slice(0, 160)
  return { code, brief }
}
