// ─── Portal Redirect ────────────────────────────────────────────────────────
// بدل ما Next.js يحمل React Bundle الكبير، بنعمل redirect فوري للـ HTML الخالص
// اللي بيتجيب من /api/portal/page — ده أسرع بكتير على الراوتر
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from 'next/navigation'

interface Props {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function PortalRedirectPage({ searchParams }: Props) {
  // بنبني الـ query string من searchParams وبنعمل redirect للـ API HTML endpoint
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined) {
      params.set(key, Array.isArray(value) ? value[0] : value)
    }
  }
  const qs = params.toString()
  redirect(`/api/portal/page${qs ? `?${qs}` : ''}`)
}
