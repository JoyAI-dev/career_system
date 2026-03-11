import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    username: string;
    role: 'USER' | 'ADMIN';
  }

  interface Session {
    user: {
      id: string;
      username: string;
      role: 'USER' | 'ADMIN';
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    username: string;
    role: 'USER' | 'ADMIN';
  }
}
