// NextAuth v4 — Email/Password + Яндекс ID
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "yandex",
      name: "Yandex",
      type: "oauth",
      clientId: "a04c612860784ffb8a21a83a32084263",
      clientSecret: "72de15f92e6a4d3e9bdbee74c4330c0f",
      authorization: {
        url: "https://oauth.yandex.ru/authorize",
        params: { scope: "login:email login:info login:avatar" },
      },
      token: "https://oauth.yandex.ru/token",
      userinfo: "https://login.yandex.ru/info?format=json",
      profile(profile: any) {
        return {
          id: profile.id,
          email: profile.default_email,
          name: profile.real_name || profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(" "),
          image: profile.default_avatar_id
            ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
            : null,
        };
      },
    },
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
        const exists = await db.user.findUnique({ where: { email: user.email } });
        if (!exists) {
          const newUser = await db.user.create({
            data: { email: user.email, firstName: user.name || "", passwordHash: "" },
          });
          const ws = await db.workspace.create({
            data: { userId: newUser.id, name: "Моё пространство", slug: `ws-${newUser.id.slice(0, 8)}` },
          });
          await db.settings.create({ data: { workspaceId: ws.id } });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

// Удобная обёртка для серверных компонентов
import { getServerSession } from "next-auth";
export async function auth() {
  return getServerSession(authOptions);
}
