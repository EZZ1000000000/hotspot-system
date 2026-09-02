import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET — جلب الإشعارات
export async function GET(req: NextRequest) {
  const adminId = req.nextUrl.searchParams.get('adminId')
  if (!adminId) return NextResponse.json({ error: 'missing adminId' }, { status: 400 })

  const notifications = await prisma.notification.findMany({
    where: { hotspotAdminId: adminId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const unreadCount = notifications.filter(n => !n.isRead).length
  return NextResponse.json({ notifications, unreadCount })
}

// PATCH — تعليم كقروء
export async function PATCH(req: NextRequest) {
  const { adminId, notificationId, markAll } = await req.json()
  if (!adminId) return NextResponse.json({ error: 'missing adminId' }, { status: 400 })

  if (markAll) {
    await prisma.notification.updateMany({
      where: { hotspotAdminId: adminId, isRead: false },
      data: { isRead: true },
    })
  } else if (notificationId) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    })
  }

  return NextResponse.json({ success: true })
}

// DELETE — حذف الإشعارات المقروءة
export async function DELETE(req: NextRequest) {
  const adminId = req.nextUrl.searchParams.get('adminId')
  if (!adminId) return NextResponse.json({ error: 'missing adminId' }, { status: 400 })

  await prisma.notification.deleteMany({
    where: { hotspotAdminId: adminId, isRead: true },
  })

  return NextResponse.json({ success: true })
}
