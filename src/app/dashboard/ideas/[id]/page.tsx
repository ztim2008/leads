import { auth } from "@/lib/auth/auth";
import { canAccessIdeas } from "@/lib/ideas/access";
import { homePathForRole } from "@/lib/auth/roles";
import { displayName, loadUsersByIds } from "@/lib/ideas/users";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import IdeaStatusControl from "@/components/ideas/idea-status-control";
import IdeaComments from "@/components/ideas/idea-comments";
import IdeaStatusBadge from "@/components/ideas/idea-status-badge";

type Props = { params: Promise<{ id: string }> };

export default async function IdeaDetailPage({ params }: Props) {
  const session = await auth();
  const user = session?.user as { email?: string; role?: string; id?: string } | undefined;
  if (!user?.email) redirect("/auth");

  const ok = await canAccessIdeas(user.email, user.role);
  if (!ok) redirect(homePathForRole(user.role));

  const { id } = await params;
  const idea = await db.idea.findUnique({
    where: { id },
    include: { comments: { orderBy: { createdAt: "asc" } } },
  });
  if (!idea) notFound();

  // Статус может менять любой с доступом к доске; текст — автор/админ (на API).
  const canChangeStatus = true;

  const users = await loadUsersByIds([idea.createdById, ...idea.comments.map((c) => c.authorId)]);
  const author = users.get(idea.createdById);

  const comments = idea.comments.map((c) => {
    const u = users.get(c.authorId);
    return {
      id: c.id,
      body: c.body,
      authorName: displayName(u, c.authorId),
      authorEmail: u?.email ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  });

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link
          href="/dashboard/ideas"
          style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
        >
          ← К списку
        </Link>
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <IdeaStatusBadge status={idea.status} />
            {idea.tags.map((t) => (
              <span
                key={t}
                style={{
                  padding: "2px 7px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-layer)",
                  border: "1px solid var(--border)",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  color: "var(--ink-muted)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 800,
              color: "var(--ink-heading)",
              margin: "0 0 8px",
              lineHeight: 1.25,
            }}
          >
            {idea.title}
          </h1>
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            {displayName(author, idea.createdById)}
            {" · "}
            {idea.createdAt.toLocaleString("ru-RU", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        <div>
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 650,
              color: "var(--ink-muted)",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Статус
          </div>
          <IdeaStatusControl
            ideaId={idea.id}
            initialStatus={idea.status}
            canEdit={!!canChangeStatus}
          />
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          padding: 20,
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            color: "var(--ink-heading)",
            margin: "0 0 10px",
          }}
        >
          Описание
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            color: "var(--ink-body)",
            whiteSpace: "pre-wrap",
            lineHeight: 1.55,
          }}
        >
          {idea.body}
        </p>
      </div>

      <div
        style={{
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          padding: 18,
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            color: "var(--ink-heading)",
            margin: "0 0 6px",
          }}
        >
          Анализ агента
        </h2>
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
          Анализ — скоро. Граф и рекомендации появятся на следующем шаге.
        </p>
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          padding: 20,
        }}
      >
        <IdeaComments ideaId={idea.id} initialComments={comments} />
      </div>
    </div>
  );
}
