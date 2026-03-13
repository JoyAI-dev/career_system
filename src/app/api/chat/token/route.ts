import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'staging_secret_key_2026_local_dev',
);

/**
 * Generate a short-lived JWT for WebSocket authentication.
 * The WS client calls this endpoint to get a token, then sends it to the WS server.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await new SignJWT({
    userId: session.user.id,
    username: session.user.username,
    role: session.user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m') // Short-lived for WS auth
    .setIssuedAt()
    .sign(secret);

  return NextResponse.json({ token });
}
