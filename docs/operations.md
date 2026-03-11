# Operations

## Common Tasks

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Start production | `npm start` |
| Lint | `npm run lint` |
| Lint fix | `npm run lint -- --fix` |
| Type check | `npx tsc --noEmit` |

## Database Tasks

| Task | Command |
|------|---------|
| Create migration | `npx prisma migrate dev --name <name>` |
| Apply migrations | `npx prisma migrate deploy` |
| Generate client | `npx prisma generate` |
| Seed database | `npx prisma db seed` |
| Open Prisma Studio | `npx prisma studio` |
| Reset database | `npx prisma migrate reset` |

## Maintenance

- **Migrations:** Always create a new migration for schema changes; never edit existing migrations
- **Seeding:** Seed script is idempotent; safe to re-run
- **Cache clear:** Delete `.next/` directory and rebuild
- **Dependency update:** `npm update` then run full test suite

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Prisma client out of date | `npx prisma generate` |
| Migration drift | `npx prisma migrate dev` |
| Port 3000 in use | `lsof -i :3000` and kill process, or use `PORT=3001 npm run dev` |
| Supabase connection refused | Check `DATABASE_URL` and Supabase project status |

## Deployment (Vercel)

### Build & Deploy

- Push to `main` triggers auto-deploy via Vercel Git integration
- Build command (configured in `vercel.json`): `prisma migrate deploy && prisma generate && next build`
- `postinstall` script also runs `prisma generate` during `npm install`
- Migrations run automatically during the Vercel build via `prisma migrate deploy` (idempotent — skips already-applied migrations)

### Environment Variables

Configure these in the Vercel dashboard (Settings → Environment Variables):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase pooler recommended) |
| `NEXTAUTH_SECRET` | Random secret for Auth.js session encryption |
| `NEXTAUTH_URL` | Production URL (e.g., `https://your-app.vercel.app`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_APP_URL` | Public-facing app URL |
| `APP_VERSION` | App version string (optional, defaults to `0.1.0`) |

### Migration Workflow

1. Create migration locally: `npx prisma migrate dev --name <name>`
2. Commit the generated SQL file in `prisma/migrations/`
3. Push to `main` — Vercel build runs `prisma migrate deploy` automatically
4. Verify via health check: `GET /api/health` → `{ status: "ok", db: "connected" }`

### Health Check

- **Endpoint:** `GET /api/health`
- **Response:** `{ status: "ok", version: "x.y.z", db: "connected", timestamp: "..." }`
- Returns HTTP 503 with `status: "degraded"` if database is unreachable

### Security Headers

Configured in `vercel.json`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
