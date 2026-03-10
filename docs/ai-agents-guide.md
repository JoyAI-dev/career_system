# AI Agents Guide

## Coding Conventions

- TypeScript strict mode enabled
- Use Server Components by default; add `"use client"` only when needed (interactivity, hooks, browser APIs)
- Server Actions for mutations; Route Handlers for complex API endpoints
- Zod for all input validation at API boundaries
- Prisma for all database access; no raw SQL unless performance-critical
- TailwindCSS for styling; no CSS modules or styled-components
- Shadcn UI components as base; customize via Tailwind

## Where to Make Changes Safely

| Area | Location | Notes |
|------|----------|-------|
| New pages | `src/app/(main)/` or `src/app/admin/` | Follow App Router conventions |
| New API endpoints | `src/app/api/` | Use Route Handlers |
| Server Actions | `src/server/actions/` | Group by domain (auth, questionnaire, activity) |
| Queries | `src/server/queries/` | Read-only data fetching |
| UI components | `src/components/` | Reusable; keep stateless where possible |
| DB schema | `prisma/schema.prisma` | Always create migration after changes |
| Types | `src/types/` | Shared interfaces and Zod schemas |

## How to Run, Test, and Lint Quickly

```bash
npm run dev          # Dev server with hot reload
npm run lint         # ESLint check
npm run lint -- --fix # Auto-fix lint issues
npx tsc --noEmit     # Type check without emitting
npm test             # Run tests
npx prisma studio    # Browse database
```

## Diff/PR Guidance

- Keep PRs focused on one feature or fix
- Always run `npm run lint` and `npx tsc --noEmit` before submitting
- Include migration files if schema changed
- Test state machine transitions when modifying activity workflow
- Verify scoring calculations when touching questionnaire logic

## Guardrails

- **No network installs** during automated runs
- **Never commit** `.env.local` or any file with secrets
- **Never log** passwords, tokens, or PII
- **Always validate** user input with Zod before processing
- **Always use** Prisma transactions for multi-step mutations
- **Always check** role authorization in middleware for admin routes
