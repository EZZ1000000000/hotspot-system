// GET /api/superadmin/aggregate
// بيجمع كل الكافيهات من كل السيرفرات (الأربع نشرات) في رد واحد
// عشان لوحة السوبر أدمن تقدر تعرض كل الكافيهات في مكان واحد
//
// - السيرفر الحالي: قراءة مباشرة من قاعدة البيانات (أسرع)
// - باقي السيرفرات: fetch للـ /api/superadmin/admins بتاعتهم (server-side — مفيش CORS)
//
// ملاحظة: لو ضفت سيرفر جديد، ضيفه هنا في OTHER_SERVERS

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
// أطول مهلة مسموحة — السيرفرات البعيدة ممكن تكون باردة (Neon cold start)
export const maxDuration = 60

const SELF = {
  key:    process.env.SERVER_KEY || 'gamma',
  label:  'الرئيسي',
  url:    process.env.NEXT_PUBLIC_SERVER_URL || 'https://hotspot-system-gamma.vercel.app',
}

const OTHER_SERVERS = [
  { key: 'kappa', label: 'سيرفر الشعلة',  url: 'https://hotspot-system-kappa.vercel.app' },
  { key: 'dun',   label: 'سيرفر السرايا', url: 'https://hotspot-system-dun.vercel.app' },
  { key: 'seven', label: 'سيرفر البرنس',  url: 'https://hotspot-system-seven.vercel.app' },
]

type AggAdmin = Record<string, unknown>

async function fetchRemote(server: { key: string; label: string; url: string }) {
  try {
    const res = await fetch(`${server.url}/api/superadmin/admins`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    })
    const admins = await res.json()
    if (!Array.isArray(admins)) throw new Error('رد غير متوقع من السيرفر')
    return { ...server, ok: true as const, admins: admins as AggAdmin[], error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'فشل الاتصال'
    return { ...server, ok: false as const, admins: [] as AggAdmin[], error: msg }
  }
}

export async function GET() {
  // 1) السيرفر الحالي — من قاعدة البيانات مباشرة
  let selfAdmins: AggAdmin[] = []
  let selfOk = true
  let selfError: string | null = null
  try {
    const rows = await prisma.hotspotAdmin.findMany({
      include: { _count: { select: { devices: true, vouchers: true } } },
      orderBy: { createdAt: 'desc' },
    })
    selfAdmins = rows.map(({ password: _pw, ...a }) => a)
  } catch (e: unknown) {
    selfOk = false
    selfError = e instanceof Error ? e.message : 'خطأ في قاعدة البيانات'
  }

  // 2) باقي السيرفرات — بالتوازي
  const remotes = await Promise.all(OTHER_SERVERS.map(fetchRemote))

  const servers = [
    { ...SELF, ok: selfOk, self: true,  admins: selfAdmins, error: selfError },
    ...remotes.map(r => ({ ...r, self: false })),
  ]

  return NextResponse.json({
    servers,
    totalCafes: servers.reduce((n, s) => n + s.admins.length, 0),
    fetchedAt: new Date().toISOString(),
  })
}
