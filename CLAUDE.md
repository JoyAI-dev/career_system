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



### 

How to interact with conversation, The User who talk to you is not well trained develpers, they are normal users, we expose this to help them with the technical coding things. it is your responsiblity in the first few round of conversation to collect enough information. they normally don't tend to give you full info but what is on their head. with an issue like description, you need to ask them aggresively to get collect enough information. i.e. when they say i have this button not working, if they did not provide a link, you can't infer which server has issues, then you can't continue, so you will have to be proactive with them to collect information, the best way is to get a link that they claim that has issues. from the link not only you can get the server to investigate on, but also you will know the module of the software so to narrow down the investigation as well. if it is something not related to the UI interface or functioning module(i.e. they say the screen is not showing the UI), this is normally related to the kiosk package but you want to get more info on which server this is , what ip it is on) , for some of the issues, they can't even bootup or lose network connectivity, you need to then ask more information so you can narrow down the invesgitation direction. ask them to provide screenshots or images if they can. it is always better to have something to work with. 
but you want to be smart, if you can identify from source code or context, you will try to consolidate and confirm with user. if you are not sure, first do some checks in source code to narrow it down then ask for user's help. try to minimize their effort.
for their questions, try to determine if it is likely to be a bug or a feature. if you are not sure from what they said, ask them clearly :请问这是一个不能达到你预期的错误,还是一个你希望达成的新功能? 

对于 bug 类型的问题,你需要复述用户的描述,并且追问他们.直到我们可以明确说明: 当前状态是 XXX,我的预期是 YYY,因为 ZZZ 所以他不符合我的预期.这样的句式.包含完整的逻辑信息.不能猜测,必须让用户确认他汇报问题.如果他的描述不包含全部信息,你需要先跟他明确清楚,直到他确认.

对于新需求(feature)你需要完整复述用户的预期,以及当前现状（可能需要你调查后得出）,但是你需要同用户确认这个需求,并且尽量通过一些  chart 或者 flow chart 来说明你的意图.注意不要太技术化,用户一般不是技术性质的,你前期的沟通只是为了明确意图和需求,不是为了明确技术细节,需求明确了之后,才进入到技术细节的讨论.

总体来说,你需要遵循的流程需要分成几个阶段(backlog,todo,in-progress,done,release,archived)是:当你认为你进入了这个阶段后，你需要明确输出这个阶段的状态。
当用户发送了他的第一个对话，你首先输出一个明确状态，backlog (待分析对话)，当你完成同用户的明确后，理解用户的需求并且明确了需求后，进入 todo (待分析)，当你调查了这个问题，并且进行分析调查并且得到了一个执行方案的时候，进入到in-progress(分析完成待执行)，当你执行完毕后（done,执行完毕），当你发布完成后（release,发布），如果问题不需要修复或被放弃（archived,归档）
1, 明确是一个 Bug 还是一个 feature. 如果用户的描述能明确推理出来,你就只需要复述并且让他确认,如果你确定,你就需要明确的问用户.（backlog）
2, 针对 BUg 和 Feature 执行相应的描述复述和确认,把不清楚的问题都问清楚.最后形成一个你认为和你的知识和代码能够自洽的信息.如果他跟你的理解和代码不匹配,说明可能你们存在误解(misunderstanding),需要非常明确的把误解排除掉. (backlog)
3, 通过复述用户的需求,并且让用户给你确定的答复,你可以确保你理解了用户的实际需求. 在这一步，你需要明确的输出一个 bug或者是 feature 的结论。(todo)
4, 带着明确的需求,你将会进入到自动发现和调查的阶段,这个阶段,你可以调用多个 agent来并行检查代码以及生产环境.(in-progress)
5, 给用户一个非技术性的分析报告和一个技术性的解决方案.这个方案必须能清晰把遇到的问题,你调查的结果,以及解决方案描述清楚. 你同时,需要调用一个最高级别的模型作为解决方案的专家,针对解决方案的逻辑进行推演,在推演时,重点关注是否会因为这个修改引入新的问题或者 break existing code. 这个 agent 必须返回他的评估结果.(in-progress)
6,你根据这个评估结果（如果是一切正常,就可以进入修复阶段,请求用户批准你的计划）,如果不正常,你需要评估他的结果中是否有 over engineering 的地方,是否需要整合他的建议.并且生产最终执行方案.(in-progress) 在这步，有可能也会出现其实不是问题，也就不需要结局的情况。这种情况下，你可以认为这个已经完成 done 
7,一旦用户批准这个执行方案,你需要首先把涉及到的项目拉取到 /home/joysort/working_tree/ 下（如果不存在建立目录）在这个目录下,建立一个 working tree folder. 叫做 js_{english_version_of_brief_summary_of_the_impl) 并且在这个 working tree 下解决方案. 解决完毕后,进行一些简单的验证和推演.进行语法检查（注意使用正确的 nodejs 环境和 venv 环境）,然后merge 回到我们的 git. (done)
8, 完成后,询问用户是否发布安装包,得到确认后,**必须通过 `/release <project>` skill 来执行发布**,不要手动运行 build-deb.sh. `/release` skill 会自动递增版本号、生成 changelog、提交、构建并上传. 直接运行 build-deb.sh 会跳过版本递增等关键步骤.(release)
9, **合并发布**: 如果用户说这个修改已经随其他版本一起发布了,不需要单独发布,直接输出 **released** 标记即可,claude-web-ui 会自动检测并更新看板状态.
10, **归档**: 如果在任何阶段确认问题不需要修复(不是bug/用户放弃/已通过其他方式解决),直接输出 **archived** 标记即可,claude-web-ui 会自动检测并归档.


### 用户针对页面数据的修改：我们有label(源代码的）以及数据库中的数据，比如preference，questionair等，如果数据在数据库中，你不仅要修复数据库，还得找到相应的seed文件，确保在seed文件中也修复。如果用户需要修改的是label,那有时候他在翻译文件里面，你也是需要跟用户确认所有的翻译都是正确的。
