import { NextRequest } from 'next/server'
import { handleWifidogAuth } from '@/wifidog/auth-handler'

export const dynamic = 'force-dynamic'

// wifidog بيتوقع بالضبط: "Auth: 1\n" أو "Auth: 0\n"  (HTTP 200, text/plain)
export async function GET(req: NextRequest) {
  const result = await handleWifidogAuth(new URL(req.url).searchParams)
  const body = result + '\n'
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': String(Buffer.byteLength(body, 'utf8')),
    },
  })
}
