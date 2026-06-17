// NextAuth 5 конфигурация
// Email/Password авторизация для SaaS

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { compare } from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: String(credentials.email) },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await compare(
          String(credentials.password),
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
          image: user.avatar,
        };
      },
    }),
  ],
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth",
    error: "/auth",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const uid: string = typeof token.id === "string" ? token.id : "";
        (session.user as { id: string }).id = uid;
      }
      return session;
    },
  },
});
