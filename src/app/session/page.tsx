'use client'
import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// ─── helpers ────────────────────────────────────
function fmtHMS(s: number) {
  s = Math.max(0, Math.floor(s))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':')
}
function fmtHM(s: number) {
  s = Math.max(0, Math.floor(s))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} س${m > 0 ? ` ${m} د` : ''}`
  return `${m} دقيقة`
}
function fmtMB(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(1)} MB`
}
const CIRC = 2 * Math.PI * 90

// ─── types ──────────────────────────────────────
interface SessionData {
  status: 'ACTIVE' | 'ENDED'
  token: string; voucherCode: string; voucherId?: string
  macAddress?: string
  wifiName: string; placeName: string
  packageType: 'DATA_ONLY' | 'TIME_ONLY' | 'BOTH' | 'UNLIMITED'
  startedAt: string; elapsedSec: number
  timeLimitSec: number | null; remainingSec: number | null
  dataInMB: number; dataOutMB: number; totalDataMB: number
  dataLimitMB: number | null; remainingDataMB: number | null
  speedLimitMbps: number | null; lastPingAt: string; endReason?: string
}

interface RewardTask {
  id: string; title: string; description?: string; url: string
  rewardType: string; rewardTimeMins?: number; rewardDataMB?: number
  level: number; isDone: boolean; isUnlocked: boolean
}

