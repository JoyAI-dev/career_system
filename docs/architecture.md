# Architecture

## System Shape

Full-stack monolith. Single Next.js application serving both frontend (SSR + client) and backend (Route Handlers + Server Actions). Deployed on self-hosted server via pm2.

## Core Modules

### 1. User System
- Registration, authentication (Auth.js credentials + JWT)
- Profile management (school, major, grade)
- Role-based access: USER, ADMIN
- Optional student ID verification (private file upload)

### 2. Cognitive Boundary Exploration System
- 3-tier versioned questionnaire: Topic → Dimension → Question
- Configurable answer options with score validation (sum=100)
- Immutable response snapshots keyed by version/time/context
- Scoring engine: Topic Score = avg(question scores)
- Radar chart visualization (initial vs current cognition)

### 3. Community Activity System
- Configurable activity types with progressive unlock sequence
- Activity state machine: OPEN → FULL → SCHEDULED → IN_PROGRESS → COMPLETED
- Transactional capacity checks (atomic join with unique constraints)
- Roundtable meeting workflow with leader/member roles
- Tag system for activity categorization

### 4. Activity Calendar System
- FullCalendar integration (week + month views, Chinese locale)
- Shows only user's enrolled activities + recruitment info

### 5. Notification System (MVP)
- In-app notification table with unread counter
- Triggers: activity full, time confirmed, new comment
- Top notification bar + badge indicator

### 6. Admin Dashboard
- Questionnaire management (CRUD with versioning)
- Activity type and tag management
- Activity creation and monitoring
- User management and recruitment publishing

## Data Flow

```
User Registration → Mandatory Questionnaire → Initial Snapshot
        ↓
Join Activity → Activity Lifecycle (state machine)
        ↓
Activity Completed → Update Questionnaire → New Snapshot
        ↓
Radar Chart: Compare Snapshots → Cognitive Growth Visible
```

## Cross-Cutting Concerns

| Concern | Approach |
|---------|----------|
| AuthN | Auth.js with JWT sessions, credentials provider |
| AuthZ | Role-action matrix enforced at middleware + API boundary |
| Validation | Zod schemas at API boundary; Prisma constraints at DB |
| Error Handling | Standardized error envelope; user-facing vs technical separation |
| State Management | Server Components + Server Actions; minimal client state |
| File Storage | Local filesystem (/var/lib/career_system) with auth-gated API routes |

## Deployment Topology

```
[Browser] → [career.joysort.cn (Caddy)] → [Next.js on 8.131.74.70:3000 (pm2)]
                                                      ↓
                                             [PostgreSQL 16 (Docker)]
                                             [Local filesystem (/var/lib/career_system)]
```
