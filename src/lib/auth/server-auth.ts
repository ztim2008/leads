import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "981enFOks++AvBhamoSqvoDPxzCIy8sVKuoZSTjHexQ=");

// Проверяет оба источника: NextAuth сессию и leads_token куку
export async function getServerUser(): Promise<{ email: string; role: string } | null> {
  // 1. NextAuth
  const session = await auth();
  if (session?.user) {
    const email = (session.user as any).email;
    if (email) {
      const dbUser = await db.user.findUnique({ where: { email }, select: { role: true } });
      return { email, role: dbUser?.role || "user" };
    }
  }
  
  // 2. leads_token кука
  try {
    const token = (await cookies()).get("leads_token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, SECRET);
    return { email: payload.email as string, role: payload.role as string };
  } catch { return null; }
}
