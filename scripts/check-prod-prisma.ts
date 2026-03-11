import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const raw =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

let ssl: { rejectUnauthorized: boolean } | undefined;
if (raw) {
  try {
    const u = new URL(raw);
    if (u.hostname.includes('.supabase.com')) {
      ssl = { rejectUnauthorized: false };
    }
  } catch {
    // ignore
  }
}

const pool = new Pool({ connectionString: raw, max: 1, ssl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function run() {
  try {
    const rows = await prisma.$queryRaw`SELECT 1 AS ok`;
    console.log('query ok:', rows);
  } catch (error) {
    console.error('query failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
