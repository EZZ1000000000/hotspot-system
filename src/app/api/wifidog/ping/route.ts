import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// wifidog بيتوقع بالضبط: Pong\n  (HTTP 200, text/plain)
// أي حاجة تانية = "Auth server did NOT say Pong"
function makePong() {
  return new Response('Pong\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': '5',
    },
  })
}

export async function GET(_req: NextRequest) { return makePong() }
export async function POST(_req: NextRequest) { return makePong() }
