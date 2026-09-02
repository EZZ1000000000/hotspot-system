// GET /api/cron/sync-offers — بيتشغل كل 10 دقايق عشان يجيب الـ offers من كل مصدر
// ممكن تضيفه في Vercel Cron Jobs أو تشغله يدوي من السوبر أدمن
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ─── CPAGrip fetcher ───────────────────────────────────────────────────────
async function syncCpaGrip(source: any): Promise<{ added: number; updated: number; errors: string[] }> {
  const errors: string[] = []
  let added = 0, updated = 0

  try {
    const url = `https://www.cpagrip.com/common/offer_feed_json.php?user_id=${source.userId}&pubkey=${source.pubKey}&tracking_id=SYNC`
    const res  = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const offers: any[] = data.offers || data || []

    for (const o of offers) {
      try {
        const externalId = String(o.offer_id || o.id || '')
        if (!externalId) continue
        const payload = {
          source:      'cpagrip',
          title:       String(o.offer_name || o.name || '').slice(0, 255),
          description: String(o.offer_desc || o.description || '').slice(0, 500) || null,
          url:         String(o.offer_url  || o.link || ''),
          payout:      parseFloat(o.payout || o.epc || '0') || 0,
          category:    String(o.category || '').slice(0, 100) || null,
          countries:   Array.isArray(o.countries) ? o.countries.join(',') : (o.country || 'ALL'),
          imageUrl:    o.image_url || o.logo || null,
          lastFetchAt: new Date(),
          isActive:    true,
        }
        const existing = await prisma.cpaOffer.findUnique({ where: { source_externalId: { source: 'cpagrip', externalId } } })
        if (existing) {
          await prisma.cpaOffer.update({ where: { id: existing.id }, data: payload })
          updated++
        } else {
          await prisma.cpaOffer.create({ data: { ...payload, externalId } })
          added++
        }
      } catch (err: any) {
        errors.push(`offer error: ${err.message}`)
      }
    }
  } catch (err: any) {
    errors.push(`cpagrip fetch error: ${err.message}`)
  }

  return { added, updated, errors }
}

// ─── Main handler ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // حماية بسيطة بـ secret
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret')
  const env    = process.env.CRON_SECRET
  if (env && secret !== env) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const sources = await prisma.cpaSource.findMany({ where: { isActive: true } })
    const results: Record<string, any> = {}

    for (const src of sources) {
      if (src.name === 'cpagrip') {
        results.cpagrip = await syncCpaGrip(src)
        await prisma.cpaSource.update({ where: { id: src.id }, data: { lastSync: new Date() } })
      }
      // ممكن تضيف هنا ogads / adgate / lootably بنفس الطريقة
    }

    // سجل في الـ AuditLog
    await prisma.auditLog.create({
      data: {
        action:     'SYNC_CPA_OFFERS',
        entityType: 'CpaOffer',
        actorType:  'SYSTEM',
        details:    JSON.stringify(results),
      },
    })

    return NextResponse.json({ success: true, results, syncedAt: new Date() })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
