// GET /api/superadmin/device-status?deviceId=xxx  — فحص جهاز واحد
// GET /api/superadmin/device-status?adminId=xxx   — فحص كل أجهزة أدمن
// GET /api/superadmin/device-status               — فحص كل الأجهزة
//
// التشخيص مبني على الـ Heartbeat الحقيقي: الراوتر بيبعت /api/wifidog/ping كل CheckInterval (60ث)
// فالقراءة دي أصدق من أي ping صناعي من السيرفر — لو آخر ping قديم يبقى الراوتر فعلاً مفصول
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// الحدود الزمنية بالثواني (CheckInterval = 60ث → ping كل دقيقة)
const ONLINE_SEC   = 180    // ≤ 3 دقايق = متصل (نسمح بـ 2 ping فاتوا)
const DEGRADED_SEC = 900    // 3–15 دقيقة = اتصال ضعيف/متقطع، > 15 = مفصول

type Level = 'online' | 'degraded' | 'offline' | 'never'

const fmtAgo = (sec: number) => {
  if (sec < 60)      return `${Math.round(sec)} ثانية`
  if (sec < 3600)    return `${Math.round(sec / 60)} دقيقة`
  if (sec < 86400)   return `${Math.round(sec / 3600)} ساعة`
  return `${Math.round(sec / 86400)} يوم`
}
const fmtUptime = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}ي ${h}س`
  if (h > 0) return `${h}س ${m}د`
  return `${m}د`
}

interface Fault { type: string; msg: string; severity: 'critical' | 'warning' | 'info' }

function diagnose(d: {
  isActive: boolean
  lastPingAt: Date | null
  sysUptime: number | null
  sysMemfree: number | null
  sysLoad: number | null
  wifidogUptime: number | null
  activeSessions: number
}): { level: Level; online: boolean; faults: Fault[]; lastPingAgoSec: number | null } {
  const faults: Fault[] = []
  const now = Date.now()

  // ── 0. الجهاز متوقف من اللوحة؟ ──
  if (!d.isActive) {
    faults.push({ type: 'DISABLED', msg: 'الجهاز متوقّف من لوحة التحكم — مش بياخد مستخدمين جداد', severity: 'info' })
  }

  // ── 1. Heartbeat ──
  let level: Level = 'never'
  let lastPingAgoSec: number | null = null
  if (!d.lastPingAt) {
    level = 'never'
    faults.push({
      type: 'NEVER_CONNECTED',
      msg: 'الراوتر عمره ما بعت ping للسيرفر — سكربت wifidog مش متسطّب أو الإنترنت مش واصل للراوتر',
      severity: 'critical',
    })
  } else {
    lastPingAgoSec = Math.max(0, (now - new Date(d.lastPingAt).getTime()) / 1000)
    if (lastPingAgoSec <= ONLINE_SEC)        level = 'online'
    else if (lastPingAgoSec <= DEGRADED_SEC) level = 'degraded'
    else                                     level = 'offline'

    if (level === 'offline') {
      faults.push({
        type: 'OFFLINE',
        msg: `الراوتر مفصول عن السيرفر من ${fmtAgo(lastPingAgoSec)} — افحص خط الإنترنت عند الكافيه أو الراوتر نفسه`,
        severity: 'critical',
      })
    } else if (level === 'degraded') {
      faults.push({
        type: 'DEGRADED',
        msg: `اتصال ضعيف أو متقطع — آخر تواصل قبل ${fmtAgo(lastPingAgoSec)} (المفروض كل دقيقة)`,
        severity: 'warning',
      })
    }
  }

  // ── 2. خدمة wifidog اتعاد تشغيلها؟ (الراوتر شغال بس خدمة wifidog عمرها قصير) ──
  if (d.sysUptime && d.wifidogUptime !== null && d.wifidogUptime !== undefined) {
    if (d.sysUptime > 1800 && d.wifidogUptime < Math.min(d.sysUptime, 600)) {
      faults.push({
        type: 'WIFIDOG_RESTARTED',
        msg: `خدمة wifidog اتعاد تشغيلها (شغالة ${fmtUptime(d.wifidogUptime)} والراوتر شغال ${fmtUptime(d.sysUptime)}) — غالباً crash أو restart`,
        severity: 'warning',
      })
    }
  }

  // ── 3. الذاكرة الحرة على الراوتر ──
  if (d.sysMemfree !== null && d.sysMemfree !== undefined && d.sysMemfree < 8000) {
    faults.push({
      type: 'LOW_MEMORY',
      msg: `الذاكرة الحرة على الراوتر قليلة جداً (${Math.round(d.sysMemfree / 1024)} MB) — ممكن يحصل تجمّد`,
      severity: 'warning',
    })
  }

  // ── 4. حمل المعالج ──
  if (d.sysLoad !== null && d.sysLoad !== undefined && d.sysLoad > 3000) {
    faults.push({
      type: 'HIGH_LOAD',
      msg: `حمل عالي على معالج الراوتر (${(d.sysLoad / 1000).toFixed(1)}) — ممكن يبطّئ الشبكة`,
      severity: 'warning',
    })
  }

  // ── 5. جلسات مفتوحة على DB بس الجهاز مفصول ──
  if ((level === 'offline' || level === 'never') && d.activeSessions > 0) {
    faults.push({
      type: 'STALE_SESSIONS',
      msg: `فيه ${d.activeSessions} جلسة مفتوحة على النظام بس الجهاز مفصول — هتتقفل تلقائياً بعد 10 دقايق بدون نشاط`,
      severity: 'info',
    })
  }

  return {
    level,
    online: level === 'online',
    faults,
    lastPingAgoSec: lastPingAgoSec === null ? null : Math.round(lastPingAgoSec),
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const deviceId = searchParams.get('deviceId')
    const adminId  = searchParams.get('adminId')

    const where = deviceId ? { id: deviceId } : adminId ? { hotspotAdminId: adminId } : {}

    const devices = await prisma.device.findMany({
      where,
      select: {
        id: true, name: true, gatewayId: true, isActive: true, routerIp: true,
        lastPingAt: true, lastPingIp: true, sysUptime: true, sysMemfree: true,
        sysLoad: true, wifidogUptime: true, pingCount: true,
        hotspotAdmin: { select: { name: true, username: true } },
      },
      orderBy: { isActive: 'desc' },
    })

    // عدد الجلسات النشطة لكل جهاز — استعلام واحد
    const sessionGroups = await prisma.session.groupBy({
      by: ['deviceId'],
      where: { status: 'ACTIVE' },
      _count: { id: true },
    })
    const activeByDevice: Record<string, number> = {}
    sessionGroups.forEach(g => { activeByDevice[g.deviceId] = g._count.id })

    const results = devices.map(d => {
      const diag = diagnose({
        isActive: d.isActive,
        lastPingAt: d.lastPingAt,
        sysUptime: d.sysUptime,
        sysMemfree: d.sysMemfree,
        sysLoad: d.sysLoad,
        wifidogUptime: d.wifidogUptime,
        activeSessions: activeByDevice[d.id] || 0,
      })
      return {
        deviceId: d.id,
        name: d.name,
        gatewayId: d.gatewayId,
        adminName: d.hotspotAdmin?.name || null,
        isActive: d.isActive,
        lastPingAt: d.lastPingAt,
        lastPingIp: d.lastPingIp,
        sysUptime: d.sysUptime,
        sysMemfree: d.sysMemfree,
        sysLoad: d.sysLoad,
        wifidogUptime: d.wifidogUptime,
        pingCount: d.pingCount,
        activeSessions: activeByDevice[d.id] || 0,
        ...diag,
      }
    })

    // ترتيب: الأعطال الحرجة الأول، بعدين التدهور، بعدين السليم
    const order: Record<Level, number> = { never: 0, offline: 1, degraded: 2, online: 3 }
    results.sort((a, b) => order[a.level] - order[b.level] || a.name.localeCompare(b.name))

    if (deviceId) return NextResponse.json(results[0] || { error: 'Not found' }, { status: results[0] ? 200 : 404 })
    return NextResponse.json({
      devices: results,
      summary: {
        total:     results.length,
        online:    results.filter(r => r.level === 'online').length,
        degraded:  results.filter(r => r.level === 'degraded').length,
        offline:   results.filter(r => r.level === 'offline').length,
        never:     results.filter(r => r.level === 'never').length,
        faulted:   results.filter(r => r.faults.some(f => f.severity !== 'info')).length,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
