import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock auth signIn
vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { register, login } from '@/server/actions/auth';
import { prisma } from '@/lib/db';
import { signIn } from '@/lib/auth';

function createFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

describe('register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns validation errors for short username', async () => {
    const fd = createFormData({
      username: 'ab',
      password: 'password123',
      confirmPassword: 'password123',
    });

    const result = await register({}, fd);
    expect(result.errors?.username).toBeDefined();
    expect(result.errors!.username![0]).toContain('at least 3 characters');
  });

  it('returns validation errors for short password', async () => {
    const fd = createFormData({
      username: 'validuser',
      password: 'short',
      confirmPassword: 'short',
    });

    const result = await register({}, fd);
    expect(result.errors?.password).toBeDefined();
    expect(result.errors!.password![0]).toContain('at least 8 characters');
  });

  it('returns error when passwords do not match', async () => {
    const fd = createFormData({
      username: 'validuser',
      password: 'password123',
      confirmPassword: 'password456',
    });

    const result = await register({}, fd);
    expect(result.errors?.confirmPassword).toBeDefined();
    expect(result.errors!.confirmPassword![0]).toContain('do not match');
  });

  it('returns error for invalid username characters', async () => {
    const fd = createFormData({
      username: 'user@name',
      password: 'password123',
      confirmPassword: 'password123',
    });

    const result = await register({}, fd);
    expect(result.errors?.username).toBeDefined();
  });

  it('returns error for duplicate username', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'existing-id',
      username: 'existinguser',
      passwordHash: 'hash',
      role: 'USER',
      name: null,
      school: null,
      major: null,
      grade: null,
      studentIdUrl: null,
      lastActiveAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const fd = createFormData({
      username: 'existinguser',
      password: 'password123',
      confirmPassword: 'password123',
    });

    const result = await register({}, fd);
    expect(result.errors?.username).toBeDefined();
    expect(result.errors!.username![0]).toContain('already taken');
  });

  it('creates user and redirects on success', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValueOnce({
      id: 'new-id',
      username: 'newuser',
      passwordHash: 'hashed',
      role: 'USER',
      name: null,
      school: null,
      major: null,
      grade: null,
      studentIdUrl: null,
      lastActiveAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(signIn).mockResolvedValueOnce(undefined);

    const fd = createFormData({
      username: 'newuser',
      password: 'password123',
      confirmPassword: 'password123',
    });

    await expect(register({}, fd)).rejects.toThrow('NEXT_REDIRECT');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: 'newuser',
          role: 'USER',
        }),
      }),
    );
    expect(signIn).toHaveBeenCalledWith('credentials', {
      username: 'newuser',
      password: 'password123',
      redirect: false,
    });
  });
});

describe('login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns validation errors for empty username', async () => {
    const fd = createFormData({
      username: '',
      password: 'password123',
    });

    const result = await login({}, fd);
    expect(result.errors?.username).toBeDefined();
  });

  it('returns validation errors for empty password', async () => {
    const fd = createFormData({
      username: 'testuser',
      password: '',
    });

    const result = await login({}, fd);
    expect(result.errors?.password).toBeDefined();
  });

  it('returns form error on failed signIn', async () => {
    vi.mocked(signIn).mockRejectedValueOnce(new Error('CredentialsSignin'));

    const fd = createFormData({
      username: 'testuser',
      password: 'wrongpassword',
    });

    const result = await login({}, fd);
    expect(result.errors?._form).toBeDefined();
    expect(result.errors!._form![0]).toContain('Invalid username or password');
  });

  it('redirects on successful login', async () => {
    vi.mocked(signIn).mockResolvedValueOnce(undefined);

    const fd = createFormData({
      username: 'testuser',
      password: 'correctpassword',
    });

    await expect(login({}, fd)).rejects.toThrow('NEXT_REDIRECT');
    expect(signIn).toHaveBeenCalledWith('credentials', {
      username: 'testuser',
      password: 'correctpassword',
      redirect: false,
    });
  });
});
