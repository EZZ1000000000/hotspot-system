// GET /api/wifidog/logout?token=XXX
// wifidog بيبعت ده لما المستخدم يضغط logout أو يفصل
// الرد المطلوب: "Goodbye\n"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function goodbye() {
  return new NextResponse('Goodbye\n', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')

  if (!token) return goodbye()

  try {
    // دور على الجلسة بالتوكن
    const session = await prisma.session.findUnique({
      where: { token },
    })

    if (session && session.status === 'ACTIVE') {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          status:    'ENDED',
          endedAt:   new Date(),
          endReason: 'USER_LOGOUT',
        },
      })
    }
  } catch (err) {
    // حتى لو في error، ارجع Goodbye عشان wifidog ميتعطلش
    console.error('[wifidog logout]', err)
  }

  return goodbye()
}

// بعض الإصدارات بتبعت POST
export async function POST(req: NextRequest) {
  return GET(req)
}
