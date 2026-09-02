import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// wifidog بيبعت هنا لما يرفض مستخدم
// /api/wifidog/gw_message.php?message=denied
export async function GET(_req: NextRequest) {
  return new Response('Pong\n', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

export async function POST(_req: NextRequest) {
  return new Response('Pong\n', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}
