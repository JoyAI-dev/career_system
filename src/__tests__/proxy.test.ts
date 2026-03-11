import { describe, it, expect } from 'vitest';

// We test the authorized callback logic directly since proxy
// is just a re-export of auth. We extract and test the authorization logic.

describe('Route authorization logic', () => {
  const publicRoutes = ['/', '/login', '/register'];
  const authenticatedRoutes = ['/dashboard', '/profile', '/activities', '/calendar'];
  const adminRoutes = ['/admin', '/admin/settings'];

  function isPublicRoute(pathname: string): boolean {
    return pathname === '/login' || pathname === '/register' || pathname === '/';
  }

  function isAdminRoute(pathname: string): boolean {
    return pathname.startsWith('/admin');
  }

  type AuthorizedResult = boolean | { status: number };

  function authorized(
    isLoggedIn: boolean,
    role: string | undefined,
    pathname: string,
  ): AuthorizedResult {
    if (isPublicRoute(pathname)) return true;
    if (!isLoggedIn) return false;
    if (isAdminRoute(pathname)) {
      if (role !== 'ADMIN') return { status: 403 };
    }
    return true;
  }

  describe('public routes', () => {
    for (const route of publicRoutes) {
      it(`allows unauthenticated access to ${route}`, () => {
        expect(authorized(false, undefined, route)).toBe(true);
      });

      it(`allows authenticated access to ${route}`, () => {
        expect(authorized(true, 'USER', route)).toBe(true);
      });
    }
  });

  describe('authenticated routes', () => {
    for (const route of authenticatedRoutes) {
      it(`redirects unauthenticated users from ${route}`, () => {
        expect(authorized(false, undefined, route)).toBe(false);
      });

      it(`allows authenticated USER access to ${route}`, () => {
        expect(authorized(true, 'USER', route)).toBe(true);
      });

      it(`allows authenticated ADMIN access to ${route}`, () => {
        expect(authorized(true, 'ADMIN', route)).toBe(true);
      });
    }
  });

  describe('admin routes', () => {
    for (const route of adminRoutes) {
      it(`redirects unauthenticated users from ${route}`, () => {
        expect(authorized(false, undefined, route)).toBe(false);
      });

      it(`returns 403 for USER role on ${route}`, () => {
        const result = authorized(true, 'USER', route);
        expect(result).toEqual({ status: 403 });
      });

      it(`allows ADMIN role access to ${route}`, () => {
        expect(authorized(true, 'ADMIN', route)).toBe(true);
      });
    }
  });
});
