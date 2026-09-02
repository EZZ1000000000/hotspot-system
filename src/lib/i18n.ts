// ── نظام اللغات — عربي / إنجليزي ────────────────────────────────────────────
export type Lang = 'ar' | 'en'

export const translations = {
  ar: {
    // NAV
    sessions:    'الجلسات',
    stats:       'إحصائيات',
    devices:     'الأجهزة',
    generate:    'توليد كروت',
    vouchers:    'الكروت',
    portal:      'إعدادات البوابة',
    config:      'إعداد الراوتر',
    profile:     'الملف الشخصي',
    notifications: 'الإشعارات',
    sales:       'المبيعات',
    logout:      'خروج',
    refresh:     'تحديث',

    // LOGIN
    login_title:    'لوحة التحكم',
    login_user:     'اسم المستخدم',
    login_pass:     'كلمة المرور',
    login_btn:      '🔐 دخول',
    login_loading:  'جاري الدخول...',
    login_err_empty:'أدخل اسم المستخدم وكلمة المرور',
    login_err_wrong:'اسم المستخدم أو كلمة المرور غير صحيحة',
    login_err_conn: 'خطأ في الاتصال',

    // SESSIONS
    active_sessions:  'الجلسات النشطة',
    no_sessions:      'لا يوجد جلسات نشطة',
    kick:             '🚫 قطع',
    kicked_ok:        '✅ تم قطع الجلسة',

    // DEVICES
    devices_title:    'الأجهزة',
    add_device:       '+ إضافة جهاز',
    device_name:      'اسم المكان',
    device_location:  'الموقع',
    device_router_ip: 'IP الراوتر',
    device_ssh_pass:  'SSH Password',
    device_wifi_ssid: 'اسم الـ WiFi',
    device_save:      '💾 حفظ',
    device_cancel:    'إلغاء',
    device_script:    '⚙️ سكريبت',
    device_active:    '● نشط',
    device_inactive:  '● متوقف',
    device_sessions:  'جلسات',
    device_vouchers_count: 'كروت',
    device_empty:     'أضف جهازك الأول!',

    // VOUCHERS
    voucher_generate: 'توليد كروت جديدة',
    voucher_type:     '🎴 نوع الكارت',
    voucher_standard: 'عادي (كود يدوي)',
    voucher_qr:       'QR Code (مسح بالكاميرا)',
    voucher_unlimited:'♾️ باقة غير محدودة',
    voucher_count:    'عدد الكروت',
    voucher_pkg:      'نوع الباقة',
    voucher_both:     'داتا + وقت',
    voucher_data:     'داتا فقط',
    voucher_time:     'وقت فقط',
    voucher_data_mb:  'الداتا (MB)',
    voucher_time_min: 'الوقت (دقيقة)',
    voucher_speed:    'السرعة (Mbps)',
    voucher_code_len: 'عدد حروف الكود',
    voucher_code_type:'نوع الكود',
    voucher_mix:      'حروف + أرقام',
    voucher_letters:  'حروف فقط',
    voucher_numbers:  'أرقام فقط',
    voucher_device:   'ربط بجهاز',
    voucher_all_dev:  'كل الأجهزة',
    voucher_generate_btn: 'توليد وطباعة',
    voucher_remaining:'الكروت المتبقية',
    voucher_not_enough:'⚠️ غير كافية',

    // NOTIFICATIONS
    notif_empty:      'لا توجد إشعارات',
    notif_mark_all:   'تعليم الكل كمقروء',
    notif_clear:      'حذف المقروءة',
    notif_just_now:   'الآن',
    notif_min_ago:    'د',
    notif_hr_ago:     'س',

    // PROFILE
    profile_title:    'الملف الشخصي',
    profile_info:     'بيانات الحساب',
    profile_name:     'الاسم الكامل',
    profile_phone:    'رقم الموبايل',
    profile_email:    'البريد الإلكتروني',
    profile_username: 'اسم المستخدم',
    profile_save:     '💾 حفظ التعديلات',
    profile_saving:   'جاري الحفظ...',
    profile_saved:    '✅ تم الحفظ بنجاح',
    profile_password: 'تغيير كلمة المرور',
    profile_current:  'كلمة المرور الحالية',
    profile_new:      'كلمة المرور الجديدة',
    profile_confirm:  'تأكيد كلمة المرور الجديدة',
    profile_change:   '🔐 تغيير كلمة المرور',
    profile_changed:  '✅ تم تغيير كلمة المرور',
    profile_mismatch: 'كلمتا المرور غير متطابقتين',
    profile_plan:     'معلومات الخطة',
    profile_plan_free:'🚀 مجاني',
    profile_joined:   'تاريخ الانضمام',

    // STATS
    stat_active:   'جلسات نشطة',
    stat_generated:'كروت اتضربت',
    stat_devices:  'أجهزة نشطة',
    stat_remaining:'كروت متبقية',

    // MISC
    loading:       'جاري التحميل...',
    error_conn:    'خطأ في الاتصال',
    save:          '💾 حفظ',
    cancel:        'إلغاء',
    preview:       '👁️ معاينة',
    copy:          '📋 نسخ',
    copied:        '✅ تم النسخ!',
    download:      '⬇️ تحميل',
  },

  en: {
    // NAV
    sessions:    'Sessions',
    stats:       'Statistics',
    devices:     'Devices',
    generate:    'Generate Cards',
    vouchers:    'Vouchers',
    portal:      'Portal Settings',
    config:      'Router Setup',
    profile:     'Profile',
    notifications: 'Notifications',
    sales:       'Sales',
    logout:      'Logout',
    refresh:     'Refresh',

    // LOGIN
    login_title:    'Admin Dashboard',
    login_user:     'Username',
    login_pass:     'Password',
    login_btn:      '🔐 Login',
    login_loading:  'Logging in...',
    login_err_empty:'Enter username and password',
    login_err_wrong:'Invalid username or password',
    login_err_conn: 'Connection error',

    // SESSIONS
    active_sessions:  'Active Sessions',
    no_sessions:      'No active sessions',
    kick:             '🚫 Kick',
    kicked_ok:        '✅ Session kicked',

    // DEVICES
    devices_title:    'Devices',
    add_device:       '+ Add Device',
    device_name:      'Place Name',
    device_location:  'Location',
    device_router_ip: 'Router IP',
    device_ssh_pass:  'SSH Password',
    device_wifi_ssid: 'WiFi Name',
    device_save:      '💾 Save',
    device_cancel:    'Cancel',
    device_script:    '⚙️ Script',
    device_active:    '● Active',
    device_inactive:  '● Offline',
    device_sessions:  'Sessions',
    device_vouchers_count: 'Vouchers',
    device_empty:     'Add your first device!',

    // VOUCHERS
    voucher_generate: 'Generate New Vouchers',
    voucher_type:     '🎴 Voucher Type',
    voucher_standard: 'Standard (manual code)',
    voucher_qr:       'QR Code (scan camera)',
    voucher_unlimited:'♾️ Unlimited Package',
    voucher_count:    'Voucher Count',
    voucher_pkg:      'Package Type',
    voucher_both:     'Data + Time',
    voucher_data:     'Data Only',
    voucher_time:     'Time Only',
    voucher_data_mb:  'Data (MB)',
    voucher_time_min: 'Time (minutes)',
    voucher_speed:    'Speed (Mbps)',
    voucher_code_len: 'Code Length',
    voucher_code_type:'Code Type',
    voucher_mix:      'Letters + Numbers',
    voucher_letters:  'Letters Only',
    voucher_numbers:  'Numbers Only',
    voucher_device:   'Link to Device',
    voucher_all_dev:  'All Devices',
    voucher_generate_btn: 'Generate & Print',
    voucher_remaining:'Remaining Vouchers',
    voucher_not_enough:'⚠️ Insufficient',

    // NOTIFICATIONS
    notif_empty:      'No notifications',
    notif_mark_all:   'Mark all as read',
    notif_clear:      'Clear read',
    notif_just_now:   'Just now',
    notif_min_ago:    'm',
    notif_hr_ago:     'h',

    // PROFILE
    profile_title:    'Profile',
    profile_info:     'Account Information',
    profile_name:     'Full Name',
    profile_phone:    'Phone Number',
    profile_email:    'Email Address',
    profile_username: 'Username',
    profile_save:     '💾 Save Changes',
    profile_saving:   'Saving...',
    profile_saved:    '✅ Saved successfully',
    profile_password: 'Change Password',
    profile_current:  'Current Password',
    profile_new:      'New Password',
    profile_confirm:  'Confirm New Password',
    profile_change:   '🔐 Change Password',
    profile_changed:  '✅ Password changed',
    profile_mismatch: 'Passwords do not match',
    profile_plan:     'Plan Information',
    profile_plan_free:'🚀 Free',
    profile_joined:   'Member since',

    // STATS
    stat_active:   'Active Sessions',
    stat_generated:'Cards Generated',
    stat_devices:  'Active Devices',
    stat_remaining:'Remaining Cards',

    // MISC
    loading:       'Loading...',
    error_conn:    'Connection error',
    save:          '💾 Save',
    cancel:        'Cancel',
    preview:       '👁️ Preview',
    copy:          '📋 Copy',
    copied:        '✅ Copied!',
    download:      '⬇️ Download',
  },
} as const

export type TranslationKey = keyof typeof translations['ar']

// Hook بسيط — بيحفظ اللغة في localStorage
export function getLang(): Lang {
  if (typeof window === 'undefined') return 'ar'
  return (localStorage.getItem('lang') as Lang) || 'ar'
}

export function setLang(lang: Lang) {
  localStorage.setItem('lang', lang)
}

export function t(lang: Lang, key: TranslationKey): string {
  return translations[lang][key] ?? translations['ar'][key] ?? key
}
