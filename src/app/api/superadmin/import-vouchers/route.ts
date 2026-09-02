// POST /api/superadmin/import-vouchers
// بيستقبل CSV أو JSON فيه list من الأكواد
// ويضيفهم كـ vouchers لـ admin + device محددين
//
// CSV format (أبسط صيغة — عمود واحد):
//   code
//   ABC123
//   XYZ789
//
// أو multi-column:
//   code,dataLimitMB,timeLimitMin,packageType
//   ABC123,1024,120,BOTH
//   XYZ789,512,60,DATA_ONLY
//
// لو ما فيش أعمدة تانية — بياخد القيم الـ default من body الـ request

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const INT4_MAX = 2_147_483_647
const safeInt  = (v: any, fallback: number | null = null) => {
  const n = parseInt(v)
  if (isNaN(n) || n <= 0) return fallback
  return Math.min(n, INT4_MAX)
}

// ── parse CSV text ────────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    // split بس نتعامل مع quoted values لو فيها
    const values = splitCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim().replace(/^["']|["']$/g, '')
    })
    if (row['code'] || row[headers[0]]) {
      // لو الـ header مش code، خد العمود الأول كـ code
      if (!row['code']) row['code'] = row[headers[0]]
      rows.push(row)
    }
  }
  return rows
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"' || char === "'") { inQuotes = !inQuotes }
    else if (char === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += char }
  }
  result.push(current)
  return result
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      hotspotAdminId,
      deviceId,
      csvText,           // نص الـ CSV كامل
      codes,             // أو array من strings مباشرة
      // defaults لو الـ CSV ما فيهوش أعمدة تفصيلية:
      packageType    = 'BOTH',
      dataLimitMB,
      timeLimitMin,
      speedLimitMbps,
      voucherType    = 'STANDARD',
      maxUsageCount  = 1,
      validityDays,
    } = body

    if (!hotspotAdminId) return NextResponse.json({ error: 'hotspotAdminId مطلوب' }, { status: 400 })
    if (!deviceId)       return NextResponse.json({ error: 'deviceId مطلوب' }, { status: 400 })
    if (!csvText && (!codes || !codes.length))
      return NextResponse.json({ error: 'csvText أو codes مطلوب' }, { status: 400 })

    const admin = await prisma.hotspotAdmin.findUnique({ where: { id: hotspotAdminId } })
    if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })

    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })

    // ── parse الأكواد ───────────────────────────────────────────
    let rows: { code: string; dataLimitMB?: number|null; timeLimitMin?: number|null; packageType?: string }[] = []

    if (csvText) {
      const parsed = parseCSV(csvText)
      rows = parsed.map(r => ({
        code:        r['code']?.toUpperCase().trim(),
        dataLimitMB: r['datalimitmb'] ? safeInt(r['datalimitmb']) : undefined,
        timeLimitMin: r['timelimitmin'] ? safeInt(r['timelimitmin']) : undefined,
        packageType:  r['packagetype']?.toUpperCase() || undefined,
      })).filter(r => r.code && r.code.length >= 4)
    } else {
      rows = (codes as string[]).map(c => ({ code: c.toUpperCase().trim() })).filter(r => r.code.length >= 4)
    }

    if (rows.length === 0)
      return NextResponse.json({ error: 'لم يتم العثور على أكواد صالحة في الملف' }, { status: 400 })

    // ── فحص الأكواد المكررة في DB ──────────────────────────────
    const incomingCodes = rows.map(r => r.code)
    const existing = await prisma.voucher.findMany({
      where: { code: { in: incomingCodes } },
      select: { code: true },
    })
    const existingSet    = new Set(existing.map(v => v.code))
    const duplicateCount = existing.length
    const newRows        = rows.filter(r => !existingSet.has(r.code))

    if (newRows.length === 0) {
      return NextResponse.json({
        error:          `كل الأكواد (${rows.length}) موجودة بالفعل في قاعدة البيانات`,
        duplicateCount: rows.length,
        imported:       0,
      }, { status: 409 })
    }

    // ── احسب تاريخ الانتهاء ────────────────────────────────────
    let expiry: Date | null = null
    if (validityDays && validityDays > 0) {
      expiry = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
    }

    const finalPkgType = packageType === 'UNLIMITED' ? 'UNLIMITED' : (packageType || 'BOTH')
    const printBatch   = `IMPORT-${Date.now()}`

    // ── insert بـ batches of 100 عشان ما يفيضش الـ transaction ─
    const BATCH = 100
    let imported = 0
    for (let i = 0; i < newRows.length; i += BATCH) {
      const batch = newRows.slice(i, i + BATCH)
      await prisma.$transaction(
        batch.map(row => {
          const rowPkg  = (row.packageType as any) || finalPkgType
          const rowData = row.dataLimitMB  !== undefined ? row.dataLimitMB  : safeInt(dataLimitMB)
          const rowTime = row.timeLimitMin !== undefined ? row.timeLimitMin : safeInt(timeLimitMin)
          return prisma.voucher.create({
            data: {
              code:           row.code,
              packageType:    rowPkg,
              voucherType:    voucherType as any,
              dataLimitMB:    rowPkg === 'UNLIMITED' ? null : rowData,
              timeLimitMin:   rowPkg === 'UNLIMITED' ? null : rowTime,
              speedLimitMbps: speedLimitMbps || null,
              maxUsageCount:  maxUsageCount || 1,
              expiresAt:      expiry,
              validityDays:   validityDays || null,
              printBatch,
              deviceId,
              hotspotAdminId,
            },
          })
        })
      )
      imported += batch.length
    }

    // ── حدّث العداد ────────────────────────────────────────────
    await prisma.hotspotAdmin.update({
      where: { id: hotspotAdminId },
      data:  { totalVouchersGenerated: { increment: imported } },
    })

    return NextResponse.json({
      success:        true,
      imported,
      duplicateCount,
      skipped:        duplicateCount,
      total:          rows.length,
      printBatch,
      message:        `✅ تم استيراد ${imported} كارت${duplicateCount > 0 ? ` — تم تخطي ${duplicateCount} كود مكرر` : ''}`,
    })

  } catch (err: any) {
    console.error('[import-vouchers]', err)
    // Unique constraint = كود مكرر وقع في الـ batch
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'بعض الأكواد مكررة — حاول مرة تانية' }, { status: 409 })
    }
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
