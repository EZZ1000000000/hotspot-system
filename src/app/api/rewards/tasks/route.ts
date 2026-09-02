// GET  /api/rewards/tasks?mac=XX&sessionToken=YY
// جيب المهام المتاحة للمستخدم مع حالة كل واحدة
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mac          = searchParams.get('mac') || ''
    const sessionToken = searchParams.get('sessionToken') || ''

    const tasks = await prisma.rewardTask.findMany({
      where: { isActive: true },
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
    })

    // جيب المهام اللي المستخدم ده أكملها
    const done = await prisma.rewardEarning.findMany({
      where: { macAddress: mac, callbackReceived: true },
      select: { taskId: true },
    })
    const doneIds = new Set(done.map(d => d.taskId))

    // حساب الـ level الحالي للمستخدم
    const totalDone = done.length
    let currentLevel = 1
    const levelMap: Record<number, number> = {}
    tasks.forEach(t => { levelMap[t.level] = (levelMap[t.level] || 0) + t.requiredCount })
    let accum = 0
    for (const [lvl, req] of Object.entries(levelMap).sort()) {
      accum += req
      if (totalDone >= accum) currentLevel = Number(lvl) + 1
    }

    const enriched = tasks.map(t => ({
      ...t,
      callbackSecret: undefined, // لا ترجع الـ secret للعميل
      isDone: doneIds.has(t.id),
      isUnlocked: t.level <= currentLevel,
    }))

    return NextResponse.json({ tasks: enriched, currentLevel, totalDone })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ── CRUD للسوبر أدمن ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      title, description, url, callbackSecret,
      rewardType, rewardTimeMins, rewardDataMB,
      level, requiredCount, order,
      superAdminId,
    } = body

    if (!title || !url || !callbackSecret || !rewardType || !superAdminId)
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })

    const task = await prisma.rewardTask.create({
      data: {
        title, description: description || null,
        url, callbackSecret,
        rewardType,
        rewardTimeMins: rewardTimeMins || null,
        rewardDataMB:   rewardDataMB   || null,
        level:          level          || 1,
        requiredCount:  requiredCount  || 1,
        order:          order          || 0,
        superAdminId,
      },
    })
    return NextResponse.json({ success: true, task }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...data } = body
    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })
    const task = await prisma.rewardTask.update({ where: { id }, data })
    return NextResponse.json({ success: true, task })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await prisma.rewardTask.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
