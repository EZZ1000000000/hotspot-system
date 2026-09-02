// POST /api/rewards/start
// بيسجل المهمة كـ PENDING ويرجع الـ URL الحقيقي مع tracking_id
// المكافأة بتتسجل بس لما يجي الـ postback من الموقع
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { taskId, mac, sessionId, voucherId } = await req.json()
    if (!taskId || !mac) return NextResponse.json({ error: 'taskId و mac مطلوبين' }, { status: 400 })

    const task = await prisma.rewardTask.findUnique({ where: { id: taskId } })
    if (!task || !task.isActive) return NextResponse.json({ error: 'المهمة غير موجودة' }, { status: 404 })

    // هل المستخدم خلص المهمة دي قبل كده؟
    const existing = await prisma.rewardEarning.findFirst({
      where: { taskId, macAddress: mac, callbackReceived: true },
    })
    if (existing) return NextResponse.json({ error: 'أكملت هذه المهمة من قبل' }, { status: 409 })

    // هل فيه pending مش اتكمل؟ ارجعه نفسه
    const pending = await prisma.rewardEarning.findFirst({
      where: { taskId, macAddress: mac, callbackReceived: false },
    })

    let earning = pending
    if (!earning) {
      // إنشاء سجل PENDING جديد — مش بيتسجل كمكتمل لحد ما يجي الـ postback
      const token = `cb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      earning = await prisma.rewardEarning.create({
        data: {
          taskId,
          macAddress:       mac,
          sessionId:        sessionId || null,
          voucherId:        voucherId || null,
          callbackToken:    token,
          callbackReceived: false,   // ← مش مكتمل لحد ما يجي الـ postback
        },
      })
    }

    // بنبعت الـ URL الحقيقي مع tracking_id = callbackToken
    // الموقع هيبعت postback بـ tracking_id ده لما المستخدم يخلص
    const offerUrl = buildTrackedUrl(task.url, earning.callbackToken)

    return NextResponse.json({
      success:        true,
      pending:        true,
      callbackToken:  earning.callbackToken,
      openUrl:        offerUrl,
      task: {
        title:    task.title,
        timeMins: task.rewardTimeMins,
        dataMB:   task.rewardDataMB,
      },
    })
  } catch (e: any) {
    console.error('[rewards/start]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// بنحط tracking_id في الرابط عشان الموقع يبعته في الـ postback
function buildTrackedUrl(originalUrl: string, trackingId: string): string {
  try {
    const u = new URL(originalUrl)
    u.searchParams.set('tracking_id', trackingId)
    u.searchParams.set('aff_sub',     trackingId)   // بعض المواقع بتستخدم aff_sub
    u.searchParams.set('sub1',        trackingId)   // و sub1
    return u.toString()
  } catch {
    const sep = originalUrl.includes('?') ? '&' : '?'
    return `${originalUrl}${sep}tracking_id=${trackingId}`
  }
}
