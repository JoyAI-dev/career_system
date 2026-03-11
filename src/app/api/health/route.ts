import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const version = process.env.APP_VERSION || '0.1.0';

  let db: 'connected' | 'disconnected' = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = 'connected';
  } catch (error) {
    console.error('[health] database connectivity check failed', error);
  }

  const status = db === 'connected' ? 'ok' : 'degraded';
  const statusCode = db === 'connected' ? 200 : 503;

  return NextResponse.json(
    { status, version, db, timestamp: new Date().toISOString() },
    { status: statusCode },
  );
}
