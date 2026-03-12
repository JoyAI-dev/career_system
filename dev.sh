#!/usr/bin/env bash
# Start local dev server for career_system
# Accessible via https://career-staging.joysort.cn (Caddy on admin.joysort.cn)
#
# Prerequisites:
#   - Local PostgreSQL: docker container "aas-postgres" running on port 5432
#   - Database "career_staging" created (see setup below)
#
# First-time setup:
#   docker exec aas-postgres psql -U aas -d postgres \
#     -c "CREATE USER career_staging WITH PASSWORD 'career_staging_2026';" \
#     -c "CREATE DATABASE career_staging OWNER career_staging;"
#   DATABASE_URL="postgresql://career_staging:career_staging_2026@127.0.0.1:5432/career_staging" npx prisma migrate deploy
#   npm run db:seed  # requires .env.dev copied to .env.local first, then restore

set -e
cd "$(dirname "$0")"

PORT=3450

echo "Starting career_system dev server on port $PORT"
echo "  Public URL: https://career-staging.joysort.cn"
echo "  Local URL:  http://localhost:$PORT"
echo ""

# Load .env.dev (Next.js 16 doesn't support --env-file)
set -a
source .env.dev
set +a

exec npx next dev -p "$PORT"
