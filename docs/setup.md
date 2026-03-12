# Setup

## Prerequisites

- Node.js 22 LTS
- npm
- PostgreSQL 16
- Git

## Install Steps

```bash
# Clone repository
git clone git@github.com:JoyAI-dev/career_system.git
cd career_system

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate
```

## Environment Variables

Create `.env.local` at project root (see `.env.example`):

```env
# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE

# Auth.js (v5)
AUTH_URL=http://localhost:3000
AUTH_SECRET=your-random-secret

# ZhiPu OCR (student ID recognition)
ZHIPU_API_KEY=your-zhipu-api-key

# Admin Seed
ADMIN_SEED_PASSWORD=change-me-to-a-strong-password
```

## Database Setup

```bash
# Run migrations
npx prisma migrate dev

# Seed database (creates admin user, grade options, default activity types)
npx prisma db seed
```

## How to Run

```bash
# Development
npm run dev

# Production build
npm run build && npm start
```

## How to Test and Lint

```bash
npm run lint
npm run typecheck
npm test
```
