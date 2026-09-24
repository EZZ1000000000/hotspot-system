// يولّد src/generated/schema-sql.ts من prisma/schema.prisma
// شغّله بعد أي تعديل على السكيما:  npm run db:gen-schema
// الناتج = DDL كامل بيتزرع تلقائياً على أي قاعدة احتياطية فاضية أثناء الطوارئ (زرع ذاتي)
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
let sql = ''
try {
  sql = execSync(
    'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
    { encoding: 'utf8', cwd: ROOT, maxBuffer: 20 * 1024 * 1024 },
  )
} catch (e) {
  console.error('فشل التوليد:', e.message)
  process.exit(1)
}

const out = `// AUTO-GENERATED — متعدلش باليد. شغّل: npm run db:gen-schema
// DDL كامل من السكيما — بيتزرع تلقائياً على قاعدة احتياطية فاضية وقت الطوارئ (db-cluster)
export const SCHEMA_SQL = ${JSON.stringify(sql)}
export const SCHEMA_SQL_AT = ${JSON.stringify(new Date().toISOString())}
`

fs.mkdirSync(path.join(ROOT, 'src', 'generated'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'src', 'generated', 'schema-sql.ts'), out)
console.log('✅ schema-sql.ts generated (' + sql.length + ' chars)')
