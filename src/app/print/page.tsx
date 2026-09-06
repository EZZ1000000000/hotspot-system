'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Voucher = {
  id: string; code: string
  dataLimitMB: number|null; timeLimitMin: number|null
  speedLimitMbps: number|null; maxUsageCount: number
  packageType: string; qrPayload?: string
}

const fmt = {
  data: (mb: number|null) => !mb ? '∞' : mb >= 1024 ? (mb/1024).toFixed(1)+'GB' : mb+'MB',
  time: (m:  number|null) => !m  ? '∞' : m  >= 60   ? `${Math.floor(m/60)}س${m%60?m%60+'د':''}` : m+'د',
}
const cleanCode = (c: string) => c.replace(/[-–—]/g,'')

const TEMPLATES = [
  { id:'dark',       name:'🌑 داكن'        },
  { id:'blue',       name:'🔵 أزرق'        },
  { id:'purple',     name:'🟣 بنفسجي'      },
  { id:'green',      name:'🟢 أخضر'        },
  { id:'minimal',    name:'⬜ بسيط'        },
  { id:'receipt',    name:'🧾 إيصال'       },
  { id:'ticket',     name:'🎫 تذكرة'       },
  { id:'elegant',    name:'✨ ذهبي'        },
  { id:'neon',       name:'💜 نيون'        },
  { id:'ocean',      name:'🌊 أوشن'        },
  { id:'sunset',     name:'🌅 سنست'       },
  { id:'retro',      name:'📟 ريترو'      },
  { id:'cafe',       name:'☕ كافيه'       },
  { id:'midnight',   name:'🌙 منتصف الليل' },
  { id:'coral',      name:'🪸 كورال'       },
  { id:'forest',     name:'🌿 غابة'        },
  { id:'galaxy',     name:'🌌 جالاكسي'     },
  { id:'candy',      name:'🍬 كاندي'       },
  { id:'mono',       name:'🖤 مونو'        },
  { id:'fire',       name:'🔥 فاير'        },
  { id:'social_fb',  name:'📘 فيسبوك'     },
  { id:'social_ig',  name:'📸 إنستجرام'   },
  { id:'social_tw',  name:'🐦 تويتر/X'    },
  { id:'social_yt',  name:'▶️ يوتيوب'     },
  { id:'social_wa',  name:'💬 واتساب'     },
  { id:'social_tk',  name:'🎵 تيك توك'    },
  { id:'vip',        name:'👑 VIP'         },
  { id:'paper',      name:'📄 ورقي'        },
  { id:'bubble',     name:'🫧 فقاعة'       },
  { id:'matrix',     name:'🟩 ماتريكس'    },
]

