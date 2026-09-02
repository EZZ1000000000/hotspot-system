// =============================================
// Tour Guide System — إدارة حالة الجولة التعريفية
// يشتغل أول مرة إجباري لكل نوع مستخدم
// =============================================

export type TourStep = {
  id: string
  title: string
  description: string
  target?: string        // CSS selector للعنصر المستهدف
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  icon?: string
  highlight?: boolean
}

export type TourType = 'admin' | 'superadmin' | 'sales' | 'portal'

// مفاتيح localStorage لكل نوع مستخدم
const TOUR_KEYS: Record<TourType, string> = {
  admin:      'hs_tour_admin_done',
  superadmin: 'hs_tour_superadmin_done',
  sales:      'hs_tour_sales_done',
  portal:     'hs_tour_portal_done',
}

export function isTourDone(type: TourType): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(TOUR_KEYS[type]) === '1'
}

export function markTourDone(type: TourType): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOUR_KEYS[type], '1')
}

export function resetTour(type: TourType): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOUR_KEYS[type])
}
