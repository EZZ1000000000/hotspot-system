// GET /api/portal/page?gw_id=XXXX
// يرجع HTML خالص مباشرة — سريع جداً بدون Next.js overhead

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ─── Default HTML Template ────────────────────────────────
function defaultTemplate(placeName: string, wifiName: string, logoEmoji: string): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${placeName} - بوابة الإنترنت</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 40% 40%,#001830 0%,#070B12 65%);font-family:Cairo,Tahoma,Arial,sans-serif;direction:rtl;padding:20px}
  .card{width:100%;max-width:400px;background:#0C1420;border:1px solid #1C2A40;border-radius:20px;padding:32px 24px;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
  .logo{width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,#0088CC,#00D4FF);display:flex;align-items:center;justify-content:center;font-size:34px;margin:0 auto 14px;box-shadow:0 0 40px rgba(0,212,255,0.3);text-align:center;line-height:72px}
  h1{font-size:22px;font-weight:900;color:#00D4FF;text-align:center;margin-bottom:4px}
  .sub{font-size:13px;color:#6B8CAE;text-align:center;margin-bottom:28px}
  label{display:block;font-size:12px;color:#6B8CAE;font-weight:600;margin-bottom:8px}
  input{width:100%;padding:14px 16px;background:#070B12;border:1px solid #1C2A40;border-radius:12px;color:#E2F0FB;font-size:18px;font-family:monospace;letter-spacing:3px;text-align:center;outline:none;transition:border-color 0.2s}
  input:focus{border-color:#0088CC;box-shadow:0 0 0 3px rgba(0,136,204,0.15)}
  .bar{height:4px;background:#1C2A40;border-radius:2px;margin-top:8px;overflow:hidden}
  .bar-fill{height:100%;background:#00D4FF;border-radius:2px;width:0;transition:width 0.2s}
  .error{margin-top:12px;padding:10px 14px;background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.2);border-radius:10px;color:#FF4444;font-size:13px;text-align:center;display:none}
  .btn{width:100%;margin-top:18px;padding:14px;background:linear-gradient(135deg,#0088CC,#00D4FF);border:none;border-radius:12px;color:#000;font-size:16px;font-weight:700;font-family:Cairo,Tahoma,Arial,sans-serif;cursor:pointer;transition:opacity 0.2s}
  .btn:disabled{background:#1C2A40;color:#6B8CAE;cursor:not-allowed}
  .spinner{display:inline-block;width:16px;height:16px;border:2px solid #6B8CAE;border-top-color:#00D4FF;border-radius:50%;animation:spin 0.7s linear infinite;vertical-align:middle;margin-left:8px}
  .tip{margin-top:20px;padding:12px 14px;background:#070B12;border-radius:10px;border:1px solid #1C2A40;font-size:12px;color:#6B8CAE;text-align:center;line-height:1.8}
  .success-box{text-align:center;padding:16px 0;display:none}
  .success-icon{font-size:56px;margin-bottom:14px}
  .success-title{font-size:22px;font-weight:900;color:#00E676;margin-bottom:6px}
  .success-sub{font-size:14px;color:#6B8CAE;margin-bottom:16px}
  .success-wifi{background:rgba(0,230,118,0.08);border:1px solid rgba(0,230,118,0.2);border-radius:10px;padding:10px 16px;font-size:13px;color:#00E676}
  .progress{width:100%;height:4px;background:#1C2A40;border-radius:2px;overflow:hidden;margin-top:16px}
  .progress-fill{height:100%;background:linear-gradient(90deg,#00E676,#00D4FF);border-radius:2px;animation:progress 3s linear forwards}
  .wifi-badge{position:fixed;top:12px;right:12px;display:flex;align-items:center;gap:6px;background:rgba(12,20,32,0.8);backdrop-filter:blur(8px);border:1px solid #1C2A40;border-radius:999px;padding:5px 12px;font-size:12px;color:#6B8CAE;font-family:monospace}
  .dot{color:#00E676;font-size:10px;animation:pulse 2s infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
  @keyframes progress{from{width:0}to{width:100%}}
</style>
</head>
<body>

<div class="wifi-badge"><span class="dot">&#9679;</span>${wifiName}</div>

<div class="card">
  <div class="logo">${logoEmoji}</div>
  <h1>${placeName}</h1>
  <p class="sub">أدخل كود الاشتراك للاتصال بالإنترنت</p>

  <div id="form-box">
    <label>كود الاشتراك</label>
    <input id="code" type="text" placeholder="ABCD-1234" dir="ltr" autocomplete="off" autocorrect="off" spellcheck="false" oninput="onInput(this)" onkeydown="if(event.key==='Enter')doLogin()">
    <div class="bar"><div class="bar-fill" id="bar"></div></div>
    <div class="error" id="err"></div>
    <button class="btn" id="btn" onclick="doLogin()" disabled>&#128275; تفعيل الكود</button>
    <div class="tip">&#128161; احصل على كود الاشتراك من المسؤول<br>الكودات متاحة على بطاقات شحن مطبوعة</div>
  </div>

  <div class="success-box" id="success-box">
    <div class="success-icon">&#9989;</div>
    <div class="success-title">تم التفعيل!</div>
    <div class="success-sub" id="success-sub">جاري فتح الإنترنت...</div>
    <div class="success-wifi">&#128246; متصل بـ ${wifiName}</div>
    <div class="progress"><div class="progress-fill"></div></div>
    <div id="gw-tips" style="display:none;margin-top:14px;padding:12px 14px;background:#070B12;border-radius:10px;border:1px solid #1C2A40;font-size:12px;color:#6B8CAE;line-height:2">
      لو النت مافتحش خلال ثواني جرّب:<br>
      <button id="retry-btn" onclick="retryGateway()" style="margin-top:8px;padding:10px 16px;background:linear-gradient(135deg,#0088CC,#00D4FF);border:none;border-radius:10px;color:#000;font-weight:700;font-size:13px;cursor:pointer">&#128260; إعادة محاولة فتح النت</button>
      <button onclick="window.location.replace('/session?token='+window.__tk)" style="margin-top:8px;padding:10px 16px;background:#111B2D;border:1px solid #1C2A40;border-radius:10px;color:#6B8CAE;font-weight:700;font-size:13px;cursor:pointer">&#128203; صفحة الجلسة</button>
    </div>
  </div>
</div>

<script>
var params=(function(){var p=new URLSearchParams(location.search);return{gw_address:p.get('gw_address')||'',gw_port:p.get('gw_port')||'2060',mac:p.get('mac')||'',ip:p.get('ip')||'',gw_id:p.get('gw_id')||'',url:p.get('url')||''};})();
function formatCode(v){var c=v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,20);return c.match(/.{1,4}/g)?.join('-')||c;}
function onInput(el){var f=formatCode(el.value);el.value=f;var r=f.replace(/-/g,'');var pct=Math.min(100,(r.length/20)*100);var bar=document.getElementById('bar');bar.style.width=pct+'%';bar.style.background=r.length>=6?'#00D4FF':'#FF9800';document.getElementById('btn').disabled=r.length<6;document.getElementById('err').style.display='none';}
function showError(msg){var el=document.getElementById('err');el.textContent='&#9888; '+msg;el.style.display='block';}
async function doLogin(){
  var codeEl=document.getElementById('code');
  var raw=codeEl.value.replace(/-/g,'');
  if(raw.length<6){showError('الحد الأدنى 6 أحرف');return;}
  var btn=document.getElementById('btn');
  btn.disabled=true;
  btn.innerHTML='<span class="spinner"></span> جاري التحقق...';
  try{
    var res=await fetch('/api/portal/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:codeEl.value,mac:params.mac,ip:params.ip,gatewayId:params.gw_id,hostname:params.url})});
    var data=await res.json();
    if(data.success){
      document.getElementById('form-box').style.display='none';
      document.getElementById('success-box').style.display='block';
      var token=data.token;
      window.__tk=token;
      var gw=params.gw_address;
      var port=params.gw_port||'2060';
      // ── فتح النت عن طريق الراوتر داخل iframe مخفي ──
      // ليه iframe؟ لو الراوتر أظهر صفحة خطأ (wifidog القديم) المستخدم
      // مبيعلقش على صفحة الراوتر — الصفحة دي تفضل شغالة وتقدر تعيد المحاولة
      function tryGateway(u){
        var f=document.getElementById('gwframe');
        if(!f){
          f=document.createElement('iframe');
          f.id='gwframe';
          f.style.cssText='position:fixed;left:-9999px;top:-9999px;width:320px;height:240px;border:0;opacity:0';
          document.body.appendChild(f);
        }
        f.src=u;
      }
      window.retryGateway=function(){
        var u=window.__retryAlt?'http://192.0.2.1/wifidog/auth?token='+token:'http://'+gw+':'+port+'/wifidog/auth?token='+token;
        window.__retryAlt=!window.__retryAlt;
        tryGateway(u);
        var el=document.getElementById('success-sub');if(el)el.textContent='جاري إعادة المحاولة...';
      };
      if(gw){
        tryGateway('http://'+gw+':'+port+'/wifidog/auth?token='+token);
        // لو الراوتر نجح هيرجعنا لصفحة الجلسة تلقائياً (اختراق من الإطار)
        // لو لسه هنا بعد 5 ثواني → نظهر أزرار المساعدة بدل ما نسيب المستخدم معلق
        setTimeout(function(){
          var el=document.getElementById('success-sub');
          var tips=document.getElementById('gw-tips');
          if(el&&tips&&tips.style.display==='none'){
            el.textContent='التفعيل تم ✅ — لو النت مافتحش جرّب الزر تحت';
            tips.style.display='block';
          }
        },5000);
      }else{
        setTimeout(function(){window.location.replace('/session?token='+token);},600);
      }
    }else{
      showError(data.message||'الكود غير صحيح أو منتهي الصلاحية');
      btn.disabled=false;btn.innerHTML='&#128275; تفعيل الكود';
    }
  }catch(e){
    showError('خطأ في الاتصال بالسيرفر');
    btn.disabled=false;btn.innerHTML='&#128275; تفعيل الكود';
  }
}
</script>
</body>
</html>`
}

// ─── GET ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const gwId = new URL(req.url).searchParams.get('gw_id')

  let html      = ''
  let placeName = 'WiFi Hotspot'
  let wifiName  = 'Free_WiFi'
  let logoEmoji = '📶'

  if (gwId) {
    try {
      const device = await prisma.device.findUnique({
        where:  { gatewayId: gwId },
        select: { name: true, wifiSSID: true, description: true, portalHtml: true },
      })

      if (device) {
        placeName = device.name    || placeName
        wifiName  = device.wifiSSID || wifiName

        if (device.portalHtml) {
          html = device.portalHtml
        } else if (device.description) {
          try {
            const stored = JSON.parse(device.description)
            if (stored.logoEmoji) logoEmoji = stored.logoEmoji
          } catch {}
        }
      }
    } catch (err) {
      console.error('[portal/page GET]', err)
    }
  }

  if (!html) {
    html = defaultTemplate(placeName, wifiName, logoEmoji)
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

// ─── POST ── سوبر أدمن يحفظ HTML مخصص لجهاز ─────
export async function POST(req: NextRequest) {
  try {
    const { deviceId, html } = await req.json()
    if (!deviceId) return NextResponse.json({ error: 'deviceId مطلوب' }, { status: 400 })

    await prisma.device.update({
      where: { id: deviceId },
      data:  { portalHtml: html || null },  // null = يرجع للـ default
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[portal/page POST]', err)
    if (err.code === 'P2025') return NextResponse.json({ error: 'الجهاز غير موجود' }, { status: 404 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
