// POST /api/admin/ssh
// تنفيذ أوامر SSH على الراوتر من السيستم
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// تنفيذ أمر SSH واحد
async function runSSH(
  ip: string, port: number, user: string, pass: string, command: string
): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  const escaped = command.replace(/"/g, '\\"')
  const sshCmd  = [
    `sshpass -p '${pass.replace(/'/g, "'\\''")}'`,
    `ssh -o StrictHostKeyChecking=no`,
    `-o ConnectTimeout=8`,
    `-o BatchMode=no`,
    `-p ${port}`,
    `${user}@${ip}`,
    `"${escaped}"`,
  ].join(' ')

  try {
    const { stdout, stderr } = await execAsync(sshCmd, { timeout: 15000 })
    return { stdout: stdout.trim(), stderr: stderr.trim(), ok: true }
  } catch (e: any) {
    return {
      stdout: e.stdout?.trim() || '',
      stderr: e.stderr?.trim() || e.message || 'SSH error',
      ok: false,
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { deviceId, command, action, value } = await req.json()
    if (!deviceId) return NextResponse.json({ error: 'deviceId مطلوب' }, { status: 400 })

    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    if (!device)         return NextResponse.json({ error: 'الجهاز غير موجود' }, { status: 404 })
    if (!device.sshPassword) return NextResponse.json({ error: 'SSH password غير محفوظ' }, { status: 400 })

    const { routerIp, sshPort, sshUsername, sshPassword } = device

    // ─── أوامر جاهزة ───────────────────────────────────
    let cmd = command || ''

    if (action === 'ping') {
      // ping من السيرفر للراوتر
      try {
        await execAsync(`ping -c 2 -W 2 ${routerIp}`, { timeout: 6000 })
        return NextResponse.json({ ok: true, output: `✅ ${routerIp} يستجيب` })
      } catch {
        return NextResponse.json({ ok: false, output: `❌ ${routerIp} لا يستجيب` })
      }
    }

    if (action === 'wifi_name') {
      // تغيير اسم الـ WiFi
      if (!value) return NextResponse.json({ error: 'اسم الـ WiFi مطلوب' }, { status: 400 })
      const safeSSID = value.replace(/'/g, "\\'").slice(0, 32)
      cmd = `uci set wireless.${device.wifiInterface || 'default_radio0'}.ssid='${safeSSID}' && uci commit wireless && wifi reload && echo "OK"`
    }

    if (action === 'get_info') {
      // معلومات الجهاز
      cmd = `echo "=== System ===" && uname -a && echo "=== WiFi ===" && uci show wireless 2>/dev/null | grep ssid && echo "=== Uptime ===" && uptime && echo "=== Memory ===" && free -m && echo "=== Disk ===" && df -h /`
    }

    if (action === 'get_wifi') {
      cmd = `uci show wireless 2>/dev/null | grep -E 'ssid|mode|channel|disabled'`
    }

    if (action === 'restart_wifidog') {
      cmd = `/etc/init.d/wifidog restart && echo "Restarted"`
    }

    if (action === 'stop_wifidog') {
      cmd = `/etc/init.d/wifidog stop && echo "Stopped"`
    }

    if (action === 'start_wifidog') {
      cmd = `/etc/init.d/wifidog start && echo "Started"`
    }

    if (action === 'status_wifidog') {
      cmd = `/etc/init.d/wifidog status 2>&1 || wdctl status 2>&1 || echo "wifidog not running"`
    }

    if (action === 'reboot') {
      cmd = `reboot`
    }

    if (!cmd) return NextResponse.json({ error: 'لا يوجد أمر' }, { status: 400 })

    const result = await runSSH(routerIp, sshPort, sshUsername, sshPassword!, cmd)

    // لو غيّرنا الـ SSID — حدّث الـ DB
    if (action === 'wifi_name' && result.ok) {
      await prisma.device.update({ where: { id: deviceId }, data: { wifiSSID: value } })
      try {
        const desc = device.description ? JSON.parse(device.description) : {}
        desc.wifiName = value
        await prisma.device.update({ where: { id: deviceId }, data: { description: JSON.stringify(desc) } })
      } catch {}
      await prisma.wifiChangeLog.create({
        data: { deviceId, oldSSID: device.wifiSSID || '', newSSID: value, success: true }
      })
    }

    return NextResponse.json({
      ok:     result.ok,
      output: result.stdout || result.stderr || '(لا يوجد output)',
      error:  result.ok ? null : result.stderr,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
