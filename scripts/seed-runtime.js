// Runtime seed — plain JS (بدون ts-node) يعمل داخل الـ Docker
// بإنشاء/تحديث السوبر أدمن فقط لو مش موجود (idempotent)
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const username = process.env.SUPER_ADMIN_USERNAME || 'superadmin'
  const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin@2024'
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@hotspot.local'

  const existing = await prisma.superAdmin.findUnique({ where: { username } })
  if (existing) {
    console.log('Super admin already exists:', username)
    return
  }
  const hashedPassword = await bcrypt.hash(password, 10)
  const sa = await prisma.superAdmin.create({
    data: { username, password: hashedPassword, email },
  })
  console.log('Super admin created:', sa.username)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
