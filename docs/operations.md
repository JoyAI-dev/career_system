# Operations

## Common Tasks

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Start production | `npm start` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Tests | `npm test` |

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
| DB connection refused | Check `DATABASE_URL` in `.env.local` and PostgreSQL container status |

## Deployment

### Architecture

```
User → career.joysort.cn (HTTPS)
     → Caddy reverse proxy on admin.joysort.cn (10.0.1.198)
     → Next.js app on 8.131.74.70 (10.0.1.201:3000, pm2: career-system)
     → PostgreSQL 16 on 8.131.74.70 (Docker: postgres16, 127.0.0.1:5432)
```

### Deploy via Claude Code

Use the `/deploy` skill with arguments: `full`, `code-only`, `db-migrate`, `restart`.

### Manual Deploy

```bash
# Full deploy
ssh root@8.131.74.70 "cd /opt/career_system && git pull origin main && source /root/.nvm/nvm.sh && npm install && npx prisma migrate deploy && npm run build && pm2 restart career-system"
```

### Environment Variables

Configured in `/opt/career_system/.env.local` on the production server (not overwritten by git pull):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Auth.js session secret |
| `AUTH_URL` | `https://career.joysort.cn` |
| `ZHIPU_API_KEY` | ZhiPu OCR API key (student ID recognition) |
| `ADMIN_SEED_PASSWORD` | Initial admin password |

### Health Check

- **Endpoint:** `GET /api/health`
- **Response:** `{ status: "ok", version: "x.y.z", db: "connected", timestamp: "..." }`

### Security Headers

Configured in `next.config.ts`: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP.
