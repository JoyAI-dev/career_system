# Development Standards

## Table of Contents

- [1. Architecture Overview](#1-architecture-overview)
- [2. Project Principles](#2-project-principles)
- [3. Layer Responsibilities](#3-layer-responsibilities)
- [4. Data Contracts](#4-data-contracts)
- [5. Error Handling](#5-error-handling)
- [6. Logging Standards](#6-logging-standards)
- [7. Configuration Management](#7-configuration-management)
- [8. Testing Standards](#8-testing-standards)
- [9. Security & Compliance](#9-security--compliance)
- [10. Directory Layout](#10-directory-layout)
- [11. Design Principles](#11-design-principles)
- [12. Failure Handling & Resilience](#12-failure-handling--resilience)

---

## 1. Architecture Overview

- **Pattern:** Layered monolith (Presentation → Server Actions/API → Business Logic → Data Access)
- **Stack:** Next.js 14+ (App Router), React 18, TypeScript, TailwindCSS, Shadcn UI
- **Database:** PostgreSQL 16 via Prisma ORM (pg driver adapter)
- **Auth:** Auth.js (NextAuth) with JWT sessions
- **Deploy:** Self-hosted (pm2 + Caddy)

```
┌─────────────────────────────────┐
│  Presentation (React/Next.js)   │
├─────────────────────────────────┤
│  API Layer (Route Handlers +    │
│  Server Actions)                │
├─────────────────────────────────┤
│  Business Logic (src/server/)   │
├─────────────────────────────────┤
│  Data Access (Prisma)           │
├─────────────────────────────────┤
│  PostgreSQL 16 (Docker)         │
└─────────────────────────────────┘
```

## 2. Project Principles

- **KISS:** Simplest solution that works; avoid premature abstraction
- **Server-first:** Default to Server Components and Server Actions; use client components only for interactivity
- **Type safety:** TypeScript strict mode; Zod validation at boundaries; Prisma-generated types for DB
- **Single responsibility:** Each file/module does one thing well
- **Immutability where it matters:** Questionnaire versions and response snapshots are immutable once created
- **Atomic state transitions:** Activity workflow state changes must be transactional

## 3. Layer Responsibilities

### Presentation Layer (`src/app/`, `src/components/`)
- React Server Components and Client Components
- Layout composition and routing
- Form handling and user interaction
- **Allowed:** Import from `src/components/`, `src/lib/`, `src/types/`
- **Prohibited:** Direct Prisma calls; business logic; raw SQL

### API Layer (`src/app/api/`, `src/server/actions/`)
- Server Actions for mutations (form submissions, state changes)
- Route Handlers for complex endpoints (webhooks, file uploads)
- Input validation with Zod
- Auth/role checking
- **Allowed:** Call business logic functions; validate input; check auth
- **Prohibited:** Direct Prisma calls in Route Handlers (use business logic layer); UI rendering

### Business Logic Layer (`src/server/`)
- Domain logic: scoring engine, state machine, unlock rules
- Data orchestration and transactions
- **Allowed:** Prisma client usage; cross-domain coordination
- **Prohibited:** Request/response handling; UI concerns; direct session access

### Data Access Layer (`prisma/`)
- Schema definitions and migrations
- Seed scripts
- **Allowed:** Schema modeling; migration files
- **Prohibited:** Business logic in seed scripts

## 4. Data Contracts

### API Response Format
```
Success: { data: T }
Error:   { error: { code: string, message: string, details?: unknown } }
```

### Validation
- All API inputs validated with Zod schemas
- Schemas co-located with their Server Actions/Route Handlers
- Shared schemas in `src/types/`
- Prisma constraints as last line of defense (unique, not null, check)

### Naming
- Zod schemas: `camelCase` suffixed with `Schema` (e.g., `createActivitySchema`)
- DTOs inferred from Zod: `z.infer<typeof createActivitySchema>`

## 5. Error Handling

### Error Categories
- **Validation errors:** Return 400 with field-level details from Zod
- **Auth errors:** Return 401 (unauthenticated) or 403 (unauthorized)
- **Not found:** Return 404 with resource type
- **Conflict:** Return 409 (e.g., activity already full, duplicate membership)
- **Server errors:** Return 500; log full error server-side; return generic message to client

### Rules
- Throw errors in business logic; catch and format at API boundary
- Never expose stack traces or internal details to client
- Use custom error classes for domain errors (e.g., `ActivityFullError`, `UnlockRequirementNotMetError`)
- Log all 500 errors with full context

## 6. Logging Standards

### Log Levels
- **ERROR:** Unhandled exceptions, failed transactions, external service failures
- **WARN:** Capacity near-misses, deprecation usage, auth failures
- **INFO:** State transitions (activity status changes), user registration, questionnaire submissions
- **DEBUG:** Query details, request payloads (dev only)

### Rules
- Never log passwords, tokens, session IDs, or PII (student IDs, full names)
- Use structured JSON format in production
- Include: timestamp, level, message, userId (hashed), action, resource
- Console logging for MVP; plan structured logging service for scale

## 7. Configuration Management

### Hierarchy (highest priority first)
1. Environment variables (`.env.local`)
2. `next.config.js` for build-time config
3. Default values in code

### Naming
- Environment variables: `UPPER_SNAKE_CASE`
- Public (client-safe): prefix with `NEXT_PUBLIC_`
- Private: no prefix (server-only by default in Next.js)

### Required Variables
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — Auth.js v5 session secret
- `AUTH_URL` — App URL

### Rules
- Never commit `.env.local`
- Provide `.env.example` with placeholder values
- Validate required env vars at startup; fail fast if missing

## 8. Testing Standards

### Test Pyramid
- **Unit (60%):** Scoring engine, state machine, validation logic, utilities
- **Integration (30%):** Auth flows, Server Actions, database queries
- **E2E (10%):** Critical user journeys

### Naming
- Test files: `*.test.ts` / `*.test.tsx` (co-located with source)
- Describe blocks: module/component name
- Test names: `it('does X when Y')` — behavior-focused

### Structure
- Arrange-Act-Assert (AAA) pattern
- One assertion per test where practical
- Use factories for test data; never depend on seed data for unit tests

### Coverage
- Scoring engine: 90%+
- State machine: 90%+
- Auth: 80%+
- Overall: 70%+ minimum

### CI Gate
- All tests must pass before merge
- Lint must pass before merge

## 9. Security & Compliance

### Authentication
- Auth.js with credentials provider + JWT sessions
- Passwords: bcrypt hashed (min 10 rounds)
- Rate limiting on login endpoint

### Authorization
- Role-action matrix enforced in `src/middleware.ts`
- Admin routes (`/admin/*`) require ADMIN role
- API endpoints verify session + role before processing
- Never trust client-provided role/userId

### Data Protection
- Student ID files: local filesystem, auth-gated API routes
- MIME type and file size validation on upload
- File retention policy: define and enforce deletion schedule
- No PII in logs

### Secure Coding
- Zod validation on all user inputs
- Parameterized queries only (Prisma handles this)
- No `dangerouslySetInnerHTML` without sanitization
- Content Security Policy headers via `next.config.js`
- CSRF protection via Server Actions (built-in)

### Dependency Management
- Review `npm audit` weekly
- Pin major versions; allow minor/patch updates
- No dependencies with known critical vulnerabilities

## 10. Directory Layout

```
career_system/
├── docs/                    # Project documentation
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── migrations/          # Migration files
│   └── seed.ts              # Seed script
├── public/                  # Static assets
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, register pages
│   │   ├── (main)/          # Authenticated app pages
│   │   ├── admin/           # Admin dashboard
│   │   ├── api/             # Route Handlers
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Landing page
│   ├── components/
│   │   ├── ui/              # Shadcn UI base components
│   │   └── [feature]/       # Feature-specific components
│   ├── lib/
│   │   ├── auth.ts          # Auth.js config
│   │   ├── db.ts            # Prisma client singleton
│   │   └── utils.ts         # Shared utilities
│   ├── server/
│   │   ├── actions/         # Server Actions (by domain)
│   │   └── queries/         # Server-side queries
│   ├── types/               # Shared types and Zod schemas
│   └── middleware.ts        # Auth + role middleware
├── e2e/                     # Playwright E2E tests
├── .env.example             # Environment template
├── next.config.js           # Next.js config
├── tailwind.config.ts       # Tailwind config
├── tsconfig.json            # TypeScript config
└── package.json             # Dependencies and scripts
```

### File Naming
- Pages/layouts: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` (Next.js conventions)
- Components: `PascalCase.tsx` (e.g., `ActivityCard.tsx`)
- Utilities/lib: `camelCase.ts` (e.g., `scoringEngine.ts`)
- Server Actions: `camelCase.ts` grouped by domain (e.g., `questionnaire.ts`)
- Types: `camelCase.ts` (e.g., `activity.ts`)
- Tests: `[source].test.ts(x)` co-located with source

## 11. Design Principles

### Coding Style
- ESLint + Prettier enforced
- 2-space indentation
- Single quotes for strings
- Trailing commas
- Semicolons required
- Max line length: 100 characters (soft limit)

### Naming Conventions
- **Components:** PascalCase (`ActivityCard`)
- **Functions/variables:** camelCase (`calculateTopicScore`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_ACTIVITY_CAPACITY`)
- **Types/interfaces:** PascalCase (`ActivityStatus`)
- **Enums:** PascalCase name, UPPER_SNAKE_CASE values
- **Files:** match primary export casing
- **DB columns:** camelCase (Prisma convention)
- **URL paths:** kebab-case (`/cognitive-boundary`)

### Code Review Checklist
- [ ] Types are correct and complete (no `any`)
- [ ] Inputs validated with Zod at API boundary
- [ ] Auth/role check present on protected routes
- [ ] No PII in logs
- [ ] Tests cover new logic
- [ ] No hardcoded values that should be configurable

### Pre-Submit Validation
```bash
# Must pass before creating PR
npm run lint -- --fix    # Fix lint issues
npx tsc --noEmit         # Type check
npm test                 # Run tests
npm run build            # Verify build succeeds
```

## 12. Failure Handling & Resilience

### Retry Policies
- Database connection: 3 retries with exponential backoff (Prisma built-in)
- No retries on validation or auth failures

### Timeouts
- Database query timeout: 5s (Prisma `connection_limit` and `pool_timeout`)
- File upload: 30s max

### Graceful Degradation
- If radar chart data incomplete: show available data with "incomplete" indicator
- If FullCalendar fails to load: show activity list fallback

### Health Checks
- `/api/health` endpoint: checks DB connection, returns app version
