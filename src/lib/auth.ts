import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { checkRateLimit, recordFailedAttempt, resetAttempts } from '@/lib/rate-limit';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const username = credentials?.username;
        const password = credentials?.password;

        if (typeof username !== 'string' || typeof password !== 'string') {
          return null;
        }

        if (!username.trim() || !password.trim()) {
          return null;
        }

        // Rate limiting check
        const rateCheck = await checkRateLimit(username);
        if (!rateCheck.allowed) {
          throw new Error('Too many login attempts. Please try again later.');
        }

        const user = await prisma.user.findUnique({
          where: { username },
        });

        if (!user) {
          await recordFailedAttempt(username);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          await recordFailedAttempt(username);
          return null;
        }

        // Reset rate limit on successful login
        await resetAttempts(username);

        return {
          id: user.id,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user;
      const isPublicRoute =
        nextUrl.pathname === '/login' ||
        nextUrl.pathname === '/register' ||
        nextUrl.pathname === '/';
      const isAdminRoute = nextUrl.pathname.startsWith('/admin');

      // Allow public routes
      if (isPublicRoute) {
        return true;
      }

      // Redirect unauthenticated users to login
      if (!isLoggedIn) {
        return false;
      }

      // Check admin routes
      if (isAdminRoute) {
        const token = session.user as { role?: string };
        if (token.role !== 'ADMIN') {
          return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id!;
        token.username = user.username;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.username = token.username;
      session.user.role = token.role;
      return session;
    },
  },
});

/**
 * Helper to require authentication in Server Actions.
 * Throws if not authenticated. Returns the session.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError();
  }
  return session;
}

/**
 * Helper to require ADMIN role in Server Actions.
 * Throws if not authenticated or not ADMIN.
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== 'ADMIN') {
    throw new ForbiddenError();
  }
  return session;
}
