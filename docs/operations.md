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

- Push to `main` branch triggers auto-deploy
- Environment variables configured in Vercel dashboard
- Build command: `npx prisma generate && npm run build`
- Migrations run via CI or manually before deploy: `npx prisma migrate deploy`
