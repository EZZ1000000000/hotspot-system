import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// wifidog بيبعت المستخدم هنا → نعمل redirect للـ portal على الـ VPS
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://babreizk.online'
  const portalUrl = new URL('/portal', serverUrl)
  params.forEach((v, k) => portalUrl.searchParams.set(k, v))
  return Response.redirect(portalUrl.toString(), 302)
}
