// POST /api/auth/logout — يمسح cookie الـ Google session
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  // امسح الـ google_session_id cookie
  res.cookies.set('google_session_id', '', {
    httpOnly: true,
    maxAge:   0,
    path:     '/',
    sameSite: 'lax',
  })
  return res
}
