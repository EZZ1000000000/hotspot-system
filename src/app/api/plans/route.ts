// /api/plans — الباقات العامة (للـ landing page والأدمن)
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const FALLBACK_PLANS = [
  { id:'free',       name:'مجاني',   emoji:'🚀', color:'#6B8CAE', price:0,    period:'للأبد',  maxDevices:1,  maxVouchersTotal:1000000, canCreateQR:false, canCreateNFC:false, canCreateUnlimited:false, features:['جهاز راوتر واحد','حتى مليون كارت واي فاي','لوحة تحكم كاملة','إحصائيات أساسية'], order:0 },
  { id:'basic',      name:'أساسي',   emoji:'⚡', color:'#00D4FF', price:null, period:'شهرياً', maxDevices:3,  maxVouchersTotal:1000000, canCreateQR:true,  canCreateNFC:false, canCreateUnlimited:false, features:['3 أجهزة راوتر','حتى مليون كارت شهرياً','كروت QR','إحصائيات متقدمة','دعم فني أولوية'], order:1 },
  { id:'pro',        name:'احترافي', emoji:'👑', color:'#7c3aed', price:null, period:'شهرياً', maxDevices:10, maxVouchersTotal:1000000, canCreateQR:true,  canCreateNFC:true,  canCreateUnlimited:true,  features:['10 أجهزة راوتر','حتى مليون كارت شهرياً','كروت QR + NFC','باقات Unlimited','دعم فني 24/7'], order:2 },
  { id:'enterprise', name:'مؤسسي',   emoji:'🏢', color:'#f59e0b', price:null, period:'شهرياً', maxDevices:50, maxVouchersTotal:1000000, canCreateQR:true,  canCreateNFC:true,  canCreateUnlimited:true,  features:['50 جهاز راوتر','حتى مليون كارت شهرياً','جميع المزايا','دعم مخصص','API كامل'], order:3 },
]

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } })
    if (plans.length > 0) return NextResponse.json(plans)
    return NextResponse.json(FALLBACK_PLANS)
  } catch {
    return NextResponse.json(FALLBACK_PLANS)
  }
}
