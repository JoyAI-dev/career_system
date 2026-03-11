import { prisma } from '@/lib/db';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function checkRateLimit(
  username: string,
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const key = username.toLowerCase();

  try {
    const record = await prisma.loginAttempt.findUnique({
      where: { username: key },
    });

    if (!record) {
      return { allowed: true };
    }

    const elapsed = Date.now() - record.firstAttempt.getTime();

    // Window expired — clean up and allow
    if (elapsed > WINDOW_MS) {
      await prisma.loginAttempt.delete({ where: { username: key } }).catch(() => {});
      return { allowed: true };
    }

    if (record.count >= MAX_ATTEMPTS) {
      const retryAfterMs = WINDOW_MS - elapsed;
      return { allowed: false, retryAfterMs };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check failed, allowing login:', error);
    return { allowed: true };
  }
}

export async function recordFailedAttempt(username: string): Promise<void> {
  const key = username.toLowerCase();

  try {
    await prisma.loginAttempt.upsert({
      where: { username: key },
      create: { username: key, count: 1, firstAttempt: new Date() },
      update: {
        count: { increment: 1 },
      },
    });

    // If the window has expired, reset with a fresh record
    const record = await prisma.loginAttempt.findUnique({
      where: { username: key },
    });
    if (record) {
      const elapsed = Date.now() - record.firstAttempt.getTime();
      if (elapsed > WINDOW_MS) {
        await prisma.loginAttempt.update({
          where: { username: key },
          data: { count: 1, firstAttempt: new Date() },
        });
      }
    }
  } catch (error) {
    console.error('Failed to record login attempt:', error);
  }
}

export async function resetAttempts(username: string): Promise<void> {
  const key = username.toLowerCase();

  try {
    await prisma.loginAttempt.delete({ where: { username: key } }).catch(() => {});
  } catch (error) {
    console.error('Failed to reset login attempts:', error);
  }
}
