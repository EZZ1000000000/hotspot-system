// =============================================
// SSH Service - التحكم في الراوتر عن بُعد
// =============================================
import { NodeSSH } from 'node-ssh'

export interface RouterConfig {
  host: string
  port: number
  username: string
  password: string
}

// تنفيذ أمر على الراوتر عبر SSH
export async function runOnRouter(config: RouterConfig, command: string) {
  const ssh = new NodeSSH()
  try {
    await ssh.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 10000,
    })
    const result = await ssh.execCommand(command)
    return { success: true, stdout: result.stdout, stderr: result.stderr }
  } catch (err: any) {
    return { success: false, error: err.message }
  } finally {
    ssh.dispose()
  }
}

// تغيير اسم الـ WiFi (SSID)
export async function changeSSID(config: RouterConfig, ssid: string, wifiInterface: string) {
  // في OpenWrt بنستخدم UCI لتغيير الإعدادات
  const commands = [
    // ابحث عن الـ wireless section المرتبطة بالـ interface
    `uci set wireless.${wifiInterface}.ssid='${ssid}'`,
    // احفظ
    `uci commit wireless`,
    // طبّق التغييرات
    `wifi reload`,
  ]
  const command = commands.join(' && ')
  return await runOnRouter(config, command)
}

// جلب اسم الـ WiFi الحالي
export async function getSSID(config: RouterConfig, wifiInterface: string) {
  const result = await runOnRouter(config, `uci get wireless.${wifiInterface}.ssid`)
  if (result.success) {
    return { success: true, ssid: result.stdout?.trim() }
  }
  return { success: false, error: result.error }
}

// جلب معلومات الراوتر
export async function getRouterInfo(config: RouterConfig) {
  const command = [
    'echo "UPTIME:$(cat /proc/uptime | cut -d. -f1)"',
    'echo "MEMFREE:$(cat /proc/meminfo | grep MemFree | awk \'{print $2}\')"',
    'echo "CLIENTS:$(cat /proc/net/arp | grep br-lan | wc -l)"',
    'echo "SSID:$(uci get wireless.@wifi-iface[0].ssid 2>/dev/null || echo unknown)"',
  ].join(' && ')

  const result = await runOnRouter(config, command)
  if (!result.success || !result.stdout) return { success: false, error: result.error }

  const lines = result.stdout.split('\n')
  const info: Record<string, string> = {}
  for (const line of lines) {
    const [key, val] = line.split(':')
    if (key && val) info[key.trim()] = val.trim()
  }

  return {
    success: true,
    uptime: parseInt(info.UPTIME || '0'),
    memFreeKB: parseInt(info.MEMFREE || '0'),
    connectedClients: parseInt(info.CLIENTS || '0'),
    ssid: info.SSID || 'unknown',
  }
}

// تغيير كلمة سر الـ WiFi
export async function changeWifiPassword(config: RouterConfig, password: string, wifiInterface: string) {
  const commands = [
    `uci set wireless.${wifiInterface}.key='${password}'`,
    `uci set wireless.${wifiInterface}.encryption='psk2'`,
    `uci commit wireless`,
    `wifi reload`,
  ]
  return await runOnRouter(config, commands.join(' && '))
}

// إعادة تشغيل wifidog
export async function restartWifidog(config: RouterConfig) {
  return await runOnRouter(config, '/etc/init.d/wifidog restart')
}

// تطبيق إعدادات السرعة
export async function applySpeedLimit(config: RouterConfig, mac: string, speedMbps: number) {
  const kbps = speedMbps * 1024
  const handle = mac.split(':').pop()?.toUpperCase() || 'FF'
  const commands = [
    `tc qdisc add dev br-lan root handle 1: htb default 10 2>/dev/null || true`,
    `tc class add dev br-lan parent 1: classid 1:${handle} htb rate ${kbps}kbit ceil ${kbps}kbit 2>/dev/null || true`,
    `tc filter add dev br-lan parent 1: protocol ip u32 match ether dst ${mac} flowid 1:${handle} 2>/dev/null || true`,
  ]
  return await runOnRouter(config, commands.join(' && '))
}
