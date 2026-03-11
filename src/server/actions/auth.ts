'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { signIn } from '@/lib/auth';
import { redirect } from 'next/navigation';

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must be at most 50 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterState = {
  errors?: {
    username?: string[];
    password?: string[];
    confirmPassword?: string[];
    _form?: string[];
  };
  success?: boolean;
};

export async function register(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { username, password } = parsed.data;

  // Check username uniqueness
  const existing = await prisma.user.findUnique({
    where: { username },
  });

  if (existing) {
    return {
      errors: {
        username: ['This username is already taken'],
      },
    };
  }

  // Hash password and create user
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: 'USER',
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return {
        errors: {
          username: ['This username is already taken'],
        },
      };
    }
    throw error;
  }

  // Auto-login after registration
  await signIn('credentials', {
    username,
    password,
    redirect: false,
  });

  redirect('/');
}

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginState = {
  errors?: {
    username?: string[];
    password?: string[];
    _form?: string[];
  };
};

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await signIn('credentials', {
      username: parsed.data.username,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    return {
      errors: {
        _form: ['Invalid username or password'],
      },
    };
  }

  redirect('/');
}
