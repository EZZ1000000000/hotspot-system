// =============================================
// POST /api/admin/router
// التحكم في الراوتر عن بُعد عبر SSH
// =============================================
// actions:
//   info        - جلب معلومات الراوتر
//   change_ssid - تغيير اسم الـ WiFi
//   change_wifi_pass - تغيير كلمة سر الـ WiFi
//   restart_wifidog  - إعادة تشغيل wifidog
//   update_ssh  - تحديث بيانات SSH في الداتابيز
// =============================================
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  changeSSID, getRouterInfo, changeWifiPassword,
  restartWifidog, RouterConfig
} from '@/lib/ssh'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { deviceId, action, ...params } = body

    // جلب بيانات الجهاز
    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    if (!device) return NextResponse.json({ error: 'الجهاز غير موجود' }, { status: 404 })
    if (!device.sshPassword) return NextResponse.json({ error: 'كلمة سر SSH غير محددة' }, { status: 400 })

    const sshConfig: RouterConfig = {
      host: device.routerIp,
      port: device.sshPort,
      username: device.sshUsername,
      password: device.sshPassword,
    }

    switch (action) {
      case 'info': {
        const info = await getRouterInfo(sshConfig)
        // حدّث الـ SSID في الداتابيز لو جابه
        if (info.success && info.ssid && info.ssid !== 'unknown') {
          await prisma.device.update({
            where: { id: deviceId },
            data: { wifiSSID: info.ssid },
          })
        }
        return NextResponse.json(info)
      }

      case 'change_ssid': {
        const { ssid } = params
        if (!ssid || ssid.length < 1 || ssid.length > 32) {
          return NextResponse.json({ error: 'اسم الـ WiFi يجب أن يكون بين 1 و 32 حرف' }, { status: 400 })
        }
        const result = await changeSSID(sshConfig, ssid, device.wifiInterface)
        if (result.success) {
          // حدّث الداتابيز
          await prisma.device.update({
            where: { id: deviceId },
            data: { wifiSSID: ssid },
          })
          return NextResponse.json({ success: true, message: `تم تغيير اسم الـ WiFi إلى: ${ssid}` })
        }
        return NextResponse.json({ error: 'فشل تغيير الـ SSID: ' + result.error }, { status: 500 })
      }

      case 'change_wifi_pass': {
        const { password } = params
        if (!password || password.length < 8) {
          return NextResponse.json({ error: 'كلمة السر يجب أن تكون 8 أحرف على الأقل' }, { status: 400 })
        }
        const result = await changeWifiPassword(sshConfig, password, device.wifiInterface)
        if (result.success) {
          return NextResponse.json({ success: true, message: 'تم تغيير كلمة سر الـ WiFi' })
        }
        return NextResponse.json({ error: 'فشل تغيير كلمة السر: ' + result.error }, { status: 500 })
      }

      case 'restart_wifidog': {
        const result = await restartWifidog(sshConfig)
        return NextResponse.json({
          success: result.success,
          message: result.success ? 'تم إعادة تشغيل wifidog' : 'فشل: ' + result.error
        })
      }

      case 'update_ssh': {
        // تحديث بيانات SSH في الداتابيز
        const { routerIp, sshPort, sshUsername, sshPassword, wifiInterface } = params
        await prisma.device.update({
          where: { id: deviceId },
          data: {
            ...(routerIp && { routerIp }),
            ...(sshPort && { sshPort: parseInt(sshPort) }),
            ...(sshUsername && { sshUsername }),
            ...(sshPassword && { sshPassword }),
            ...(wifiInterface && { wifiInterface }),
          },
        })
        return NextResponse.json({ success: true, message: 'تم تحديث إعدادات SSH' })
      }

      default:
        return NextResponse.json({ error: 'action غير معروف' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[router control]', err)
    return NextResponse.json({ error: 'Server error: ' + err.message }, { status: 500 })
  }
}
