import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith('/login');
      const isOnHome = nextUrl.pathname === '/';

      // 1. Allow public access to Landing Page
      if (isOnHome) return true;

      // 2. Protected Routes (everything else that is not login)
      if (!isOnLogin) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      }

      // 3. Login Page Logic
      if (isLoggedIn) {
        return Response.redirect(new URL('/', nextUrl));
      }

      return true;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
