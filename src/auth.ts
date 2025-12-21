import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authConfig } from "./auth.config";

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      // Upsert user on every login to ensure they exist with tokens
      if (user.email) {
        try {
          // Dynamic import to prevent database connection issues from breaking auth
          const { prisma } = await import("@/lib/prisma");
          await prisma.user.upsert({
            where: { email: user.email },
            update: {
              name: user.name,
              image: user.image,
            },
            create: {
              email: user.email,
              name: user.name,
              image: user.image,
              tokens: 100, // Initial free tokens
              role: "user",
            },
          });
        } catch (error) {
          console.error("[Auth] Database error during sign in:", error);
          // Still allow sign in even if database fails
          // User will be created on next successful db connection
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string;
      }
      return session;
    },
  },
});
