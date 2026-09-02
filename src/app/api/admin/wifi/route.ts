// POST /api/admin/wifi
// تغيير اسم الـ WiFi على الراوتر عن طريق SSH
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'

export const dynamic = 'force-dynamic'

const execAsync = promisify(exec)

// بنبني الـ SSH command عشان نغير الـ SSID على OpenWrt
function buildSSHCommands(iface: string, newSSID: string): string {
  // uci = OpenWrt's unified configuration interface
  return [
    `uci set wireless.${iface}.ssid='${newSSID.replace(/'/g, "\\'")}'`,
    `uci commit wireless`,
    `wifi reload`,
  ].join(' && ')
}

export async function POST(req: NextRequest) {
  try {
    const { deviceId, newSSID } = await req.json()

    if (!deviceId || !newSSID?.trim())
      return NextResponse.json({ error: 'deviceId و newSSID مطلوبان' }, { status: 400 })

    if (newSSID.length > 32)
      return NextResponse.json({ error: 'اسم الـ WiFi لا يتجاوز 32 حرف' }, { status: 400 })

    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    if (!device)
      return NextResponse.json({ error: 'الجهاز غير موجود' }, { status: 404 })

    if (!device.sshPassword)
      return NextResponse.json({ error: 'SSH password غير محفوظ لهذا الجهاز' }, { status: 400 })

    const oldSSID = device.wifiSSID || ''

    // بناء SSH command باستخدام sshpass (لازم يكون مثبت على السيرفر)
    const commands = buildSSHCommands(device.wifiInterface, newSSID)
    const sshCmd   = [
      `sshpass -p '${device.sshPassword.replace(/'/g, "\\'")}'`,
      `ssh -o StrictHostKeyChecking=no`,
      `-o ConnectTimeout=10`,
      `-p ${device.sshPort}`,
      `${device.sshUsername}@${device.routerIp}`,
      `"${commands}"`,
    ].join(' ')

    let success = false
    let errorMsg = ''

    try {
      await execAsync(sshCmd, { timeout: 15000 })
      success = true
    } catch (e: any) {
      errorMsg = e.stderr || e.message || 'SSH error'
      console.error('[wifi change SSH error]', errorMsg)
    }

    // حدّث الـ DB بالـ SSID الجديد
    if (success) {
      await prisma.device.update({
        where: { id: deviceId },
        data:  { wifiSSID: newSSID },
      })
      // حدّث الـ portal settings كمان
      try {
        const desc = device.description ? JSON.parse(device.description) : {}
        desc.wifiName = newSSID
        await prisma.device.update({
          where: { id: deviceId },
          data: { description: JSON.stringify(desc) },
        })
      } catch {}
    }

    // سجّل في الـ log
    await prisma.wifiChangeLog.create({
      data: {
        deviceId,
        oldSSID,
        newSSID,
        success,
        error: errorMsg || null,
      },
    })

    if (success) {
      return NextResponse.json({ success: true, message: `تم تغيير اسم الـ WiFi إلى "${newSSID}"` })
    } else {
      return NextResponse.json({
        success: false,
        error:   'فشل الاتصال بالراوتر — تأكد من إعدادات SSH',
        details: errorMsg,
        // حتى لو فشل SSH، الـ DB اتحدث
        dbUpdated: false,
      }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET — سجل تغييرات الـ WiFi
export async function GET(req: NextRequest) {
  const deviceId = new URL(req.url).searchParams.get('deviceId')
  const logs = await prisma.wifiChangeLog.findMany({
    where: deviceId ? { deviceId } : {},
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json(logs)
}
