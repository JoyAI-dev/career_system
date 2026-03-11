import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    loginAttempt: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { checkRateLimit, recordFailedAttempt, resetAttempts } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows first attempt when no record exists', async () => {
    vi.mocked(prisma.loginAttempt.findUnique).mockResolvedValueOnce(null);

    const result = await checkRateLimit('testuser');
    expect(result.allowed).toBe(true);
    expect(prisma.loginAttempt.findUnique).toHaveBeenCalledWith({
      where: { username: 'testuser' },
    });
  });

  it('blocks after 5 failed attempts within window', async () => {
    const firstAttempt = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
    vi.mocked(prisma.loginAttempt.findUnique).mockResolvedValueOnce({
      username: 'testuser',
      count: 5,
      firstAttempt,
    });

    const result = await checkRateLimit('testuser');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('allows when count is below threshold', async () => {
    const firstAttempt = new Date(Date.now() - 5 * 60 * 1000);
    vi.mocked(prisma.loginAttempt.findUnique).mockResolvedValueOnce({
      username: 'testuser',
      count: 4,
      firstAttempt,
    });

    const result = await checkRateLimit('testuser');
    expect(result.allowed).toBe(true);
  });

  it('allows and cleans up when window has expired', async () => {
    const firstAttempt = new Date(Date.now() - 20 * 60 * 1000); // 20 min ago
    vi.mocked(prisma.loginAttempt.findUnique).mockResolvedValueOnce({
      username: 'testuser',
      count: 5,
      firstAttempt,
    });
    vi.mocked(prisma.loginAttempt.delete).mockResolvedValueOnce({
      username: 'testuser',
      count: 5,
      firstAttempt,
    });

    const result = await checkRateLimit('testuser');
    expect(result.allowed).toBe(true);
    expect(prisma.loginAttempt.delete).toHaveBeenCalledWith({
      where: { username: 'testuser' },
    });
  });

  it('is case-insensitive', async () => {
    vi.mocked(prisma.loginAttempt.findUnique).mockResolvedValueOnce(null);

    await checkRateLimit('TestUser');
    expect(prisma.loginAttempt.findUnique).toHaveBeenCalledWith({
      where: { username: 'testuser' },
    });
  });

  it('records failed attempt via upsert', async () => {
    vi.mocked(prisma.loginAttempt.upsert).mockResolvedValueOnce({
      username: 'testuser',
      count: 1,
      firstAttempt: new Date(),
    });
    vi.mocked(prisma.loginAttempt.findUnique).mockResolvedValueOnce({
      username: 'testuser',
      count: 1,
      firstAttempt: new Date(),
    });

    await recordFailedAttempt('testuser');
    expect(prisma.loginAttempt.upsert).toHaveBeenCalledWith({
      where: { username: 'testuser' },
      create: { username: 'testuser', count: 1, firstAttempt: expect.any(Date) },
      update: { count: { increment: 1 } },
    });
  });

  it('resets attempts by deleting record', async () => {
    vi.mocked(prisma.loginAttempt.delete).mockResolvedValueOnce({
      username: 'testuser',
      count: 3,
      firstAttempt: new Date(),
    });

    await resetAttempts('testuser');
    expect(prisma.loginAttempt.delete).toHaveBeenCalled();
  });

  it('gracefully degrades on DB error in checkRateLimit', async () => {
    vi.mocked(prisma.loginAttempt.findUnique).mockRejectedValueOnce(
      new Error('DB unavailable'),
    );

    const result = await checkRateLimit('testuser');
    expect(result.allowed).toBe(true);
  });
});
