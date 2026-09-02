import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create Super Admin
  const hashedPassword = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD || "changeme123", 10)
  
  const superAdmin = await prisma.superAdmin.upsert({
    where: { username: process.env.SUPER_ADMIN_USERNAME || "superadmin" },
    update: {},
    create: {
      username: process.env.SUPER_ADMIN_USERNAME || "superadmin",
      password: hashedPassword,
      email: process.env.SUPER_ADMIN_EMAIL || "admin@example.com",
    },
  })

  console.log("Super Admin created:", superAdmin.username)
  console.log("Done! You can now login at /superadmin")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
