import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

type ResolvedConnection = {
  connectionString: string | undefined;
  source:
    | 'POSTGRES_PRISMA_URL'
    | 'POSTGRES_URL'
    | 'DATABASE_URL'
    | 'POSTGRES_URL_NON_POOLING'
    | 'none';
};

function resolveConnection(): ResolvedConnection {
  if (process.env.POSTGRES_PRISMA_URL) {
    return { connectionString: process.env.POSTGRES_PRISMA_URL, source: 'POSTGRES_PRISMA_URL' };
  }
  if (process.env.POSTGRES_URL) {
    return { connectionString: process.env.POSTGRES_URL, source: 'POSTGRES_URL' };
  }
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, source: 'DATABASE_URL' };
  }
  if (process.env.POSTGRES_URL_NON_POOLING) {
    return { connectionString: process.env.POSTGRES_URL_NON_POOLING, source: 'POSTGRES_URL_NON_POOLING' };
  }
  return { connectionString: undefined, source: 'none' };
}

function createPrismaClient() {
  const configuredMax = Number(process.env.PG_POOL_MAX);
  const max = Number.isFinite(configuredMax) && configuredMax > 0
    ? configuredMax
    : (process.env.NODE_ENV === 'production' ? 1 : 10);
  let { connectionString, source } = resolveConnection();

  let ssl: { rejectUnauthorized: boolean } | undefined;
  let dbHost = 'unknown';
  let dbPort = 'unknown';
  let dbName = 'unknown';
  if (connectionString) {
    try {
      const u = new URL(connectionString);
      dbHost = u.hostname || dbHost;
      dbPort = u.port || '5432';
      dbName = u.pathname.replace(/^\//, '') || dbName;
      if (u.hostname.includes('.supabase.com')) {
        ssl = { rejectUnauthorized: false };
        // Ensure sslmode is in the URL so Prisma's Rust engine also skips cert verification
        if (!u.searchParams.has('sslmode')) {
          u.searchParams.set('sslmode', 'no-verify');
          connectionString = u.toString();
        }
      }
    } catch {
      // ignore parse failures and use default pg SSL behavior
    }
  }

  console.info(
    `[db:init] source=${source} host=${dbHost} port=${dbPort} db=${dbName} poolMax=${max} sslOverride=${ssl ? 'on' : 'off'}`,
  );

  const pool = new Pool({
    connectionString,
    max,
    ssl,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
