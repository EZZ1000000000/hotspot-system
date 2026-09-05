// GET  /api/portal/settings?gw_id=XXXX  ← جيب إعدادات بوابة جهاز معين
// POST /api/portal/settings              ← احفظ الإعدادات (من الداشبورد)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULTS = {
  placeName:     'WiFi Hotspot',
  wifiName:      'Free_WiFi',
  logoEmoji:     '📶',
  codeMinLength: 6,
  codeMaxLength: 100,
  allowManual:   true,
  allowNFC:      true,
  allowQR:       true,
}

// ─── GET ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const gatewayId = new URL(req.url).searchParams.get('gw_id')

    let device = null
    if (gatewayId) {
      device = await prisma.device.findUnique({
        where: { gatewayId },
        select: { name: true, wifiSSID: true, description: true },
      })
    }

    let settings = { ...DEFAULTS }

    // الإعدادات محفوظة في حقل description كـ JSON
    if (device?.description) {
      try {
        const stored = JSON.parse(device.description)
        settings = { ...DEFAULTS, ...stored }
      } catch {}
    }

    // اسم المكان واسم الـ WiFi من اسم الشبكة الثابت (wifiSSID)
    // اسم صفحة الهوت سبوت = اسم الشبكة — فالحقلين بيظهروا بنفس القيمة المضبوطة
    // (المصدر الوحيد للاسم = wifiSSID، ولو فاضي → اسم الجهاز)
    const networkName = (device?.wifiSSID || '').trim() || device?.name || ''
    if (networkName) {
      settings.placeName = networkName
      settings.wifiName  = networkName
    }

    return NextResponse.json(settings)
  } catch (err) {
    console.error('[portal/settings GET]', err)
    return NextResponse.json(DEFAULTS)
  }
}

// ─── POST ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      deviceId,
      placeName, wifiName, logoEmoji,
      codeMinLength, codeMaxLength,
      allowManual, allowNFC, allowQR,
    } = body

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId مطلوب' }, { status: 400 })
    }

    // validation
    if (codeMinLength < 1 || codeMaxLength < codeMinLength) {
      return NextResponse.json({ error: 'قيم طول الكود غير صحيحة' }, { status: 400 })
    }
    if (!allowManual && !allowNFC && !allowQR) {
      return NextResponse.json({ error: 'يجب تفعيل طريقة دخول واحدة على الأقل' }, { status: 400 })
    }
    // اسم الشبكة (الواي فاي + صفحة الهوت سبوت) — نفس الاسم في كل حتة ومش أطول من 32 حرف
    if (wifiName && String(wifiName).trim().length > 32) {
      return NextResponse.json({ error: 'اسم الشبكة لا يمكن أن يتجاوز 32 حرف' }, { status: 400 })
    }

    // احفظ الإعدادات: اسم الشبكة (wifiSSID) هو المصدر — بيتكتب من حقل اسم الـ WiFi
    // اسم الجهاز (name) بيتكتب من حقل اسم المكان — والصفحة بتعرض اسم الشبكة
    await prisma.device.update({
      where: { id: deviceId },
      data: {
        name:     String(placeName || '').trim() || undefined,
        wifiSSID: String(wifiName  || '').trim() || undefined,
        description: JSON.stringify({
          placeName,
          wifiName,
          logoEmoji:     logoEmoji     ?? '📶',
          codeMinLength: codeMinLength ?? 12,
          codeMaxLength: codeMaxLength ?? 19,
          allowManual:   allowManual   ?? true,
          allowNFC:      allowNFC      ?? true,
          allowQR:       allowQR       ?? true,
        }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[portal/settings POST]', err)
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'الجهاز غير موجود' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
