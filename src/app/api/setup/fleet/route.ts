// GET /api/setup/fleet
// صفحة سكريبتات الإعداد — بتجمع الأدمنز + الأجهزة من كل السيرفرات (4 نشرات) في رد واحد
// عشان الصفحة تعرض سكربت إعداد كل جهاز على كل سيرفر في مكان واحد
// + حالة كل سيرفر (شغال/واقف) — أساس خاصية تبديل السيرفرات وقت المشاكل
//
// - السيرفر الحالي: قراءة مباشرة من قاعدة البيانات (أسرع وبكل التفاصيل)
// - باقي السيرفرات: fetch لـ /api/superadmin/admins + /api/admin/devices بتاعتهم (server-side — مفيش CORS)

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
// أطول مهلة مسموحة — السيرفرات البعيدة ممكن تكون باردة (Neon cold start)
export const maxDuration = 60

const SERVERS = [
  { key: 'gamma', label: 'السيرفر الرئيسي', url: 'https://hotspot-system-gamma.vercel.app' },
  { key: 'kappa', label: 'سيرفر الشعلة',   url: 'https://hotspot-system-kappa.vercel.app' },
  { key: 'dun',   label: 'سيرفر السرايا',  url: 'https://hotspot-system-dun.vercel.app' },
  { key: 'seven', label: 'سيرفر البرنس',   url: 'https://hotspot-system-seven.vercel.app' },
]

// تحديد مفتاح السيرفر الحالي من متغيرات البيئة
function detectSelfKey(): string {
  const selfUrl = (process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/$/, '')
  const match = SERVERS.find(s => selfUrl && s.url === selfUrl)
  if (match) return match.key
  // fallback: VERCEL_URL (اسم النشرة) فيه عادة اسم المشروع
  const vurl = (process.env.VERCEL_URL || '').toLowerCase()
  const m2 = SERVERS.find(s => vurl.includes(`hotspot-system-${s.key}`))
  return m2 ? m2.key : 'gamma'
}

type AnyAdmin = Record<string, unknown>

// اختصار الأدمن للحقول المهمة للواجهة
function pickAdmin(a: AnyAdmin) {
  return {
    id:       a.id as string,
    name:     a.name as string,
    username: a.username as string,
    email:    (a.email as string) || null,
    isActive: a.isActive as boolean,
    _count:   (a._count as { devices?: number; vouchers?: number }) || { devices: 0, vouchers: 0 },
  }
}

// جلب أدمنز + أجهزة سيرفر بعيد (كل أدمن بأجهزته)
async function fetchRemoteServer(sv: { key: string; label: string; url: string }) {
  try {
    const res = await fetch(`${sv.url}/api/superadmin/admins`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(22_000),
    })
    const admins = await res.json()
    if (!Array.isArray(admins)) throw new Error('رد غير متوقع من السيرفر')

    const withDevices = await Promise.all(admins.map(async (a: AnyAdmin) => {
      try {
        const dr = await fetch(`${sv.url}/api/admin/devices?adminId=${a.id}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(22_000),
        })
        const devices = await dr.json()
        return { ...pickAdmin(a), devices: Array.isArray(devices) ? devices : [] }
      } catch {
        return { ...pickAdmin(a), devices: [] as unknown[], devicesError: true }
      }
    }))

    return { ...sv, ok: true as const, error: null, admins: withDevices }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'فشل الاتصال بالسيرفر'
    return { ...sv, ok: false as const, error: msg, admins: [] as never[] }
  }
}

export async function GET() {
  const selfKey = detectSelfKey()

  // 1) السيرفر الحالي — من قاعدة البيانات مباشرة (بأجهزتها وعداداتها)
  let selfAdmins: unknown[] = []
  let selfOk = true
  let selfError: string | null = null
  try {
    const rows = await prisma.hotspotAdmin.findMany({
      select: {
        id: true, name: true, username: true, email: true, isActive: true,
        maxDevices: true, maxVouchersTotal: true, superAdminId: true, createdAt: true,
        devices: {
          select: {
            id: true, name: true, gatewayId: true, routerIp: true, wifiSSID: true,
            location: true, isActive: true, gatewayInterface: true, externalInterface: true,
            clientTimeout: true, tunnelPort: true, createdAt: true,
            _count: { select: { sessions: true, vouchers: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { vouchers: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    selfAdmins = rows
    // ── تقارير نسخة السكربت (script-report:<gatewayId> من KeyValueStore) ──
    // نفس شكل /api/admin/devices — عشان شارة "محدّث / محتاج تحديث" تشتغل
    // على أجهزة السيرفر الحالي زي أجهزة السيرفرات الباقية بالظبط
    try {
      const allDevices = (rows as { devices?: { gatewayId: string }[] }[]).flatMap(a => a.devices || [])
      const reports = await prisma.keyValueStore.findMany({
        where: { key: { in: allDevices.map(d => `script-report:${d.gatewayId}`) } },
      })
      const byGw = new Map<string, unknown>()
      for (const r of reports) {
        const gw = r.key.replace('script-report:', '')
        try { byGw.set(gw, JSON.parse(r.value)) } catch {}
      }
      selfAdmins = (rows as { devices?: unknown[] }[]).map(a => ({
        ...a,
        devices: ((a.devices || []) as Record<string, unknown>[]).map(d => ({
          ...d,
          scriptReport: byGw.get(String(d.gatewayId)) || null,
        })),
      }))
    } catch {}
  } catch (e: unknown) {
    selfOk = false
    selfError = e instanceof Error ? e.message : 'خطأ في قاعدة البيانات المحلية'
  }

  // 2) باقي السيرفرات — بالتوازي
  const others = SERVERS.filter(s => s.key !== selfKey)
  const remotes = await Promise.all(others.map(fetchRemoteServer))

  const selfSv = SERVERS.find(s => s.key === selfKey)!
  const servers = [
    { ...selfSv, ok: selfOk, error: selfError, self: true,  admins: selfAdmins },
    ...remotes.map(r => ({ ...r, self: false })),
  ] as { key: string; label: string; url: string; ok: boolean; error: string | null; self: boolean; admins: { devices?: unknown[] }[] }[]

  const totalAdmins  = servers.reduce((n, s) => n + s.admins.length, 0)
  const totalDevices = servers.reduce((n, s) => n + s.admins.reduce((m, a) => m + (a.devices?.length || 0), 0), 0)
  const okCount      = servers.filter(s => s.ok).length

  return NextResponse.json({
    selfKey,
    servers,
    totalAdmins,
    totalDevices,
    okServers: okCount,
    serverCount: servers.length,
    fetchedAt: new Date().toISOString(),
  })
}
