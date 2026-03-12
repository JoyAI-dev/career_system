'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { signIn } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';

function getRegisterSchema(t: (key: string) => string) {
  return z
    .object({
      username: z
        .string()
        .min(3, t('usernameMin'))
        .max(50, t('usernameMax'))
        .regex(/^[a-zA-Z0-9_]+$/, t('usernameFormat')),
      password: z.string().min(8, t('passwordMin')).max(128),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('passwordMismatch'),
      path: ['confirmPassword'],
    });
}

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
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const registerSchema = getRegisterSchema(tv);

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
        username: [te('usernameTaken')],
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
          username: [te('usernameTaken')],
        },
      };
    }
    throw error;
  }

  // Auto-login after registration — if signIn fails, redirect to login
  // so the user can log in manually (account is already created)
  try {
    await signIn('credentials', {
      username,
      password,
      redirect: false,
    });
  } catch {
    redirect('/login');
  }

  (await cookies()).set('just_registered', '1', { maxAge: 120, path: '/' });
  redirect('/dashboard?registered=true');
}

function getLoginSchema(t: (key: string) => string) {
  return z.object({
    username: z.string().min(1, t('usernameRequired')),
    password: z.string().min(1, t('passwordRequired')),
  });
}

export type LoginState = {
  errors?: {
    username?: string[];
    password?: string[];
    _form?: string[];
  };
};

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const loginSchema = getLoginSchema(tv);

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
        _form: [te('invalidCredentials')],
      },
    };
  }

  redirect('/dashboard');
}
