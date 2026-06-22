import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { notFound } from "next/navigation";

export default async function PartnerDetailPage({ params }: { params: { email: string } }) {
  const session = await auth();
  if (!session?.user) return null;
  const admin = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!admin || admin.role !== "admin") return notFound();

  const email = params.email;
  const partner = await db.user.findUnique({
    where: { email },
    include: { workspaces: { include: { sources: true, settings: true, leads: { orderBy: { createdAt: "desc" }, take: 5 }, _count: { select: { leads: true } } } }, subscription: true },
  });
  if (!partner) return notFound();

  const ws = partner.workspaces[0];
  const s = ws?.settings;
  const source = ws?.sources?.[0];

  return (
    <div>
      <h1 style={{fontSize:"1.5rem",fontWeight:700}}>{partner.firstName || email.split("@")[0]}</h1>
      <p>{email}</p>
      <p>Workspace: {ws?.id ? "✅" : "❌"}</p>
      <p>Settings: {s?.id ? "✅" : "❌"}</p>
      <p>Source: {source?.platform || "—"} · {source?.status || "—"}</p>
      <p>Leads: {ws?._count?.leads || 0}</p>
    </div>
  );
}
