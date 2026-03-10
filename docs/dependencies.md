# Dependencies

## Core Runtime Dependencies

| Package | Purpose | License |
|---------|---------|---------|
| next | App framework (SSR, routing, API) | MIT |
| react / react-dom | UI rendering | MIT |
| typescript | Type safety | Apache-2.0 |
| tailwindcss | Utility CSS | MIT |
| @prisma/client | Database ORM client | Apache-2.0 |
| next-auth | Authentication/sessions | ISC |
| recharts | Radar chart visualization | MIT |
| @fullcalendar/core | Calendar views | MIT |
| @fullcalendar/daygrid | Month view plugin | MIT |
| @fullcalendar/timegrid | Week view plugin | MIT |
| react-markdown | Markdown rendering | MIT |
| zod | Schema validation | MIT |
| bcryptjs | Password hashing | MIT |
| @supabase/supabase-js | Supabase client (storage) | MIT |

## Dev Dependencies

| Package | Purpose |
|---------|---------|
| prisma | ORM CLI, migrations |
| eslint | Linting |
| prettier | Formatting |
| vitest | Unit/integration testing |
| @testing-library/react | Component testing |
| playwright | E2E testing |

## Critical Runtime Services

| Service | Purpose | Required |
|---------|---------|----------|
| PostgreSQL (Supabase) | Primary datastore | Yes |
| Supabase Storage | File uploads (student ID) | Optional (only if student ID feature enabled) |
| Vercel | Hosting/deployment | Yes (production) |
