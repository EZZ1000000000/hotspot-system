# ══════════════════════════════════════════════════════════════
# Hugging Face Spaces — Docker Image
# Hotspot Management System (Next.js 14 + Prisma/SQLite)
# ══════════════════════════════════════════════════════════════
FROM node:20-slim

# openssl for Prisma + build tools as fallback for ssh2 native compile
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates bash python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# copy the rest of the app
COPY . .

# generate prisma client + build next
RUN npx prisma generate && NEXT_TELEMETRY_DISABLED=1 npx next build

# ── runtime defaults (يمكن تغييرها من Space Secrets) ──
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/data/hotspot.db \
    NEXTAUTH_SECRET=hf-space-hotspot-secret-change-me \
    SUPER_ADMIN_USERNAME=superadmin \
    SUPER_ADMIN_PASSWORD=Admin@2024 \
    SUPER_ADMIN_EMAIL=admin@hotspot.local \
    CRON_SECRET=hotspot-cron-2024

EXPOSE 3000

CMD ["bash", "start.sh"]
