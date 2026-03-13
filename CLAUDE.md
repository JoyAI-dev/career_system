# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Student career exploration platform (学生职业探索平台) built with Next.js 16 (App Router). Helps university students explore career directions through cognitive assessments, community activities, and reflections. Deployed on self-hosted server `8.131.74.70` via pm2.

## Commands

```bash
pm2 start ecosystem.config.cjs   # Start dev server via pm2 (port 3450, public: career-staging.joysort.cn)
pm2 restart career-staging       # Restart dev server (cleanly kills all child processes)
pm2 stop career-staging          # Stop dev server
pm2 logs career-staging          # View dev server logs
pm2 status                       # Check dev server status
npm run build            # Production build (runs prisma generate + next build)
npm run lint             # ESLint (flat config, next/core-web-vitals + prettier)
npm run typecheck        # TypeScript type checking
npm test                 # Unit tests (vitest, src/**/*.test.ts)
npm run test:watch       # Vitest watch mode
npm run test:integration # Integration tests (requires .env.local, separate config)
npm run db:migrate       # Prisma migrate dev (creates migration)
npm run db:generate      # Generate Prisma client
npm run db:seed          # Seed database (admin user, grade options, questionnaire v1, activity types, tags)
npm run db:studio        # Prisma Studio GUI
```

### Running a single test
```bash
npx vitest run src/server/scoring.test.ts              # Single unit test file
npx vitest run --testNamePattern "pattern"              # By test name
```

### Local Development (Staging)

Dev server is managed by **pm2** via `ecosystem.config.cjs` (pm2 name: `career-staging`, port 3450). Environment variables are embedded in `ecosystem.config.cjs` (sourced from `.env.dev`).

```bash
pm2 start ecosystem.config.cjs    # First time: register and start
pm2 restart career-staging         # Restart (cleanly kills entire process tree including next-server)
pm2 stop career-staging            # Stop
pm2 logs career-staging            # View logs (stdout + stderr)
pm2 status                         # Check status
```

**Why pm2 instead of `./dev.sh`**: `next dev` spawns a deep process tree (`npx` → `sh` → `node` → `next-server` → `node`). Manually killing the top process leaves orphan `next-server` processes holding the port. pm2's `treekill` ensures all child processes are properly terminated on stop/restart.

`./dev.sh` is retained for manual one-off testing only, not for regular development.

```
Local:  http://localhost:3450
Public: https://career-staging.joysort.cn  (Caddy on admin.joysort.cn → 172.30.3.123:3450)
```

**Database**: Local PostgreSQL in Docker container `aas-postgres` (port 5432), database `career_staging`, user `career_staging`.

**First-time setup**:
```bash
# Create database (if not already done)
docker exec aas-postgres psql -U aas -d postgres \
  -c "CREATE USER career_staging WITH PASSWORD 'career_staging_2026';" \
  -c "CREATE DATABASE career_staging OWNER career_staging;"

# Run migrations
DATABASE_URL="postgresql://career_staging:career_staging_2026@127.0.0.1:5432/career_staging" npx prisma migrate deploy

# Seed data (temporarily swap env, then restore)
cp .env.dev .env.local && npx prisma db seed && rm .env.local

# Start dev server
pm2 start ecosystem.config.cjs
```

**ai_helper on staging**: `https://career-staging.joysort.cn/ai_helper/` is protected by HTTP basic auth (admin / L0ndon2016!).

**Env files**:
- `ecosystem.config.cjs` — pm2 config with embedded env vars for dev/staging (the primary way to run dev server)
- `.env.dev` — env var reference file (not directly used by pm2, kept for manual `./dev.sh` testing)
- `.env.local` — production config (only exists on prod server `8.131.74.70:/opt/career_system/.env.local`)
- Never use `.env.local` locally

### Deployment
Use the `/deploy` skill with arguments: `full`, `code-only`, `db-migrate`, `restart`. Production is at `8.131.74.70` (pm2: career-system, port 3000), proxied through `career.joysort.cn`.

Node on prod requires `source /root/.nvm/nvm.sh` before any node/npm/pm2 command.

## Architecture

