import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
    gradeOption: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { updateProfile } from '@/server/actions/user';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { UnauthorizedError } from '@/lib/errors';

function createFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const mockSession = {
  user: { id: 'user-123', username: 'testuser', role: 'USER' as const },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

describe('updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(mockSession);
  });

  it('updates profile successfully with valid data', async () => {
    vi.mocked(prisma.gradeOption.findFirst).mockResolvedValueOnce({
      id: 'go-1',
      label: '大一',
      order: 0,
      isActive: true,
    });
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: 'user-123',
      username: 'testuser',
      passwordHash: 'hash',
      role: 'USER',
      name: 'Test User',
      school: 'Test University',
      major: 'CS',
      grade: '大一',
      studentIdUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const fd = createFormData({
      name: 'Test User',
      school: 'Test University',
      major: 'CS',
      grade: '大一',
    });

    const result = await updateProfile({}, fd);
    expect(result.success).toBe(true);
    expect(prisma.gradeOption.findFirst).toHaveBeenCalledWith({
      where: { label: '大一', isActive: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: {
        name: 'Test User',
        school: 'Test University',
        major: 'CS',
        grade: '大一',
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/profile');
  });

  it('stores null for empty string fields', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: 'user-123',
      username: 'testuser',
      passwordHash: 'hash',
      role: 'USER',
      name: null,
      school: null,
      major: null,
      grade: null,
      studentIdUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const fd = createFormData({
      name: '',
      school: '',
      major: '',
      grade: '',
    });

    const result = await updateProfile({}, fd);
    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: {
        name: null,
        school: null,
        major: null,
        grade: null,
      },
    });
  });

  it('returns validation error for name exceeding 100 characters', async () => {
    const fd = createFormData({
      name: 'a'.repeat(101),
      school: '',
      major: '',
      grade: '',
    });

    const result = await updateProfile({}, fd);
    expect(result.errors?.name).toBeDefined();
    expect(result.errors!.name![0]).toContain('at most 100 characters');
  });

  it('returns validation error for school exceeding 100 characters', async () => {
    const fd = createFormData({
      name: '',
      school: 'b'.repeat(101),
      major: '',
      grade: '',
    });

    const result = await updateProfile({}, fd);
    expect(result.errors?.school).toBeDefined();
  });

  it('returns validation error for invalid grade option', async () => {
    vi.mocked(prisma.gradeOption.findFirst).mockResolvedValueOnce(null);

    const fd = createFormData({
      name: 'Test',
      school: '',
      major: '',
      grade: 'InvalidGrade',
    });

    const result = await updateProfile({}, fd);
    expect(result.errors?.grade).toBeDefined();
    expect(result.errors!.grade![0]).toBe('Invalid grade option');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows empty grade without validation', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: 'user-123',
      username: 'testuser',
      passwordHash: 'hash',
      role: 'USER',
      name: 'Test',
      school: null,
      major: null,
      grade: null,
      studentIdUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const fd = createFormData({
      name: 'Test',
      school: '',
      major: '',
      grade: '',
    });

    const result = await updateProfile({}, fd);
    expect(result.success).toBe(true);
    expect(prisma.gradeOption.findFirst).not.toHaveBeenCalled();
  });

  it('throws when user is not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new UnauthorizedError());

    const fd = createFormData({
      name: 'Test',
      school: '',
      major: '',
      grade: '',
    });

    await expect(updateProfile({}, fd)).rejects.toThrow('Unauthorized');
  });
});
