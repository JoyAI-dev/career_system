# Setup

## Prerequisites

- Node.js 20 LTS
- npm or pnpm
- PostgreSQL (or Supabase account)
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

Create `.env.local` at project root:

```env
# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE

# Supabase (Storage)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Auth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
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
# Lint
npm run lint

# Tests (once configured)
npm test
```
