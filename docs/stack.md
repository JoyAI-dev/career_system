# Stack

## Languages and Versions

| Language | Version | Source of Truth |
|----------|---------|-----------------|
| TypeScript | 5.x | `tsconfig.json` |
| Node.js | 22 LTS | nvm on production server |

## Frameworks and Libraries

### Application Layer
- **Next.js 16** — App Router, Server Components, Server Actions, Route Handlers
- **React 19** — UI rendering

### UI Layer
- **TailwindCSS 4** — Utility-first CSS
- **Shadcn UI** — Component library (copy-paste, not dependency)
- **Recharts** — Radar chart for cognitive visualization
- **FullCalendar** (standard plugins) — Week/month calendar views
- **react-markdown** — Markdown rendering for activity guides

### Auth
- **Auth.js (NextAuth v5)** — Session orchestration, JWT sessions, credentials provider

### Data
- **Prisma 7** — ORM with pg driver adapter, migrations, schema management
- **PostgreSQL 16** — Primary datastore (Docker on production server)
- **Local filesystem** — File storage (/var/lib/career_system)

### External APIs
- **ZhiPu GLM-OCR** — Student ID card OCR recognition

## Build Tools and Package Managers

- **npm** — Package manager
- **Next.js CLI** — Build, dev, start
- **Prisma CLI** — Migrations, generate, seed

## Datastores

| Store | Purpose |
|-------|---------|
| PostgreSQL 16 | Primary relational data |
| Local filesystem | File uploads (student IDs) |

## Infrastructure / Deployment

- **pm2** — Process manager on production server (8.131.74.70)
- **Caddy** — Reverse proxy with auto TLS (career.joysort.cn)