### Tech Stack
- **Framework**: Next.js 16 + React 19 + TypeScript
- **Styling**: TailwindCSS 4 + Shadcn UI (components in `src/components/ui/`)
- **Database**: Prisma 7 with `@prisma/adapter-pg` (pg driver adapter, NOT Prisma's default Rust engine) → PostgreSQL 16
- **Auth**: Auth.js v5 (next-auth) with credentials provider + JWT sessions
- **i18n**: next-intl — locales: zh (default), en, fr. Config at `src/i18n/config.ts`, messages at `src/messages/`
- **Validation**: Zod schemas at API boundaries
- **Charts**: Recharts (radar charts for cognitive scores)
- **Calendar**: FullCalendar
- **OCR**: ZhiPu GLM-OCR API for student ID card recognition

### File Storage
Local filesystem at `/var/lib/career_system` (production) or `.data/` (development). Override with `DATA_DIR` env var.

Directory layout:
```
{DATA_DIR}/
  uploads/
    student-ids/{userId}/{timestamp}.{ext}
    ... (future upload categories go here)
```

**IMPORTANT**: Never store files directly in DATA_DIR root. Always use subdirectories under `uploads/`.

Storage utilities in `src/lib/storage.ts`. Files served via auth-gated API route `GET /api/files/student-ids/[userId]/[filename]`.

### Route Groups (src/app/)
- `(auth)/` — Login, register pages (public)
- `(main)/` — Authenticated pages: dashboard, activities, cognitive-report, calendar, notifications, profile
- `(questionnaire)/` — Mandatory initial questionnaire flow (standalone layout, no sidebar)
- `admin/` — Admin dashboard (ADMIN role required)
- `api/` — Route Handlers (health, auth, upload, files, notifications, debug)

### Server-Side Code Pattern (src/server/)
Mutations and queries are separated:
- `src/server/actions/` — Server Actions (mutations): activity, auth, user, questionnaire, comment, notification, tag, reflection, recruitment, announcement, admin
- `src/server/queries/` — Data fetching functions: imported by Server Components directly
- `src/server/services/` — Service layer: upload (local storage + OCR), studentId (file URL resolution)
- `src/server/stateMachine.ts` — Activity status transitions: OPEN → FULL (auto on join) → SCHEDULED → IN_PROGRESS → COMPLETED
- `src/server/scoring.ts` — Pure scoring engine (calculateScores) + DB wrapper (getSnapshotScores). Topic score = avg(question scores)
- `src/server/notifications.ts` — Notification trigger helpers

### Student ID Upload Flow
1. User uploads image via `POST /api/upload` → saved to local filesystem
2. ZhiPu GLM-OCR extracts student info (name, school, major, grade) via base64
3. User profile auto-updated with OCR results (best-effort, upload succeeds even if OCR fails)
4. Admin views student ID via `GET /api/admin/student-id?userId=X` → returns file URL
5. File served via `GET /api/files/student-ids/[userId]/[filename]` (auth: self or ADMIN)

### Auth Helpers (src/lib/auth.ts)
- `requireAuth()` / `requireAdmin()` — For Server Actions (throws on failure)
- `requireAuthPage()` / `requireAdminPage()` — For Server Components (redirects on failure)

### Database
- Prisma schema at `prisma/schema.prisma` with pg driver adapter
- `prisma.config.ts` handles env resolution: checks `POSTGRES_PRISMA_URL` → `POSTGRES_URL` → `DATABASE_URL` → `POSTGRES_URL_NON_POOLING`
- DB singleton in `src/lib/db.ts` with connection pooling (prod: max=1, dev: max=10)
- Env file: `.env.local` (not committed). See `.env.example` for required vars.

### Key Domain Models
- **Questionnaire**: QuestionnaireVersion → Topic → Dimension → Question → AnswerOption (3-tier hierarchy)
- **Responses**: ResponseSnapshot (immutable) → ResponseAnswer → ResponseComment
- **Activities**: ActivityType (progressive unlock chain) → Activity → Membership (LEADER/MEMBER roles)
- **Announcements**: Announcement → AnnouncementView (with countdown timer for new users)

### Layout Distinction
- Admin users: sidebar + header layout
- Student users: full-width, no sidebar
- Non-admin users without completed questionnaire are redirected to `/questionnaire` (enforced in `src/app/(main)/layout.tsx`)

### Error System (src/lib/errors.ts)
Custom error hierarchy: `AppError` → `UnauthorizedError`, `ForbiddenError`, `RateLimitError`, `ValidationError`, `ConflictError`, `NotFoundError`. Use `mapErrorToResponse()` to convert to standardized API responses.

### Path Alias
`@/*` maps to `./src/*` (configured in tsconfig.json)

## Testing

- Unit tests: `vitest.config.ts` — includes `src/**/*.test.ts`, excludes `*.integration.test.ts`
- Integration tests: `vitest.integration.config.ts` — includes `src/**/*.integration.test.ts`, requires real DB connection via `.env.local`
- Test files live alongside the code they test (e.g., `src/server/scoring.test.ts`, `src/server/actions/__tests__/`)
