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

## Dev Dependencies

| Package | Purpose |
|---------|---------|
| prisma | ORM CLI, migrations |
| eslint | Linting |
| prettier | Formatting |
| vitest | Unit/integration testing |

## Critical Runtime Services

| Service | Purpose | Required |
|---------|---------|----------|
| PostgreSQL 16 (Docker) | Primary datastore | Yes |
| Local filesystem | File uploads (student ID) | Yes |
| ZhiPu GLM-OCR API | Student ID OCR recognition | Optional |
