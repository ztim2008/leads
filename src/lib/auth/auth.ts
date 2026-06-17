import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import YandexProvider from "next-auth/providers/yandex";
import { db } from "@/lib/db";
import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    YandexProvider({
      clientId: process.env.YANDEX_CLIENT_ID || "a04c612860784ffb8a21a83a32084263",
      clientSecret: process.env.YANDEX_CLIENT_SECRET || "72de15f92e6a4d3e9bdbee74c4330c0f",
      authorization: { params: { scope: "" } },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({ where: { email: credentials.email } });
        if (!user?.passwordHash) return null;
        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) return null;
        return { id: user.id, email: user.email, name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email, image: user.avatar };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/auth", error: "/auth" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "yandex" && user.email) {
        try {
          let dbUser = await db.user.findUnique({ where: { email: user.email } });
          if (!dbUser) {
            dbUser = await db.user.create({ data: { email: user.email, firstName: user.name || "", passwordHash: "" } });
          }
          // Переопределяем user.id на UUID из БД
          user.id = dbUser.id;
          // Проверяем workspace
          const ws = await db.workspace.findFirst({ where: { userId: dbUser.id } });
          if (!ws) {
            const newWs = await db.workspace.create({ data: { userId: dbUser.id, name: "Моё пространство", slug: `ws-${dbUser.id.slice(0, 8)}` } });
            await db.settings.create({ data: { workspaceId: newWs.id } });
          }
        } catch (e) {
          console.error("[auth] signIn error:", e);
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const dbUser = await db.user.findUnique({ where: { email: user.email! } });
        if (dbUser) token.role = dbUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).id = token.id;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

export async function auth() {
  return getServerSession(authOptions);
}
