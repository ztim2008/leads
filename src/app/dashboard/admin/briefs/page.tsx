import Link from "next/link";
import { redirect } from "next/navigation";
import { getBriefsActor, getBriefsEmails } from "@/lib/briefs/access";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { homePathForRole } from "@/lib/auth/roles";
import BriefCreateForm from "@/components/briefs/create-form";
import BriefAccessForm from "@/components/briefs/access-form";

const STATUS: Record<string, string> = {
  queued: "В очереди",
  running: "Читаю сайт",
  ready: "Готово",
  failed: "Не вышло",
};

export default async function BriefsPage() {
  const actor = await getBriefsActor();
  if (!actor) redirect(await deniedPath());

  const projects = await db.briefProject.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, siteUrl: true, regionName: true, niche: true, status: true, createdAt: true },
  });

  let entries: { email: string; firstName: string | null; role: string | null }[] = [];
  if (actor.isAdmin) {
    const emails = await getBriefsEmails();
    const users = await db.user.findMany({
      where: { email: { in: emails, mode: "insensitive" } },
      select: { email: true, firstName: true, role: true },
    });
    const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
    entries = emails.map((email) => {
      const user = byEmail.get(email);
      return { email, firstName: user?.firstName || null, role: user?.role || null };
    });
  }

  return (
    <div style={{ display: "grid", gap: 36, maxWidth: 880 }}>
      <header style={{ display: "grid", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: "var(--text-2xl)", fontWeight: 650 }}>Стратег</h1>
        <p style={{ margin: 0, color: "var(--ink-muted)", maxWidth: 620, lineHeight: 1.5 }}>
          Внутренний разбор сайта перед рекламой. Сейчас заполняется только аудит страниц. Конкуренты, спрос и коммерческое предложение — следующие этапы, цифры туда сами не подставляются.
        </p>
      </header>

      <BriefCreateForm />

      <section style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 650 }}>Проекты</h2>
        {projects.length === 0 && <p style={{ margin: 0, color: "var(--ink-muted)" }}>Пока пусто.</p>}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {projects.map((project) => (
            <li key={project.id} style={{ borderTop: "1px solid var(--border)" }}>
              <Link
                href={`/dashboard/admin/briefs/${project.id}`}
                style={{
                  display: "grid",
                  gap: 4,
                  padding: "12px 0",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span style={{ fontWeight: 650 }}>{hostOf(project.siteUrl)}</span>
                <span style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
                  {project.niche} · {project.regionName} · {STATUS[project.status] || project.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {actor.isAdmin && <BriefAccessForm initial={entries} />}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function deniedPath(): Promise<string> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user) return "/auth";
  return homePathForRole(role);
}