// ── توليد HTML كارت لكل قالب (inline styles فقط، لا CSS classes) ──────────
function buildCardHTML(v: Voucher, t: string, biz: string, logo: string, showQR: boolean, noSep: boolean): string {
  const code = noSep ? cleanCode(v.code) : v.code
  const qrValue = encodeURIComponent(v.qrPayload || `code:${v.code}`)
  const qrImg = showQR ? `<div style="display:flex;justify-content:center;margin-top:6px"><img src="https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=${qrValue}&bgcolor=ffffff&color=000000&margin=2" width="64" height="64" style="border-radius:4px" /></div>` : ''

  const specs: string[] = []
  if (v.dataLimitMB)    specs.push(`📊${fmt.data(v.dataLimitMB)}`)
  if (v.timeLimitMin)   specs.push(`⏱${fmt.time(v.timeLimitMin)}`)
  if (v.speedLimitMbps) specs.push(`⚡${v.speedLimitMbps}M`)
  if (v.maxUsageCount>1) specs.push(`👥${v.maxUsageCount}`)
  const specsHTML = specs.length ? `<div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:2px;font-size:10px">${specs.map(s=>`<span>${s}</span>`).join('')}</div>` : ''

  const B = `font-family:Cairo,Arial,sans-serif;break-inside:avoid;page-break-inside:avoid;width:100%;box-sizing:border-box`

  if (t==='dark') return `<div style="${B};background:#0d1b2a;border:1px solid #1e3d5c;border-radius:12px;padding:12px 10px;color:white">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:10px;color:#4a90d9;font-weight:700;letter-spacing:1px">WiFi ACCESS</span><span style="font-size:15px">${logo}</span></div>
    ${biz?`<div style="font-size:12px;font-weight:900;color:#00d4ff;text-align:center;margin-bottom:6px">${biz}</div>`:''}
    <div style="background:#0a1628;border:1px dashed #1e3d5c;border-radius:8px;padding:6px;text-align:center;margin-bottom:6px">
      <div style="font-size:9px;color:#4a90d9;margin-bottom:2px">كود الدخول</div>
      <div style="font-size:15px;font-family:monospace;font-weight:900;color:#00d4ff;letter-spacing:${noSep?1:2}px">${code}</div>
    </div>
    <div style="color:#7ab3d4">${specsHTML}</div>${qrImg}</div>`

  if (t==='blue') return `<div style="${B};background:white;border:2px solid #1a56db;border-radius:10px;overflow:hidden">
    <div style="background:#1a56db;padding:7px 10px;text-align:center"><div style="color:white;font-weight:900;font-size:12px">${logo} ${biz||'WiFi Voucher'}</div></div>
    <div style="padding:8px 10px">
      <div style="border:2px dashed #1a56db;border-radius:8px;padding:6px;text-align:center;margin-bottom:6px;background:#eff6ff">
        <div style="font-size:9px;color:#1e40af;margin-bottom:2px">كود الدخول</div>
        <div style="font-size:15px;font-family:monospace;font-weight:900;color:#1a56db;letter-spacing:${noSep?1:2}px">${code}</div>
      </div>
      <div style="color:#374151">${specsHTML}</div>${qrImg}</div></div>`

  if (t==='purple') return `<div style="${B};background:linear-gradient(135deg,#667eea,#764ba2);border-radius:12px;padding:12px 10px;color:white">
    ${biz?`<div style="font-size:11px;font-weight:900;text-align:center;margin-bottom:6px;opacity:.9">${logo} ${biz}</div>`:''}
    <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:6px;text-align:center;margin-bottom:6px">
      <div style="font-size:9px;opacity:.7;margin-bottom:2px">كود الواي فاي</div>
      <div style="font-size:15px;font-family:monospace;font-weight:900;letter-spacing:${noSep?1:2}px">${code}</div>
    </div>
    <div style="font-size:10px;opacity:.85">${specsHTML}</div>${qrImg}</div>`

  if (t==='green') return `<div style="${B};background:linear-gradient(135deg,#11998e,#38ef7d);border-radius:12px;padding:12px 10px;color:white">
    ${biz?`<div style="font-size:11px;font-weight:900;text-align:center;margin-bottom:6px">${logo} ${biz}</div>`:''}
    <div style="background:rgba(0,0,0,0.15);border-radius:8px;padding:6px;text-align:center;margin-bottom:6px">
      <div style="font-size:9px;opacity:.8;margin-bottom:2px">WiFi Code</div>
      <div style="font-size:15px;font-family:monospace;font-weight:900;letter-spacing:${noSep?1:2}px">${code}</div>
    </div>
    <div style="font-size:10px">${specsHTML}</div>${qrImg}</div>`

  if (t==='minimal') return `<div style="${B};background:white;border:1px solid #e5e7eb;border-radius:8px;padding:10px">
    ${biz?`<div style="font-size:10px;color:#9ca3af;margin-bottom:4px;text-align:center">${logo} ${biz}</div>`:''}
    <div style="font-size:15px;font-family:monospace;font-weight:900;color:#111827;letter-spacing:${noSep?1:2}px;text-align:center;padding:5px 0;border-top:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6;margin-bottom:5px">${code}</div>
    <div style="font-size:10px;color:#6b7280;text-align:center">${specsHTML}</div>${qrImg}</div>`

  if (t==='receipt') return `<div style="${B};background:#fffef0;border:1px dashed #d4c89a;border-radius:4px;padding:8px 10px;font-family:monospace">
    <div style="text-align:center;border-bottom:1px dashed #d4c89a;margin-bottom:6px;padding-bottom:5px">
      <div style="font-size:12px;font-weight:900;color:#333">${logo} ${biz||'WiFi'}</div></div>
    <div style="text-align:center;margin-bottom:6px">
      <div style="font-size:10px;color:#666;margin-bottom:2px">كود الدخول:</div>
      <div style="font-size:16px;font-weight:900;color:#111;letter-spacing:${noSep?1:3}px">${code}</div>
    </div>
    <div style="border-top:1px dashed #d4c89a;padding-top:5px;font-size:9px;color:#666">
      ${v.dataLimitMB?`<div>داتا: ${fmt.data(v.dataLimitMB)}</div>`:''}
      ${v.timeLimitMin?`<div>وقت: ${fmt.time(v.timeLimitMin)}</div>`:''}
      ${v.speedLimitMbps?`<div>سرعة: ${v.speedLimitMbps}Mbps</div>`:''}
    </div>${qrImg}</div>`

  if (t==='ticket') return `<div style="${B};background:white;border:2px solid #111;display:flex;overflow:hidden">
    <div style="background:#111;width:7px;flex-shrink:0"></div>
    <div style="flex:1;padding:8px 10px;border-right:2px dashed #ccc;margin-right:7px">
      ${biz?`<div style="font-size:10px;font-weight:900;color:#111;margin-bottom:3px">${logo} ${biz}</div>`:''}
      <div style="font-size:14px;font-family:monospace;font-weight:900;color:#111;letter-spacing:${noSep?1:2}px;margin-bottom:4px">${code}</div>
      <div style="font-size:9px;color:#555">${specsHTML}</div>${qrImg}
    </div>
    <div style="width:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <div style="font-size:8px;color:#555;transform:rotate(90deg);white-space:nowrap">WiFi PASS</div>
    </div></div>`

  if (t==='elegant') return `<div style="${B};background:white;border:1px solid #c9a84c;border-radius:8px;padding:10px;position:relative">
    <div style="position:absolute;top:3px;right:3px;left:3px;height:2px;background:linear-gradient(90deg,#c9a84c,#f0d080,#c9a84c);border-radius:1px"></div>
    <div style="position:absolute;bottom:3px;right:3px;left:3px;height:2px;background:linear-gradient(90deg,#c9a84c,#f0d080,#c9a84c);border-radius:1px"></div>
    ${biz?`<div style="font-size:11px;font-weight:900;color:#92701a;text-align:center;margin-bottom:6px;margin-top:3px">${logo} ${biz}</div>`:''}
    <div style="border:1px solid #e8d5a3;border-radius:5px;padding:6px;text-align:center;margin-bottom:6px;background:#fffdf5">
      <div style="font-size:9px;color:#b8861d;margin-bottom:2px;letter-spacing:2px">WIFI ACCESS CODE</div>
      <div style="font-size:14px;font-family:monospace;font-weight:900;color:#92701a;letter-spacing:${noSep?1:2}px">${code}</div>
    </div>
    <div style="font-size:10px;color:#b8861d;text-align:center">${specsHTML}</div>${qrImg}</div>`

  if (t==='neon') return `<div style="${B};background:#0a0015;border:1px solid #9333ea;border-radius:12px;padding:12px 10px;color:white">
    <div style="text-align:center;margin-bottom:6px">
      <span style="font-size:20px">${logo}</span>
      ${biz?`<div style="font-size:11px;font-weight:900;color:#c084fc;margin-top:3px">${biz}</div>`:''}
    </div>
    <div style="background:rgba(147,51,234,0.15);border:1px solid #7c3aed;border-radius:8px;padding:8px;text-align:center;margin-bottom:6px">
      <div style="font-size:8px;color:#c084fc;margin-bottom:3px;letter-spacing:2px">◈ WIFI CODE ◈</div>
      <div style="font-size:16px;font-family:monospace;font-weight:900;color:#e879f9;letter-spacing:${noSep?2:3}px">${code}</div>
    </div>
    <div style="font-size:10px;color:#c084fc;text-align:center">${specsHTML}</div>${qrImg}</div>`

  if (t==='ocean') return `<div style="${B};background:linear-gradient(160deg,#0f2444,#1a4a7a);border-radius:12px;padding:12px 10px;color:white;border:1px solid #2a6aaa">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:12px">🌊🐟🌊</div>
      <span style="font-size:11px;color:#7dd3fc;font-weight:700">${logo} ${biz}</span>
    </div>
    <div style="background:rgba(0,180,255,0.12);border:1px solid rgba(125,211,252,0.4);border-radius:8px;padding:8px;text-align:center;margin-bottom:6px">
      <div style="font-size:9px;color:#7dd3fc;margin-bottom:2px">🌐 FREE WiFi</div>
      <div style="font-size:15px;font-family:monospace;font-weight:900;color:#e0f7ff;letter-spacing:${noSep?1:2}px">${code}</div>
    </div>
    <div style="display:flex;justify-content:space-around;font-size:10px;color:#7dd3fc">
      <span>${fmt.data(v.dataLimitMB)}</span><span>${fmt.time(v.timeLimitMin)}</span>
      ${v.speedLimitMbps?`<span>⚡${v.speedLimitMbps}M</span>`:''}
    </div>${qrImg}</div>`

  if (t==='sunset') return `<div style="${B};background:linear-gradient(135deg,#1a0533,#6b1a3a,#c0392b);border-radius:12px;padding:12px 10px;color:white">
    ${biz?`<div style="font-size:11px;font-weight:900;text-align:center;margin-bottom:6px;color:#ffd6a5">${logo} ${biz}</div>`:''}
    <div style="background:rgba(255,180,0,0.12);border:1px solid rgba(255,200,100,0.4);border-radius:8px;padding:8px;text-align:center;margin-bottom:6px">
      <div style="font-size:9px;color:#ffd6a5;margin-bottom:2px">🌅 WiFi Pass</div>
      <div style="font-size:15px;font-family:monospace;font-weight:900;color:#ffe8c0;letter-spacing:${noSep?1:2}px">${code}</div>
    </div>
    <div style="font-size:10px;color:#ffd6a5;text-align:center">${specsHTML}</div>${qrImg}</div>`

  if (t==='retro') return `<div style="${B};background:#1a1a1a;border:2px solid #00ff41;border-radius:4px;padding:10px 12px;font-family:'Courier New',monospace;color:#00ff41">
    <div style="border-bottom:1px solid #00ff41;margin-bottom:6px;padding-bottom:5px">
      <div style="font-size:10px;letter-spacing:3px">&gt;&gt;&gt; ${biz||'WIFI ACCESS'}</div>
    </div>
    <div style="text-align:center;margin-bottom:6px">
      <div style="font-size:8px;opacity:.7;margin-bottom:3px">// PASSWORD //</div>
      <div style="font-size:14px;font-weight:900;letter-spacing:${noSep?2:3}px;color:#39ff14">${code}</div>
    </div>
    <div style="font-size:9px;opacity:.8">
      ${v.dataLimitMB?`<div>&gt; DATA: ${fmt.data(v.dataLimitMB)}</div>`:''}
      ${v.timeLimitMin?`<div>&gt; TIME: ${fmt.time(v.timeLimitMin)}</div>`:''}
      ${v.speedLimitMbps?`<div>&gt; SPEED: ${v.speedLimitMbps}Mbps</div>`:''}
    </div>${qrImg}</div>`

  if (t==='cafe') return `<div style="${B};background:#fdf8f0;border:1px solid #c8a876;border-radius:10px;overflow:hidden">
    <div style="background:#4a2c0a;padding:7px;text-align:center">
      <span style="font-size:16px">☕</span>
      ${biz?`<span style="color:#f5c842;font-weight:900;font-size:12px;margin-right:6px"> ${biz}</span>`:''}
    </div>
    <div style="padding:8px 10px">
      <div style="text-align:center;margin-bottom:6px">
        <div style="font-size:9px;color:#8b6914;margin-bottom:3px">~ كود الواي فاي ~</div>
        <div style="font-size:15px;font-family:monospace;font-weight:900;color:#3d1a08;letter-spacing:${noSep?1:2}px;background:#fff8e8;padding:4px 8px;border-radius:5px;border:1px dashed #c8a876">${code}</div>
      </div>
      <div style="font-size:9px;color:#8b6914;text-align:center">${specsHTML}</div>
      <div style="display:flex;justify-content:center;gap:4px;margin-top:5px;font-size:11px">📸 📘 🐦 💬</div>
      ${qrImg}
    </div></div>`

  if (t==='midnight') return `<div style="${B};background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);border-radius:12px;padding:12px 10px;color:white">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
      <span style="font-size:18px">🌙</span>
      ${biz?`<span style="font-size:12px;font-weight:900;color:#a78bfa">${biz}</span>`:''}
    </div>
    <div style="background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.35);border-radius:8px;padding:8px;text-align:center;margin-bottom:6px">
      <div style="font-size:9px;color:#a78bfa;margin-bottom:2px;letter-spacing:2px">✦ NIGHT PASS ✦</div>
      <div style="font-size:15px;font-family:monospace;font-weight:900;color:#e9d5ff;letter-spacing:${noSep?1:2}px">${code}</div>
    </div>
    <div style="font-size:10px;color:#c4b5fd;text-align:center">${specsHTML}</div>${qrImg}</div>`

  if (t==='coral') return `<div style="${B};background:white;border:2px solid #ff6b6b;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#ff6b6b,#feca57);padding:8px 10px;text-align:center">
      <div style="color:white;font-weight:900;font-size:13px">${logo} ${biz||'Free WiFi'}</div>
    </div>
    <div style="padding:8px 10px">
      <div style="background:#fff5f5;border:2px dashed #ff6b6b;border-radius:8px;padding:6px;text-align:center;margin-bottom:6px">
        <div style="font-size:9px;color:#ee5a24;margin-bottom:2px">🪸 كود الاتصال</div>
        <div style="font-size:15px;font-family:monospace;font-weight:900;color:#ee5a24;letter-spacing:${noSep?1:2}px">${code}</div>
      </div>
      <div style="font-size:10px;color:#555;text-align:center">${specsHTML}</div>${qrImg}</div></div>`

  if (t==='forest') return `<div style="${B};background:linear-gradient(135deg,#1a3a2a,#2d5a3d);border-radius:12px;padding:12px 10px;color:white;border:1px solid #3d7a52">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
      <span style="font-size:16px">🌿</span>
      ${biz?`<span style="font-size:11px;font-weight:900;color:#86efac">${biz}</span>`:''}
      <span style="margin-right:auto;font-size:11px">🌲🍃</span>
    </div>
    <div style="background:rgba(0,0,0,0.2);border:1px solid rgba(134,239,172,0.3);border-radius:8px;padding:8px;text-align:center;margin-bottom:6px">
      <div style="font-size:9px;color:#86efac;margin-bottom:2px">🌱 WIFI PASS</div>
      <div style="font-size:15px;font-family:monospace;font-weight:900;color:#d1fae5;letter-spacing:${noSep?1:2}px">${code}</div>
    </div>
    <div style="font-size:10px;color:#86efac;text-align:center">${specsHTML}</div>${qrImg}</div>`

  if (t==='galaxy') return `<div style="${B};background:radial-gradient(ellipse at top,#1a1060,#0a0a1a);border-radius:12px;padding:12px 10px;color:white;border:1px solid #4a3f8a">
    <div style="text-align:center;margin-bottom:8px">
      <div style="font-size:14px">🌌 ✨ 🌟</div>
      ${biz?`<div style="font-size:11px;font-weight:900;color:#a78bfa;margin-top:3px">${biz}</div>`:''}
    </div>
    <div style="background:rgba(99,102,241,0.15);border:1px solid rgba(139,92,246,0.4);border-radius:8px;padding:8px;text-align:center;margin-bottom:6px">
      <div style="font-size:8px;color:#a78bfa;margin-bottom:3px;letter-spacing:3px">✦ GALAXY PASS ✦</div>
      <div style="font-size:16px;font-family:monospace;font-weight:900;color:#c4b5fd;letter-spacing:${noSep?1:2}px">${code}</div>
    </div>
    <div style="font-size:10px;color:#a78bfa;text-align:center">${specsHTML}</div>${qrImg}</div>`

  if (t==='candy') return `<div style="${B};background:white;border-radius:16px;overflow:hidden;border:3px solid #fd79a8">
    <div style="background:linear-gradient(135deg,#fd79a8,#a29bfe,#74b9ff);padding:8px;text-align:center">
      <div style="font-size:14px">🍬 🍭 🍬</div>
      ${biz?`<div style="color:white;font-weight:900;font-size:11px;margin-top:2px">${biz}</div>`:''}
    </div>
    <div style="padding:8px 10px">
      <div style="background:linear-gradient(135deg,#ffeaa7,#fab1d3);border-radius:10px;padding:8px;text-align:center;margin-bottom:6px">
        <div style="font-size:9px;color:#6c5ce7;margin-bottom:2px;font-weight:700">🔑 كود السكر</div>
        <div style="font-size:15px;font-family:monospace;font-weight:900;color:#6c5ce7;letter-spacing:${noSep?1:2}px">${code}</div>
      </div>
      <div style="font-size:10px;color:#636e72;text-align:center">${specsHTML}</div>${qrImg}</div></div>`

  if (t==='mono') return `<div style="${B};background:#111;border:1px solid #444;border-radius:6px;padding:10px 12px;color:white;font-family:monospace">
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:10px;color:#888">
      <span>WIFI VOUCHER</span><span>${logo}</span>
    </div>
    ${biz?`<div style="font-size:11px;color:#ccc;margin-bottom:6px;border-bottom:1px solid #333;padding-bottom:5px">${biz}</div>`:''}
    <div style="background:#000;border:1px solid #333;padding:8px;text-align:center;margin-bottom:6px;border-radius:4px">
      <div style="font-size:15px;font-weight:900;color:white;letter-spacing:${noSep?2:4}px">${code}</div>
    </div>
    <div style="font-size:9px;color:#666">
      ${v.dataLimitMB?`<div>DATA.........${fmt.data(v.dataLimitMB)}</div>`:''}
      ${v.timeLimitMin?`<div>TIME.........${fmt.time(v.timeLimitMin)}</div>`:''}
      ${v.speedLimitMbps?`<div>SPEED........${v.speedLimitMbps}Mbps</div>`:''}
    </div>${qrImg}</div>`

  if (t==='fire') return `<div style="${B};background:linear-gradient(135deg,#1a0000,#5c1010,#8b2000);border-radius:12px;padding:12px 10px;color:white;border:1px solid #c0392b">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
      <span style="font-size:18px">🔥</span>
      ${biz?`<span style="font-size:12px;font-weight:900;color:#ffa07a">${biz}</span>`:''}
      <span style="margin-right:auto;font-size:11px">🔥🌋🔥</span>
    </div>
    <div style="background:rgba(255,100,0,0.15);border:1px solid rgba(255,100,0,0.4);border-radius:8px;padding:8px;text-align:center;margin-bottom:6px">
      <div style="font-size:9px;color:#ffa07a;margin-bottom:2px;letter-spacing:1px">🔥 HOT WIFI PASS</div>
      <div style="font-size:16px;font-family:monospace;font-weight:900;color:#ff6347;letter-spacing:${noSep?1:2}px">${code}</div>
    </div>
    <div style="font-size:10px;color:#ffa07a;text-align:center">${specsHTML}</div>${qrImg}</div>`

  if (t==='social_fb') return `<div style="${B};background:white;border-radius:12px;overflow:hidden;border:1px solid #1877f2">
    <div style="background:#1877f2;padding:8px 10px;display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">📘</span>
      <div><div style="color:white;font-weight:900;font-size:12px">${biz||'Facebook WiFi'}</div>
      <div style="color:rgba(255,255,255,0.75);font-size:9px">تابعنا على فيسبوك</div></div>
    </div>
    <div style="padding:8px 10px">
      <div style="border:2px dashed #1877f2;border-radius:8px;padding:6px;text-align:center;margin-bottom:6px;background:#f0f2f5">
        <div style="font-size:9px;color:#1877f2;margin-bottom:2px">🔐 كود الواي فاي</div>
        <div style="font-size:15px;font-family:monospace;font-weight:900;color:#1877f2;letter-spacing:${noSep?1:2}px">${code}</div>
      </div>
      <div style="font-size:10px;color:#65676b;text-align:center">${specsHTML}</div>${qrImg}
      <div style="font-size:9px;color:#65676b;text-align:center;margin-top:5px">📘 شيّر بعد الاتصال!</div>
    </div></div>`

  if (t==='social_ig') return `<div style="${B};background:white;border-radius:12px;overflow:hidden;border:1px solid #e1306c">
    <div style="background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);padding:8px 10px;display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">📸</span>
      <div><div style="color:white;font-weight:900;font-size:12px">${biz||'Instagram WiFi'}</div>
      <div style="color:rgba(255,255,255,0.8);font-size:9px">تابعنا على إنستجرام</div></div>
    </div>
    <div style="padding:8px 10px">
      <div style="border-radius:8px;padding:6px;text-align:center;margin-bottom:6px;background:#fafafa;border:1px solid #dbdbdb">
        <div style="font-size:9px;color:#8e8e8e;margin-bottom:2px">🔐 كود الواي فاي</div>
        <div style="font-size:15px;font-family:monospace;font-weight:900;color:#dc2743;letter-spacing:${noSep?1:2}px">${code}</div>
      </div>
      <div style="font-size:10px;color:#8e8e8e;text-align:center">${specsHTML}</div>${qrImg}
      <div style="font-size:9px;color:#8e8e8e;text-align:center;margin-top:5px">📸 شارك تجربتك معنا</div>
    </div></div>`

  if (t==='social_tw') return `<div style="${B};background:#000;border-radius:12px;padding:12px 10px;color:white;border:1px solid #333">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="font-size:20px">𝕏</span>
      <div><div style="font-size:12px;font-weight:900;color:white">${biz||'X WiFi'}</div>
      <div style="font-size:9px;color:#71767b">تابعنا على X</div></div>
    </div>
    <div style="background:#16181c;border:1px solid #2f3336;border-radius:8px;padding:8px;text-align:center;margin-bottom:6px">
      <div style="font-size:9px;color:#71767b;margin-bottom:2px">🔐 كود الواي فاي</div>
      <div style="font-size:15px;font-family:monospace;font-weight:900;color:#1d9bf0;letter-spacing:${noSep?1:2}px">${code}</div>
    </div>
    <div style="font-size:10px;color:#71767b;text-align:center">${specsHTML}</div>${qrImg}
    <div style="font-size:9px;color:#1d9bf0;text-align:center;margin-top:5px">𝕏 غرّد عن تجربتك</div></div>`

  if (t==='social_yt') return `<div style="${B};background:white;border-radius:12px;overflow:hidden;border:1px solid #ff0000">
    <div style="background:#ff0000;padding:8px 10px;display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">▶️</span>
      <div><div style="color:white;font-weight:900;font-size:12px">${biz||'YouTube WiFi'}</div>
      <div style="color:rgba(255,255,255,0.8);font-size:9px">اشترك في قناتنا 🔔</div></div>
    </div>
    <div style="padding:8px 10px">
      <div style="border:2px dashed #ff0000;border-radius:8px;padding:6px;text-align:center;margin-bottom:6px;background:#fff5f5">
        <div style="font-size:9px;color:#cc0000;margin-bottom:2px">🔐 كود الواي فاي</div>
        <div style="font-size:15px;font-family:monospace;font-weight:900;color:#cc0000;letter-spacing:${noSep?1:2}px">${code}</div>
      </div>
      <div style="font-size:10px;color:#606060;text-align:center">${specsHTML}</div>${qrImg}</div></div>`

  if (t==='social_wa') return `<div style="${B};background:white;border-radius:12px;overflow:hidden;border:1px solid #25d366">
    <div style="background:#075e54;padding:8px 10px;display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">💬</span>
      <div><div style="color:white;font-weight:900;font-size:12px">${biz||'WhatsApp WiFi'}</div>
      <div style="color:rgba(255,255,255,0.8);font-size:9px">تواصل معنا</div></div>
    </div>
    <div style="padding:8px 10px">
      <div style="border:2px dashed #25d366;border-radius:8px;padding:6px;text-align:center;margin-bottom:6px;background:#f0fdf4">
        <div style="font-size:9px;color:#075e54;margin-bottom:2px">🔐 كود الواي فاي</div>
        <div style="font-size:15px;font-family:monospace;font-weight:900;color:#128c7e;letter-spacing:${noSep?1:2}px">${code}</div>
      </div>
      <div style="font-size:10px;color:#555;text-align:center">${specsHTML}</div>${qrImg}
      <div style="font-size:9px;color:#25d366;text-align:center;margin-top:5px">💬 تواصل عبر واتساب</div>
    </div></div>`

  if (t==='social_tk') return `<div style="${B};background:#010101;border-radius:12px;padding:12px 10px;color:white;border:1px solid #333">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="font-size:20px">🎵</span>
      <div><div style="font-size:12px;font-weight:900;color:white">${biz||'TikTok WiFi'}</div>
      <div style="font-size:9px;color:#888">تابعنا على تيك توك</div></div>
    </div>
    <div style="background:#161616;border:1px solid #333;border-radius:8px;padding:8px;text-align:center;margin-bottom:6px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#69C9D0,#EE1D52)"></div>
      <div style="font-size:9px;color:#888;margin-bottom:2px">🔐 كود الواي فاي</div>
      <div style="font-size:15px;font-family:monospace;font-weight:900;letter-spacing:${noSep?1:2}px;color:#69C9D0">${code}</div>
    </div>
    <div style="font-size:10px;color:#888;text-align:center">${specsHTML}</div>${qrImg}
    <div style="font-size:9px;text-align:center;margin-top:5px;color:#69C9D0">🎵 اعمل duet معنا!</div></div>`

  if (t==='vip') return `<div style="${B};background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);border-radius:12px;padding:14px 12px;color:white;border:2px solid #e2b96a">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:8px;color:#e2b96a;letter-spacing:3px;font-weight:700">V I P</div>
      <span style="font-size:18px">👑</span>
      <div style="font-size:8px;color:#e2b96a;letter-spacing:3px;font-weight:700">PASS</div>
    </div>
    ${biz?`<div style="font-size:12px;font-weight:900;color:#ffd700;text-align:center;margin-bottom:8px;letter-spacing:1px">${biz}</div>`:''}
    <div style="background:rgba(226,185,106,0.08);border:1px solid rgba(226,185,106,0.35);border-radius:8px;padding:8px;text-align:center;margin-bottom:8px">
      <div style="font-size:8px;color:#e2b96a;margin-bottom:3px;letter-spacing:3px">ACCESS CODE</div>
      <div style="font-size:16px;font-family:monospace;font-weight:900;color:#ffd700;letter-spacing:${noSep?2:3}px">${code}</div>
    </div>
    <div style="font-size:10px;color:#e2b96a;text-align:center">${specsHTML}</div>
    <div style="margin-top:8px;height:1px;background:linear-gradient(90deg,transparent,#e2b96a,transparent)"></div>
    ${qrImg}</div>`

  if (t==='paper') return `<div style="${B};background:#f5f0e8;border-radius:4px;padding:12px;font-family:Georgia,serif;border:1px solid #d4c5a9">
    <div style="text-align:center;margin-bottom:8px">
      ${biz?`<div style="font-size:13px;font-weight:700;color:#4a3728;margin-bottom:4px">${logo} ${biz}</div>`:''}
      <div style="height:1px;background:linear-gradient(90deg,transparent,#b8a89a,transparent);margin-bottom:8px"></div>
    </div>
    <div style="text-align:center;background:white;border:1px solid #d4c5a9;padding:8px;margin-bottom:8px;border-radius:2px">
      <div style="font-size:9px;color:#8b7355;margin-bottom:4px;letter-spacing:1px">رمز الدخول</div>
      <div style="font-size:16px;font-family:'Courier New',monospace;font-weight:900;color:#2c1810;letter-spacing:${noSep?2:4}px">${code}</div>
    </div>
    <div style="font-size:9px;color:#8b7355;display:flex;justify-content:space-around">
      ${v.dataLimitMB?`<span>📊 ${fmt.data(v.dataLimitMB)}</span>`:''}
      ${v.timeLimitMin?`<span>⏱ ${fmt.time(v.timeLimitMin)}</span>`:''}
      ${v.speedLimitMbps?`<span>⚡ ${v.speedLimitMbps}M</span>`:''}
    </div>
    <div style="height:1px;background:linear-gradient(90deg,transparent,#b8a89a,transparent);margin-top:8px"></div>
    ${qrImg}</div>`

  if (t==='bubble') return `<div style="${B};background:white;border-radius:24px;padding:14px 12px;border:3px solid #a5b4fc">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#818cf8,#c084fc);display:flex;align-items:center;justify-content:center;font-size:18px">${logo}</div>
      ${biz?`<div style="font-size:11px;font-weight:900;color:#4f46e5;text-align:center;flex:1;margin-right:8px">${biz}</div>`:''}
      <span style="font-size:14px">🫧</span>
    </div>
    <div style="background:linear-gradient(135deg,#ede9fe,#fae8ff);border-radius:16px;padding:8px;text-align:center;margin-bottom:8px;border:1px solid #c4b5fd">
      <div style="font-size:9px;color:#7c3aed;margin-bottom:3px;font-weight:600">✨ كود الاتصال</div>
      <div style="font-size:15px;font-family:monospace;font-weight:900;color:#5b21b6;letter-spacing:${noSep?1:2}px">${code}</div>
    </div>
    <div style="font-size:10px;color:#7c3aed;text-align:center">${specsHTML}</div>${qrImg}</div>`

  // matrix (default)
  return `<div style="${B};background:#001100;border:1px solid #00aa00;border-radius:6px;padding:10px 12px;font-family:'Courier New',monospace;color:#00ff00">
    <div style="border-bottom:1px solid #003300;margin-bottom:6px;padding-bottom:4px;font-size:9px;color:#00aa00">
      ${biz||'MATRIX WIFI'} ${logo}
    </div>
    <div style="text-align:center;margin-bottom:6px">
      <div style="font-size:8px;color:#006600;margin-bottom:3px">ENTER THE MATRIX</div>
      <div style="font-size:14px;font-weight:900;color:#00ff00;letter-spacing:${noSep?2:3}px">${code}</div>
    </div>
    <div style="font-size:8px;color:#006600">
      ${v.dataLimitMB?`<div>[DATA]....${fmt.data(v.dataLimitMB)}</div>`:''}
      ${v.timeLimitMin?`<div>[TIME]....${fmt.time(v.timeLimitMin)}</div>`:''}
      ${v.speedLimitMbps?`<div>[SPEED]...${v.speedLimitMbps}Mbps</div>`:''}
    </div>${qrImg}</div>`
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DARK_TEMPLATES = new Set(['dark','purple','green','neon','ocean','sunset','retro','midnight','forest','galaxy','fire','social_tw','social_tk','vip','mono','matrix'])

function PrintContent() {
  const params  = useSearchParams()
  const batchId = params.get('batch')

  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [t,        setT]        = useState('dark')
  const [biz,      setBiz]      = useState(params.get('biz') || '')
  const [logo,     setLogo]     = useState('📦')
  const [cols,     setCols]     = useState(3)
  const [cardW,    setCardW]    = useState(0)   // عرض الكارت مم — 0 = تلقائي
  const [cardH,    setCardH]    = useState(0)   // طول الكارت مم — 0 = تلقائي
  const [showQR,   setShowQR]   = useState(false)
  const [noSep,    setNoSep]    = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState('')
  const isSA    = params.get('sa')      === '1'
  const adminId = params.get('adminId') || ''
  const idsParam = params.get('ids')    || ''

  useEffect(() => {
    setLoading(true)
    let url = ''
    if (idsParam)        url = `/api/admin/vouchers/batch?ids=${idsParam}`
    else if (adminId)    url = `/api/admin/vouchers/batch?adminId=${adminId}`
    else if (batchId)    url = `/api/admin/vouchers/batch?batchId=${batchId}`
    if (!url) { setLoading(false); return }
    fetch(url)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setVouchers(d) })
      .finally(() => setLoading(false))
  }, [batchId, adminId, idsParam])

  // ── فتح نافذة الطباعة كصفحة HTML مستقلة ──────────────────────────────────
  const openPrintWindow = () => {
    const cardsHTML = vouchers.map(v => buildCardHTML(v, t, biz, logo, showQR, noSep)).join('\n')

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>كروت WiFi - ${biz||'طباعة'}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: Cairo, Arial, sans-serif;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}
html, body {
  background: white;
  direction: rtl;
}
@page {
  margin: 4mm;
  size: A4 portrait;
}
.grid {
  display: grid;
  grid-template-columns: repeat(${cols}, 1fr);
  gap: 7px;
  padding: 7px;
}
.grid > div {
  ${cardW>0?`width: ${cardW}mm !important;`:''}${cardH>0?`
  height: ${cardH}mm !important;
  overflow: hidden;`:''}
}
@media print {
  html, body { background: white !important; }
  .no-print { display: none !important; }
}
.no-print {
  position: fixed;
  top: 0; left: 0; right: 0;
  background: #1e293b;
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 999;
  font-family: Cairo, sans-serif;
  color: white;
  font-size: 13px;
}
.no-print button {
  padding: 8px 20px;
  background: linear-gradient(135deg,#0088CC,#00D4FF);
  border: none;
  border-radius: 8px;
  color: #000;
  font-family: Cairo, sans-serif;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.content { padding-top: 50px; }
@media print { .content { padding-top: 0; } }
</style>
</head>
<body>
<div class="no-print">
  <span>🖨️ ${vouchers.length} كارت — ${TEMPLATES.find(x=>x.id===t)?.name||t} — ${biz||'بدون اسم'}</span>
  <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
</div>
<div class="content">
  <div class="grid">
${cardsHTML}
  </div>
</div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    window.open(url, '_blank')
    // تنظيف بعد 60 ثانية (وقت كافي للتحميل والطباعة)
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const downloadCSV = () => {
    const header = ['Code','Package','Data','Time','Speed','Max Devices']
    const rows = vouchers.map(v => [
      v.code, v.packageType,
      v.dataLimitMB ? fmt.data(v.dataLimitMB) : 'unlimited',
      v.timeLimitMin ? fmt.time(v.timeLimitMin) : 'unlimited',
      v.speedLimitMbps||'', v.maxUsageCount,
    ])
    const csv = [header,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}))
    a.download = `vouchers-${batchId||'export'}.csv`; a.click()
  }

  const EMOJIS = ['📶','☕','🍕','🏨','🏪','🎮','✈️','🍔','🎵','💼','🌟','🔥','📱','💻','🎯','🌐']
  const filtered = search ? TEMPLATES.filter(tmpl => tmpl.name.includes(search) || tmpl.id.includes(search.toLowerCase())) : TEMPLATES

  const Sinp: React.CSSProperties = { width:'100%', padding:'8px 12px', background:'#070B12', border:'1px solid #1C2A40', borderRadius:9, color:'#E2F0FB', fontFamily:'Cairo,sans-serif', fontSize:12, outline:'none' }
  const Slbl: React.CSSProperties = { display:'block', fontSize:10, color:'#6B8CAE', marginBottom:4 }
  const Scrd: React.CSSProperties = { background:'#0C1420', border:'1px solid #1C2A40', borderRadius:11, padding:13, marginBottom:10 }

  // Preview card component
  const PreviewCard = ({ v }: { v: Voucher }) => (
    <div dangerouslySetInnerHTML={{ __html: buildCardHTML(v, t, biz, logo, showQR, noSep) }} />
  )

  return (
    <div style={{minHeight:'100vh',background:'#070B12',direction:'rtl',fontFamily:'Cairo,sans-serif'}}>
      {/* Header */}
      <div style={{background:'#0C1420',borderBottom:'1px solid #1C2A40',padding:'0 16px',height:50,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{fontSize:13,fontWeight:900,color:'#00D4FF'}}>🖨️ طباعة الكروت ({vouchers.length})</div>
        <div style={{display:'flex',gap:8}}>
          <a href="/dashboard" style={{padding:'6px 12px',background:'#1C2A40',borderRadius:8,color:'#6B8CAE',fontSize:11,textDecoration:'none'}}>← رجوع</a>
          <button onClick={downloadCSV} disabled={!vouchers.length} style={{padding:'6px 14px',background:'#1C2A40',border:'1px solid #1C2A40',borderRadius:8,color:'#6B8CAE',fontSize:11,cursor:'pointer',fontFamily:'Cairo,sans-serif'}}>📥 CSV</button>
          <button onClick={openPrintWindow} disabled={!vouchers.length} style={{padding:'6px 16px',background:vouchers.length?'linear-gradient(135deg,#0088CC,#00D4FF)':'#1C2A40',border:'none',borderRadius:8,color:vouchers.length?'#000':'#6B8CAE',fontSize:12,fontWeight:700,cursor:vouchers.length?'pointer':'not-allowed',fontFamily:'Cairo,sans-serif'}}>
            🖨️ فتح للطباعة
          </button>
        </div>
      </div>

      <div style={{display:'flex',gap:14,padding:14,maxWidth:1400,margin:'0 auto'}}>
        {/* Sidebar */}
        <div style={{width:250,flexShrink:0}}>
          {/* Templates */}
          <div style={Scrd}>
            <div style={{fontSize:12,fontWeight:700,color:'#E2F0FB',marginBottom:8}}>🎨 القالب ({TEMPLATES.length} شكل)</div>
            <input placeholder="🔍 ابحث..." value={search} onChange={e=>setSearch(e.target.value)} style={{...Sinp,marginBottom:8,fontSize:11}}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,maxHeight:380,overflowY:'auto'}}>
              {filtered.map(tmpl=>(
                <button key={tmpl.id} onClick={()=>setT(tmpl.id)}
                  style={{padding:'6px 4px',background:t===tmpl.id?'rgba(0,136,204,0.2)':'#111B2D',border:`1px solid ${t===tmpl.id?'#0088CC':'#1C2A40'}`,borderRadius:7,color:t===tmpl.id?'#00D4FF':'#6B8CAE',fontFamily:'Cairo,sans-serif',fontSize:10,cursor:'pointer',textAlign:'center'}}>
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>

          {/* Business */}
          <div style={Scrd}>
            <div style={{fontSize:12,fontWeight:700,color:'#E2F0FB',marginBottom:9}}>🏪 المكان</div>
            <div style={{marginBottom:9}}>
              <label style={Slbl}>اسم المكان</label>
              <input style={Sinp} value={biz} onChange={e=>setBiz(e.target.value)} placeholder="كافيه النيل"/>
            </div>
            <label style={Slbl}>أيقونة</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {EMOJIS.map(e=>(
                <button key={e} onClick={()=>setLogo(e)} style={{width:30,height:30,background:logo===e?'#0088CC':'#1C2A40',border:'none',borderRadius:7,fontSize:13,cursor:'pointer'}}>{e}</button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div style={Scrd}>
            <div style={{fontSize:12,fontWeight:700,color:'#E2F0FB',marginBottom:9}}>⚙️ خيارات</div>
            <div style={{marginBottom:10}}>
              <label style={Slbl}>عدد الأعمدة: {cols} (لحد 8)</label>
              <input type="range" min={1} max={8} value={cols} onChange={e=>setCols(+e.target.value)} style={{width:'100%',accentColor:'#0088CC'}}/>
              <div style={{display:'flex',gap:4,marginTop:6,flexWrap:'wrap'}}>
                {[2,3,4,5,6,8].map(n=>(
                  <button key={n} onClick={()=>setCols(n)} style={{flex:1,padding:'4px 0',background:cols===n?'#0088CC':'#111B2D',border:`1px solid ${cols===n?'#0088CC':'#1C2A40'}`,borderRadius:6,color:cols===n?'#000':'#6B8CAE',fontFamily:'Cairo,sans-serif',fontSize:10,cursor:'pointer',fontWeight:700}}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <label style={Slbl}>📐 مقاس الكارت (مم) — صفر = تلقائي</label>
              <div style={{display:'flex',gap:6,marginBottom:6}}>
                <div style={{flex:1}}>
                  <label style={{...Slbl,fontSize:9}}>العرض (مم)</label>
                  <input type="number" min={0} max={200} value={cardW} onChange={e=>setCardW(Math.max(0,Math.min(200,+e.target.value||0)))} style={{...Sinp,textAlign:'center',color:'#00D4FF',fontWeight:700}}/>
                </div>
                <div style={{flex:1}}>
                  <label style={{...Slbl,fontSize:9}}>الطول (مم)</label>
                  <input type="number" min={0} max={200} value={cardH} onChange={e=>setCardH(Math.max(0,Math.min(200,+e.target.value||0)))} style={{...Sinp,textAlign:'center',color:'#00D4FF',fontWeight:700}}/>
                </div>
              </div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                <button onClick={()=>{setCardW(0);setCardH(0)}} style={{flex:1,padding:'4px 0',background:cardW===0&&cardH===0?'#0088CC':'#111B2D',border:'1px solid #1C2A40',borderRadius:6,color:cardW===0&&cardH===0?'#000':'#6B8CAE',fontFamily:'Cairo,sans-serif',fontSize:9,cursor:'pointer',fontWeight:700}}>تلقائي</button>
                <button onClick={()=>{setCardW(54);setCardH(86)}} style={{flex:1,padding:'4px 0',background:cardW===54&&cardH===86?'#0088CC':'#111B2D',border:'1px solid #1C2A40',borderRadius:6,color:cardW===54&&cardH===86?'#000':'#6B8CAE',fontFamily:'Cairo,sans-serif',fontSize:9,cursor:'pointer',fontWeight:700}}>كارت بنكي</button>
                <button onClick={()=>{setCardW(50);setCardH(30)}} style={{flex:1,padding:'4px 0',background:cardW===50&&cardH===30?'#0088CC':'#111B2D',border:'1px solid #1C2A40',borderRadius:6,color:cardW===50&&cardH===30?'#000':'#6B8CAE',fontFamily:'Cairo,sans-serif',fontSize:9,cursor:'pointer',fontWeight:700}}>مستطيل صغير</button>
                <button onClick={()=>{setCardW(63.5);setCardH(88)}} style={{flex:1,padding:'4px 0',background:cardW===63.5&&cardH===88?'#0088CC':'#111B2D',border:'1px solid #1C2A40',borderRadius:6,color:cardW===63.5&&cardH===88?'#000':'#6B8CAE',fontFamily:'Cairo,sans-serif',fontSize:9,cursor:'pointer',fontWeight:700}}>بوكر</button>
              </div>
              {(cardW>0||cardH>0)&&<div style={{fontSize:9,color:'#354E6A',marginTop:4,textAlign:'center'}}>الكارت هيطبع بمقاس ثابت {cardW>0?cardW+'مم عرض':'—'} × {cardH>0?cardH+'مم طول':'—'}</div>}
            </div>
            {[
              ...(isSA ? [{val:showQR,set:setShowQR,label:'📷 إضافة QR Code'}] : []),
              {val:noSep, set:setNoSep, label:'🚫 إزالة الفواصل (-)'},
            ].map((opt,i)=>(
              <div key={i} onClick={()=>opt.set((v:boolean)=>!v)}
                style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'7px 10px',background:opt.val?'rgba(0,212,255,0.08)':'#070B12',border:`1px solid ${opt.val?'#00D4FF':'#1C2A40'}`,borderRadius:8,marginBottom:7}}>
                <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${opt.val?'#00D4FF':'#354E6A'}`,background:opt.val?'#00D4FF':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#000'}}>{opt.val?'✓':''}</div>
                <span style={{fontSize:11,color:opt.val?'#00D4FF':'#6B8CAE',fontWeight:700}}>{opt.label}</span>
              </div>
            ))}
          </div>

          <div style={{...Scrd,fontSize:10,color:'#6B8CAE',lineHeight:2}}>
            <div style={{fontWeight:700,color:'#E2F0FB',marginBottom:5}}>💡 تعليمات الطباعة</div>
            <div>① اضغط "فتح للطباعة"</div>
            <div>② في الصفحة الجديدة اضغط "طباعة"</div>
            <div>③ اختر "بلا هوامش" في الطابعة</div>
            <div>④ أو احفظ كـ PDF</div>
          </div>
        </div>

        {/* Preview */}
        <div style={{flex:1,minWidth:0}}>
          {loading && <div style={{textAlign:'center',padding:40,color:'#6B8CAE',fontSize:13}}>⏳ جاري التحميل...</div>}
          {!loading && vouchers.length===0 && (
            <div style={{background:'#0C1420',border:'1px solid #1C2A40',borderRadius:14,padding:48,textAlign:'center',color:'#6B8CAE'}}>
              <div style={{fontSize:48,marginBottom:12}}>🖨️</div>
              <p>لا يوجد كروت</p>
            </div>
          )}
          {!loading && vouchers.length>0 && (
            <div style={{background:DARK_TEMPLATES.has(t)?'#111':'white',borderRadius:12,padding:14}}>
              <div style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,gap:9}}>
                {vouchers.map(v=>(
                  <div key={v.id} style={{width:cardW>0?cardW+'mm':undefined,height:cardH>0?cardH+'mm':undefined,overflow:cardH>0?'hidden':undefined}}>
                    <PreviewCard v={v}/>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div style={{color:'white',padding:40,fontFamily:'Cairo,sans-serif',direction:'rtl'}}>⏳ جاري التحميل...</div>}>
      <PrintContent/>
    </Suspense>
  )
}
