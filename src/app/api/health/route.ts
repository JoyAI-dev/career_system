import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const checks: Record<string, string> = {};

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'unavailable';
  }

  // Check login_attempts table exists
  try {
    await prisma.loginAttempt.count();
    checks.rateLimiter = 'ok';
  } catch {
    checks.rateLimiter = 'missing_table';
  }

  const healthy = Object.values(checks).every((v) => v === 'ok');

  return NextResponse.json(
    { status: healthy ? 'healthy' : 'degraded', checks },
    { status: healthy ? 200 : 503 },
  );
}
