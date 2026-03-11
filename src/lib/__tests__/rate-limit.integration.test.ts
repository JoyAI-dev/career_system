import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { checkRateLimit, recordFailedAttempt, resetAttempts } from '@/lib/rate-limit';

/**
 * Integration tests for rate limiting against a real database.
 * Requires a migrated database with the login_attempts table.
 */
describe('Rate Limiter (integration)', () => {
  const testUser = 'integration-test-user';

  beforeEach(async () => {
    // Clean up test data
    await prisma.loginAttempt
      .delete({ where: { username: testUser } })
      .catch(() => {});
  });

  it('allows first attempt when no record exists', async () => {
    const result = await checkRateLimit(testUser);
    expect(result.allowed).toBe(true);
  });

  it('records failed attempts and blocks after threshold', async () => {
    // Record 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt(testUser);
    }

    // Should be blocked
    const result = await checkRateLimit(testUser);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);

    // Verify the record in DB
    const record = await prisma.loginAttempt.findUnique({
      where: { username: testUser },
    });
    expect(record).not.toBeNull();
    expect(record!.count).toBe(5);
  });

  it('allows attempts below threshold', async () => {
    for (let i = 0; i < 4; i++) {
      await recordFailedAttempt(testUser);
    }

    const result = await checkRateLimit(testUser);
    expect(result.allowed).toBe(true);
  });

  it('resets attempts correctly', async () => {
    // Record enough to block
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt(testUser);
    }
    expect((await checkRateLimit(testUser)).allowed).toBe(false);

    // Reset
    await resetAttempts(testUser);

    // Should be allowed again
    const result = await checkRateLimit(testUser);
    expect(result.allowed).toBe(true);

    // Record should be gone
    const record = await prisma.loginAttempt.findUnique({
      where: { username: testUser },
    });
    expect(record).toBeNull();
  });

  it('allows login when window has expired', async () => {
    // Manually insert an expired record (20 minutes ago)
    const expiredTime = new Date(Date.now() - 20 * 60 * 1000);
    await prisma.loginAttempt.upsert({
      where: { username: testUser },
      create: { username: testUser, count: 5, firstAttempt: expiredTime },
      update: { count: 5, firstAttempt: expiredTime },
    });

    // Should be allowed — window expired
    const result = await checkRateLimit(testUser);
    expect(result.allowed).toBe(true);

    // Expired record should be cleaned up
    const record = await prisma.loginAttempt.findUnique({
      where: { username: testUser },
    });
    expect(record).toBeNull();
  });
});