// ─── Reward Panel ────────────────────────────────
function RewardPanel({
  mac, sessionToken, voucherId, onEarned
}: {
  mac: string; sessionToken: string; voucherId?: string
  onEarned: (msg: string) => void
}) {
  const [tasks,      setTasks]      = useState<RewardTask[]>([])
  const [level,      setLevel]      = useState(1)
  const [totalDone,  setTotalDone]  = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [starting,   setStarting]   = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!mac) return
    try {
      const res  = await fetch(`/api/rewards/tasks?mac=${mac}&sessionToken=${sessionToken}`)
      const data = await res.json()
      setTasks(data.tasks || [])
      setLevel(data.currentLevel || 1)
      setTotalDone(data.totalDone || 0)
    } catch {}
    finally { setLoading(false) }
  }, [mac, sessionToken])

  useEffect(() => { load() }, [load])

  const startTask = async (task: RewardTask) => {
    if (starting) return
    setStarting(task.id)
    try {
      const res  = await fetch('/api/rewards/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ taskId: task.id, mac, sessionToken, voucherId }),
      })
      const data = await res.json()

      if (data.completed) {
        // ✅ اكتملت — افتح اللينك المشابه في tab جديد
        if (data.openUrl) {
          window.open(data.openUrl, '_blank', 'noopener,noreferrer')
        }
        const rewardMsg = [
          data.reward?.timeMins ? `⏱️ +${data.reward.timeMins} دقيقة` : '',
          data.reward?.dataMB   ? `📥 +${data.reward.dataMB} MB`       : '',
        ].filter(Boolean).join('  ')
        onEarned(`🎉 مبروك! ${rewardMsg} — مكافأتك اتضافت على باقتك`)
        setTimeout(() => load(), 500)
      } else if (data.error) {
        onEarned(`❌ ${data.error}`)
      }
    } catch {
      onEarned('❌ خطأ في الاتصال — جرب مرة تانية')
    }
    finally { setStarting(null) }
  }

  const rewardLabel = (t: RewardTask) => {
    if (t.rewardTimeMins && t.rewardDataMB) return `⏱️ +${t.rewardTimeMins} د  📶 +${fmtMB(t.rewardDataMB)}`
    if (t.rewardTimeMins) return `⏱️ +${t.rewardTimeMins} دقيقة`
    if (t.rewardDataMB)   return `📶 +${fmtMB(t.rewardDataMB)}`
    return '🎁 مكافأة'
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 32, color: '#6B8CAE', fontSize: 13 }}>
      ⏳ جاري تحميل المهام...
    </div>
  )

  if (tasks.length === 0) return (
    <div style={{ textAlign: 'center', padding: 32, color: '#354E6A', fontSize: 13 }}>
      لا توجد مهام متاحة الآن
    </div>
  )

  const byLevel: Record<number, RewardTask[]> = {}
  tasks.forEach(t => { byLevel[t.level] = [...(byLevel[t.level] || []), t] })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: 999, padding: '6px 14px',
        }}>
          <span style={{ fontSize: 16 }}>⭐</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#00D4FF' }}>المستوى {level}</span>
          <span style={{ fontSize: 11, color: '#6B8CAE' }}>({totalDone} مهمة مكتملة)</span>
        </div>
        <button onClick={load} style={{
          background: 'none', border: '1px solid #1C2A40', borderRadius: 8,
          color: '#6B8CAE', padding: '5px 10px', fontSize: 11, cursor: 'pointer',
          fontFamily: 'Cairo,sans-serif',
        }}>🔄 تحديث</button>
      </div>

      {Object.entries(byLevel).sort(([a], [b]) => +a - +b).map(([lvl, lvlTasks]) => {
        const isLocked = +lvl > level
        return (
          <div key={lvl} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, opacity: isLocked ? 0.5 : 1 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: isLocked ? '#1C2A40' : 'linear-gradient(135deg,#0088CC,#00D4FF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 900, color: isLocked ? '#354E6A' : '#000',
              }}>{lvl}</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: isLocked ? '#354E6A' : '#6B8CAE' }}>
                {isLocked ? `🔒 مستوى ${lvl} — أكمل المستوى السابق أولاً` : `مستوى ${lvl}`}
              </span>
            </div>

            {lvlTasks.map(task => (
              <div key={task.id} style={{
                background: task.isDone ? 'rgba(0,230,118,0.05)' : isLocked ? 'rgba(0,0,0,0.2)' : '#070B12',
                border: `1px solid ${task.isDone ? 'rgba(0,230,118,0.25)' : isLocked ? '#0C1420' : '#1C2A40'}`,
                borderRadius: 12, padding: '14px 16px', marginBottom: 10,
                opacity: isLocked ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: task.isDone ? '#00E676' : '#E2F0FB', marginBottom: 4 }}>
                    {task.isDone ? '✅ ' : ''}{task.title}
                  </div>
                  {task.description && (
                    <div style={{ fontSize: 11, color: '#6B8CAE', marginBottom: 6, lineHeight: 1.6 }}>
                      {task.description}
                    </div>
                  )}
                  <div style={{
                    display: 'inline-block', padding: '3px 10px',
                    background: 'rgba(0,212,255,0.1)', borderRadius: 20,
                    fontSize: 11, fontWeight: 700, color: '#00D4FF',
                    border: '1px solid rgba(0,212,255,0.2)',
                  }}>
                    {rewardLabel(task)}
                  </div>
                </div>
                {!task.isDone && !isLocked && (
                  <button
                    onClick={() => startTask(task)}
                    disabled={starting === task.id}
                    style={{
                      padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg,#f59e0b,#fbbf24)',
                      color: '#000', fontFamily: 'Cairo,sans-serif',
                      fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap',
                      opacity: starting === task.id ? 0.7 : 1,
                      boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
                    }}>
                    {starting === task.id ? '⏳' : '🚀 ابدأ'}
                  </button>
                )}
                {task.isDone && (
                  <div style={{
                    padding: '8px 14px', borderRadius: 10,
                    background: 'rgba(0,230,118,0.1)',
                    border: '1px solid rgba(0,230,118,0.2)',
                    fontSize: 12, color: '#00E676', fontWeight: 700,
                  }}>مكتملة ✓</div>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// MAIN SESSION PAGE
// ============================================================
export default function SessionPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060D1F' }}>
        <div style={{ color: '#6B8CAE', fontFamily: 'Cairo,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #1C2A40', borderTopColor: '#00D4FF', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <span>جاري التحميل...</span>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    }>
      <SessionPageInner />
    </Suspense>
  )
}

function SessionPageInner() {
  const sp     = useSearchParams()
  const router = useRouter()
  const token  = sp.get('token') || ''

  const [data,        setData]        = useState<SessionData | null>(null)
  const [error,       setError]       = useState('')
  const [expired,     setExpired]     = useState(false)
  const [expiredInfo, setExpiredInfo] = useState({ duration: '', data: '', reason: '' })
  const [showRewards, setShowRewards] = useState(false)
  const [mac,         setMac]         = useState('')
  const [voucherId,   setVoucherId]   = useState('')

  const [elapsedSec,   setElapsedSec]   = useState(0)
  const [remainingSec, setRemainingSec] = useState<number | null>(null)
  const [dlMB,         setDlMB]         = useState(0)
  const [ulMB,         setUlMB]         = useState(0)
  const [dlSpeed,      setDlSpeed]      = useState(0)
  const [ulSpeed,      setUlSpeed]      = useState(0)
  const [toast,        setToast]        = useState('')
  const [toastOn,      setToastOn]      = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)

  const expiredRef  = useRef(false)
  const dlSpeedRef  = useRef(2)
  const ulSpeedRef  = useRef(0.5)

  const showMsg = useCallback((msg: string) => {
    setToast(msg); setToastOn(true)
    setTimeout(() => setToastOn(false), 5000)
  }, [])

  const grabWL = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        const wl = await (navigator as any).wakeLock.request('screen')
        wl.addEventListener('release', grabWL)
      }
    } catch {}
  }, [])

  const doExpire = useCallback((reason: string, elSec: number, totalMB: number) => {
    if (expiredRef.current) return
    expiredRef.current = true
    setExpiredInfo({
      duration: fmtHM(elSec),
      data:     fmtMB(totalMB),
      reason:   reason === 'DATA_DEPLETED' ? 'نفدت الباقة' : reason === 'TIME_EXPIRED' ? 'انتهى الوقت' : 'انتهت الجلسة',
    })
    setExpired(true)
  }, [])

  useEffect(() => {
    if (!token) { setError('لا يوجد token'); return }
    fetch(`/api/session?token=${token}`)
      .then(r => r.json())
      .then((d: SessionData) => {
        if (d.status === 'ENDED') { doExpire(d.endReason || 'ENDED', 0, 0); return }
        if ((d as any).error) { setError((d as any).error); return }
        setData(d)
        setElapsedSec(d.elapsedSec)
        setRemainingSec(d.remainingSec)
        setDlMB(d.dataInMB)
        setUlMB(d.dataOutMB)
        if (d.voucherId)   setVoucherId(d.voucherId)
        if (d.macAddress)  setMac(d.macAddress)
      })
      .catch(() => setError('تعذّر الاتصال بالسيرفر'))
  }, [token, doExpire])

  useEffect(() => {
    if (!data) return
    grabWL()
    setTimeout(() => showMsg('🔒 خلّي الصفحة دي مفتوحة طول ما بتتصفح'), 1500)
    const ticker = setInterval(() => {
      if (expiredRef.current) return
      dlSpeedRef.current = Math.min(data.speedLimitMbps || 15, Math.max(0.1, dlSpeedRef.current + (Math.random() - 0.47) * 0.8))
      ulSpeedRef.current = Math.min((data.speedLimitMbps || 5) / 3, Math.max(0, ulSpeedRef.current + (Math.random() - 0.5) * 0.3))
      setDlSpeed(+dlSpeedRef.current.toFixed(1))
      setUlSpeed(+ulSpeedRef.current.toFixed(1))
      // الاستهلاك الحقيقي بيتحدث من الـ keepalive كل 30 ثانية — مفيش زيادة وهمية
      setElapsedSec(p => p + 1)
      setRemainingSec(prev => {
        if (prev === null) return null
        const next = prev - 1
        if (next <= 0) doExpire('TIME_EXPIRED', elapsedSec + 1, dlMB + ulMB)
        return Math.max(0, next)
      })
    }, 1000)
    return () => clearInterval(ticker)
  }, [data])

  useEffect(() => {
    if (!data || !token) return
    const pinger = setInterval(async () => {
      if (expiredRef.current) return
      try {
        const r    = await fetch('/api/session/keepalive', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }), keepalive: true,
        })
        const json = await r.json()
        if (json.ended) doExpire(json.reason || 'ENDED', elapsedSec, dlMB + ulMB)
        if (json.mac) setMac(json.mac)
        if (json.dataUsedMB !== undefined) {
          setDlMB(json.dataUsedMB * 0.7)
          setUlMB(json.dataUsedMB * 0.3)
        }
        if (json.remainingSec !== null && json.remainingSec !== undefined) {
          setRemainingSec(json.remainingSec)
        }
      } catch {}
    }, 30000)
    return () => clearInterval(pinger)
  }, [data, token])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (!expiredRef.current) { e.preventDefault(); return (e.returnValue = '') } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  useEffect(() => {
    const h = () => { if (!expiredRef.current && document.hidden) showMsg('⚠️ ارجع للصفحة عشان الاتصال ميتقطعش') }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [showMsg])

  const totalMB   = dlMB + ulMB
  const dataLimit = data?.dataLimitMB ?? null
  const timeLimit = data?.timeLimitSec ?? null
  const usagePct  = dataLimit ? Math.min(100, (totalMB / dataLimit) * 100) : 0
  const timePct   = timeLimit && remainingSec !== null ? Math.max(0, remainingSec / timeLimit) : 1
  const ringOffset = CIRC * (1 - timePct)
  const ringColor  = timePct > 0.5 ? '#00D4FF' : timePct > 0.2 ? '#fb923c' : '#ff4444'
  const isUnlimited = data?.packageType === 'UNLIMITED'

  if (error) return (
    <div style={fullCenter}>
      <div style={{ textAlign: 'center', color: '#FF4444', fontFamily: 'Cairo,sans-serif' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div><p>{error}</p>
        <button onClick={() => router.push('/portal')} style={renewBtn}>← رجوع</button>
      </div>
    </div>
  )
  if (!data) return (
    <div style={fullCenter}>
      <div style={{ color: '#6B8CAE', fontFamily: 'Cairo,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, border: '3px solid #1C2A40', borderTopColor: '#00D4FF', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span>جاري تحميل بيانات جلستك...</span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{
      minHeight: '100dvh', background: '#060D1F', color: '#E2F0FB',
      fontFamily: 'Cairo,sans-serif', direction: 'rtl',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      position: 'relative', overflowX: 'hidden', paddingBottom: 32,
    }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 60% 40% at 20% 10%,rgba(0,136,204,0.15) 0%,transparent 60%),radial-gradient(ellipse 50% 40% at 80% 80%,rgba(0,212,255,0.10) 0%,transparent 60%)',
      }} />

      {expired && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(6,13,31,0.97)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 64 }}>⏰</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#FF4444' }}>انتهت الجلسة</div>
          <div style={{ color: '#6B8CAE', fontSize: 14, lineHeight: 2 }}>
            <span style={{ color: '#ff9800' }}>{expiredInfo.reason}</span><br/>
            اتصفحت لمدة <strong style={{ color: '#E2F0FB' }}>{expiredInfo.duration}</strong><br/>
            استهلكت <strong style={{ color: '#E2F0FB' }}>{expiredInfo.data}</strong>
          </div>
          <button onClick={() => router.push('/portal')} style={renewBtn}>🔄 تجديد الكارت</button>
        </div>
      )}

      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowConfirm(false)}>
          <div style={{ width: '100%', maxWidth: 420, background: '#0C1420', border: '1px solid #1C2A40', borderRadius: '20px 20px 0 0', padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>⚠️ قطع الاتصال؟</div>
            <div style={{ color: '#6B8CAE', fontSize: 13, lineHeight: 1.8, marginBottom: 20 }}>لو قطعت دلوقتي، الوقت الباقي في الكارت هيضيع.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, background: '#111B2D', border: '1px solid #1C2A40', color: '#E2F0FB', fontFamily: 'Cairo,sans-serif', fontSize: 14, cursor: 'pointer' }}>لا، كمّل</button>
              <button onClick={async () => {
                setShowConfirm(false)
                try { await fetch('/api/session/keepalive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, disconnect: true }) }) } catch {}
                doExpire('USER_LOGOUT', elapsedSec, totalMB)
              }} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'rgba(255,68,68,0.12)', border: '1px solid rgba(255,68,68,0.3)', color: '#FF4444', fontFamily: 'Cairo,sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                أيوه، قطع
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        position: 'fixed', bottom: 24, left: '50%', zIndex: 200,
        transform: `translateX(-50%) translateY(${toastOn ? '0' : '70px'})`,
        background: 'rgba(12,20,32,0.95)', border: '1px solid #1C2A40',
        borderRadius: 999, padding: '8px 18px',
        fontSize: 12, color: '#6B8CAE', whiteSpace: 'nowrap',
        backdropFilter: 'blur(8px)', transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}>{toast}</div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00E676', display: 'inline-block', boxShadow: '0 0 6px rgba(0,230,118,0.7)', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#00E676' }}>متصل</span>
          </div>
          <div style={{ fontSize: 11, color: '#354E6A', fontFamily: 'monospace' }}>📶 {data.wifiName}</div>
        </div>

        <div style={card}>
          <div>
            <div style={miniLabel}>كود الكارت</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', color: '#00D4FF', fontSize: 15, letterSpacing: 2 }}>{data.voucherCode}</div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={miniLabel}>بدأ الاتصال</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14 }}>
              {new Date(data.startedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* زر نت مجاني */}
        <button
          onClick={() => setShowRewards(r => !r)}
          style={{
            width: '100%', padding: '16px',
            background: showRewards
              ? 'rgba(245,158,11,0.1)'
              : 'linear-gradient(135deg, #d97706, #f59e0b, #fbbf24)',
            border: showRewards ? '2px solid rgba(245,158,11,0.4)' : 'none',
            borderRadius: 14, cursor: 'pointer',
            fontFamily: 'Cairo,sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: showRewards ? 'none' : '0 0 30px rgba(245,158,11,0.4)',
            animation: showRewards ? 'none' : 'glow 2s ease-in-out infinite',
            transition: 'all 0.3s',
          }}>
          <span style={{ fontSize: 24 }}>🌐</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: showRewards ? '#f59e0b' : '#000', lineHeight: 1.2 }}>
              {showRewards ? '▲ إخفاء المهام' : '🎁 نت مجاني — كسب وقت وداتا!'}
            </div>
            {!showRewards && (
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.6)', marginTop: 2 }}>
                أكمل مهام بسيطة وزوّد باقتك مجاناً
              </div>
            )}
          </div>
        </button>

        {showRewards && (
          <div style={{ ...card, padding: '20px 16px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 900, color: '#f59e0b', marginBottom: 16 }}>
              🎁 مهام النت المجاني
            </h3>
            <RewardPanel
              mac={mac || data.voucherCode}
              sessionToken={token}
              voucherId={voucherId || data.voucherId}
              onEarned={showMsg}
            />
          </div>
        )}

        {!isUnlimited && (data.packageType === 'TIME_ONLY' || data.packageType === 'BOTH') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0' }}>
            <div style={{ position: 'relative', width: 190, height: 190 }}>
              <svg viewBox="0 0 200 200" style={{ width: 190, height: 190, transform: 'rotate(-90deg)' }}>
                <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                <circle cx="100" cy="100" r="90" fill="none" stroke={ringColor} strokeWidth="2"
                  strokeDasharray={CIRC} strokeDashoffset={ringOffset} strokeLinecap="round"
                  style={{ opacity: 0.35, filter: `drop-shadow(0 0 6px ${ringColor})`, transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }} />
                <circle cx="100" cy="100" r="90" fill="none" stroke={ringColor} strokeWidth="10"
                  strokeDasharray={CIRC} strokeDashoffset={ringOffset} strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <div style={{
                  fontSize: '2rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                  color: remainingSec !== null && remainingSec <= 300 ? (remainingSec <= 60 ? '#ff4444' : '#fb923c') : '#E2F0FB',
                  animation: remainingSec !== null && remainingSec <= 300 ? 'pulse 1s infinite' : 'none',
                }}>
                  {remainingSec !== null ? fmtHMS(remainingSec) : '∞'}
                </div>
                <div style={{ fontSize: 10, color: '#354E6A', letterSpacing: 2, fontWeight: 700 }}>الوقت المتبقي</div>
                {timeLimit && <div style={{ fontSize: 10, color: '#354E6A' }}>من {fmtHM(timeLimit)}</div>}
              </div>
            </div>
          </div>
        )}

        {isUnlimited && (
          <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>♾️</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#00E676' }}>باقة غير محدودة</div>
            <div style={{ fontSize: 12, color: '#6B8CAE', marginTop: 4 }}>لا يوجد حد للداتا أو الوقت</div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { icon: '⏱️', label: 'مضى من الجلسة', val: fmtHM(elapsedSec),  color: '#818cf8', accent: '#6366f1' },
            { icon: '📥', label: 'تنزيل',          val: fmtMB(dlMB),        color: '#22d3ee', accent: '#22d3ee' },
            { icon: '📤', label: 'رفع',             val: fmtMB(ulMB),        color: '#4ade80', accent: '#4ade80' },
            { icon: '📊', label: 'إجمالي',          val: fmtMB(totalMB),     color: '#fb923c', accent: '#fb923c' },
          ].map((s, i) => (
            <div key={i} style={{ ...card, padding: '14px 14px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${s.accent},${s.accent}55)` }} />
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
              <div style={{ fontSize: 11, color: '#354E6A', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {dataLimit && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>📶 استهلاك الباقة</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: usagePct > 90 ? '#FF4444' : usagePct > 70 ? '#fb923c' : '#818cf8' }}>
                {usagePct.toFixed(1)}%
              </span>
            </div>
            <div style={{ height: 8, background: '#070B12', borderRadius: 4, overflow: 'hidden', border: '1px solid #1C2A40' }}>
              <div style={{
                height: '100%', borderRadius: 4, width: `${usagePct}%`,
                background: usagePct > 90 ? 'linear-gradient(90deg,#ef4444,#f97316)' : usagePct > 70 ? 'linear-gradient(90deg,#f97316,#facc15)' : 'linear-gradient(90deg,#0088CC,#00D4FF)',
                transition: 'width 1s ease, background 0.5s', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)', animation: 'shimmer 2s infinite' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#354E6A' }}>
              <span>مستخدم: <strong style={{ color: '#E2F0FB' }}>{fmtMB(totalMB)}</strong></span>
              <span>متبقي: <strong style={{ color: '#E2F0FB' }}>{fmtMB(Math.max(0, dataLimit - totalMB))}</strong></span>
              <span>الحد: <strong style={{ color: '#E2F0FB' }}>{fmtMB(dataLimit)}</strong></span>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { arrow: '⬇️', label: 'سرعة التنزيل', val: dlSpeed.toFixed(1) },
            { arrow: '⬆️', label: 'سرعة الرفع',   val: ulSpeed.toFixed(1) },
          ].map((s, i) => (
            <div key={i} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>{s.arrow}</span>
              <div>
                <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {s.val} <span style={{ fontSize: 11, color: '#354E6A' }}>Mbps</span>
                </div>
                <div style={{ fontSize: 11, color: '#354E6A' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => setShowConfirm(true)} style={{
          width: '100%', padding: '14px', borderRadius: 12,
          background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.25)',
          color: '#FF4444', fontFamily: 'Cairo,sans-serif', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>
          🔌 قطع الاتصال
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#1C2A40' }}>{data.placeName} · Hotspot System</p>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(245,158,11,0.3)}50%{box-shadow:0 0 40px rgba(245,158,11,0.6)}}
      `}</style>
    </div>
  )
}

const card: React.CSSProperties = { background: '#0C1420', border: '1px solid #1C2A40', borderRadius: 14, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', backdropFilter: 'blur(12px)' }
const miniLabel: React.CSSProperties = { fontSize: 10, color: '#354E6A', marginBottom: 3 }
const renewBtn: React.CSSProperties = { marginTop: 20, padding: '14px 32px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#0088CC,#00D4FF)', color: '#000', fontFamily: 'Cairo,sans-serif', fontSize: 16, fontWeight: 700, cursor: 'pointer' }
const fullCenter: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060D1F' }
