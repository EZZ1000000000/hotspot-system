import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ── /api/router/identity ─────────────────────────────────────────────
// الراوتر بيسأل: «إيه الاسم الرسمي بتاع الهوت سبوت ده؟»
// الاسم الرسمي = اسم الشبكة المحدد (wifiSSID) ولو فاضي → اسم الجهاز
// - بدون verbose: نص عادي (plain text) — سكربتات الراوتر بتقرأه مباشرة
// - ?verbose=1: JSON تشخيصي (الاسم + في HTML مخصص للبورتال ولا لا + حالة الجهاز)
// بيرجع "unknown" لما الجهاز مش موجود — السكربت بيتجاهلها بالتعليمات
// ─────────────────────────────────────────────────────────────────────

function canonicalName(d: { wifiSSID: string | null; name: string }): string {
  return (d.wifiSSID || '').trim() || d.name.trim()
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const gwId    = (sp.get('gw_id') || '').trim()
  const verbose = sp.get('verbose') === '1'

  if (!gwId) {
    return verbose
      ? NextResponse.json({ found: false, error: 'gw_id مطلوب' }, { status: 400 })
      : new NextResponse('unknown', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  try {
    const device = await prisma.device.findUnique({
      where: { gatewayId: gwId },
      select: {
        name: true, wifiSSID: true, portalHtml: true, isActive: true,
        lastPingAt: true, pingCount: true,
      },
    })

    if (!device) {
      return verbose
        ? NextResponse.json({ found: false, gatewayId: gwId })
        : new NextResponse('unknown', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    const name = canonicalName(device)

    if (verbose) {
      return NextResponse.json({
        found: true,
        gatewayId: gwId,
        deviceName: device.name,
        wifiSSID: device.wifiSSID || '',
        hotspotName: name,
        hasCustomPortal: !!device.portalHtml,   // لو true → اسم قديم ممكن يكون محفور جوه HTML مخصص
        isActive: device.isActive,
        lastPingAt: device.lastPingAt,
        pingCount: device.pingCount,
      })
    }

    return new NextResponse(name || 'unknown', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[router/identity]', err)
    return verbose
      ? NextResponse.json({ found: false, error: 'Server error' }, { status: 500 })
      : new NextResponse('unknown', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}
