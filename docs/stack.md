# Stack

## Languages and Versions

| Language | Version | Source of Truth |
|----------|---------|-----------------|
| TypeScript | 5.x | `tsconfig.json` |
| Node.js | 20 LTS | `.nvmrc` / `package.json` engines |

## Frameworks and Libraries

### Application Layer
- **Next.js 14+** — App Router, Server Components, Server Actions, Route Handlers
- **React 18** — UI rendering

### UI Layer
- **TailwindCSS** — Utility-first CSS
- **Shadcn UI** — Component library (copy-paste, not dependency)
- **Recharts** — Radar chart for cognitive visualization
- **FullCalendar** (standard plugins) — Week/month calendar views
- **react-markdown** — Markdown rendering for activity guides

### Auth
- **Auth.js (NextAuth v5)** — Session orchestration, JWT sessions, credentials provider

### Data
- **Prisma** — ORM, migrations, schema management
- **PostgreSQL** — Primary datastore (Supabase-hosted)
- **Supabase Storage** — Private file storage (student ID uploads)

## Build Tools and Package Managers

- **npm** or **pnpm** — Package manager
- **Next.js CLI** — Build, dev, start
- **Prisma CLI** — Migrations, generate, seed

## Datastores

| Store | Purpose |
|-------|---------|
| PostgreSQL (Supabase) | Primary relational data |
| Supabase Storage | Private file uploads (student IDs) |

## Infrastructure / Deployment

- **Vercel** — Serverless deployment, global CDN, auto-deploy from Git
- **Supabase** — Managed PostgreSQL + Storage

## Observability

- Console logging (structured JSON in production) — initial baseline
- Vercel Analytics — performance monitoring
