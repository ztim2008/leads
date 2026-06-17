import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Yandex from "next-auth/providers/yandex";
import { db } from "@/lib/db";
import { compare } from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Yandex({ clientId: "a04c612860784ffb8a21a83a32084263", clientSecret: "72de15f92e6a4d3e9bdbee74c4330c0f" }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({ where: { email: String(credentials.email) } });
        if (!user?.passwordHash) return null;
        const isValid = await compare(String(credentials.password), user.passwordHash);
        if (!isValid) return null;
        return { id: user.id, email: user.email, name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email, image: user.avatar };
      },
    }),
  ],
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/auth", error: "/auth" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "yandex" && user.email) {
        const exists = await db.user.findUnique({ where: { email: user.email } });
        if (!exists) {
          const newUser = await db.user.create({ data: { email: user.email, firstName: user.name || "", passwordHash: "" } });
          const ws = await db.workspace.create({ data: { userId: newUser.id, name: "Моё пространство", slug: `ws-${newUser.id.slice(0, 8)}` } });
          await db.settings.create({ data: { workspaceId: ws.id } });
        }
      }
      return true;
    },
    async jwt({ token, user }) { if (user?.id) token.id = user.id; return token; },
    async session({ session, token }) {
      if (session.user) { (session.user as { id: string }).id = typeof token.id === "string" ? token.id : ""; }
      return session;
    },
  },
});
