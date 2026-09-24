// طبقة الاتصال بقاعدة البيانات — بروكسي ذكي عليه failover تلقائي
// لو القاعدة الأساسية ماتت بيقلب على القواعد الاحتياطية ويكمّل (تفاصيل: db-cluster.ts)
import { prisma } from './db-cluster'

export { prisma }
export default prisma
