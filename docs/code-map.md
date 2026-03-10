# Code Map

## Directory Map (Planned)

| Path | Purpose |
|------|---------|
| `src/app/(auth)/` | Auth pages: login, register |
| `src/app/(main)/` | Main app pages: dashboard, profile, questionnaire, activities, calendar |
| `src/app/admin/` | Admin dashboard pages |
| `src/app/api/` | Route Handler API endpoints |
| `src/app/layout.tsx` | Root layout with providers |
| `src/components/ui/` | Shadcn UI components |
| `src/components/` | Feature-specific shared components |
| `src/lib/auth.ts` | Auth.js configuration |
| `src/lib/db.ts` | Prisma client singleton |
| `src/lib/utils.ts` | Utility functions |
| `src/server/actions/` | Server Actions (mutations) |
| `src/server/queries/` | Server-side data fetching |
| `src/types/` | Shared TypeScript types |
| `prisma/schema.prisma` | Database schema |
| `prisma/migrations/` | Database migrations |
| `prisma/seed.ts` | Seed script (admin user, grade options, etc.) |

## Application Entry Points

- `src/app/layout.tsx` — Root layout
- `src/app/page.tsx` — Landing/redirect
- `src/middleware.ts` — Auth + role-based route protection

## Important Configuration Files

| File | Controls |
|------|----------|
| `next.config.js` | Next.js configuration |
| `tailwind.config.ts` | TailwindCSS theme and plugins |
| `prisma/schema.prisma` | Database schema and relations |
| `tsconfig.json` | TypeScript compiler options |
| `.env.local` | Environment variables (not committed) |
| `components.json` | Shadcn UI configuration |

## Notable Scripts (package.json)

| Command | Purpose |
|---------|---------|
| `dev` | Start development server |
| `build` | Production build |
| `start` | Start production server |
| `lint` | Run ESLint |
| `db:migrate` | Run Prisma migrations |
| `db:generate` | Generate Prisma client |
| `db:seed` | Seed database |
| `db:studio` | Open Prisma Studio |

## Ignored Paths

- `node_modules/` — dependencies
- `.next/` — Next.js build output
- `.env.local` — secrets (not committed)
