import { PrismaClient } from '@prisma/client'
const g = globalThis as any
const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
export const prisma: PrismaClient = g.prisma ?? new PrismaClient({
  log: ['error'],
  ...(url ? { datasources: { db: { url } } } : {}),
})
if (process.env.NODE_ENV !== 'production') g.prisma = prisma
