# Overview

## Purpose and Scope

Career Exploration Platform for university students facing fragmented career information, lack of structured cognition growth paths, and limited quality discussion opportunities. The platform builds a structured career cognition growth system through three core mechanisms.

## Core Formula

**Career Development = Knowledge + Social Learning + Reflection**

## High-Level Capabilities

- **Cognitive Boundary Exploration:** 3-tier questionnaire system (Topic → Dimension → Question) that maps what users know, don't know, and how deeply they understand career topics
- **Community Activity System:** Progressive activity types (roundtable → exploration partner → deep dive → competition → trial → focused discussion → mentor auction → internship auction) that unlock sequentially
- **Activity Calendar:** Personal calendar showing enrolled activities and recruitment info (week/month views, Chinese locale)
- **Growth Loop:** Activity completion → questionnaire update → cognitive growth visualization (radar chart)

## Primary Entry Points

- **Web UI:** Next.js App Router (SSR + client components)
- **API:** Next.js Route Handlers + Server Actions
- **Admin:** Role-gated admin dashboard within the same app

## Project Shape

Full-stack monolith using Next.js App Router. Single deployable unit on Vercel. Database hosted on Supabase (PostgreSQL).

## Key Directories (Planned)

| Directory | Purpose |
|-----------|---------|
| `src/app/` | Next.js App Router pages and layouts |
| `src/app/api/` | Route Handler API endpoints |
| `src/app/admin/` | Admin dashboard pages |
| `src/components/` | Shared React components |
| `src/lib/` | Utilities, auth config, database client |
| `src/server/` | Server-side business logic, actions |
| `prisma/` | Prisma schema and migrations |
| `prisma/seed.ts` | Database seed script |
| `public/` | Static assets |
| `docs/` | Project documentation |
