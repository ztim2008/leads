import { auth } from "@/lib/auth/auth";
import { canAccessIdeas } from "@/lib/ideas/access";
import { homePathForRole, isAdminRole } from "@/lib/auth/roles";
import { IDEA_STATUSES, IDEA_STATUS_LABELS, type IdeaStatus } from "@/lib/ideas/constants";
import { displayName, loadUsersByIds } from "@/lib/ideas/users";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Lightbulb, Plus } from "lucide-react";
import IdeaStatusBadge from "@/components/ideas/idea-status-badge";

export default async function IdeasBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  const user = session?.user as { email?: string; role?: string; id?: string } | undefined;
  if (!user?.email) redirect("/auth");

  const ok = await canAccessIdeas(user.email, user.role);
  if (!ok) redirect(homePathForRole(user.role));

  const isAdmin = isAdminRole(user.role);
  const { status: statusFilter } = await searchParams;
  const where =
    statusFilter && (IDEA_STATUSES as readonly string[]).includes(statusFilter)
      ? { status: statusFilter }
      : {};

  const ideas = await db.idea.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { comments: true } } },
  });
  const authors = await loadUsersByIds(ideas.map((i) => i.createdById));

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 800,
              color: "var(--ink-heading)",
              marginBottom: 6,
            }}
          >
            Партнеры идеи
          </h1>
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", margin: 0, maxWidth: 480 }}>
            Доска идей основателя и выбранных партнёров. Комментируйте и обсуждайте статусы.
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/ideas/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: "var(--radius-sm)",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 650,
              fontSize: "var(--text-sm)",
              textDecoration: "none",
            }}
          >
            <Plus size={16} strokeWidth={2.25} />
            Новая идея
          </Link>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <FilterChip href="/dashboard/ideas" label="Все" active={!statusFilter} />
        {IDEA_STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={`/dashboard/ideas?status=${s}`}
            label={IDEA_STATUS_LABELS[s as IdeaStatus]}
            active={statusFilter === s}
          />
        ))}
      </div>

      {ideas.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-surface)",
            padding: 40,
            textAlign: "center",
          }}
        >
          <Lightbulb size={40} style={{ color: "var(--ink-muted)", opacity: 0.35, marginBottom: 12 }} />
          <p style={{ fontWeight: 650, marginBottom: 6, color: "var(--ink-heading)" }}>
            {statusFilter ? "Нет идей с таким статусом" : "Пока идей нет"}
          </p>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", margin: 0 }}>
            {isAdmin
              ? "Создайте первую идею — партнёры с доступом смогут комментировать."
              : "Основатель добавит идеи сюда."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ideas.map((idea) => {
            const author = authors.get(idea.createdById);
            return (
              <Link
                key={idea.id}
                href={`/dashboard/ideas/${idea.id}`}
                style={{
                  display: "block",
                  padding: "16px 18px",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                    marginBottom: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "var(--text-base)",
                      fontWeight: 700,
                      color: "var(--ink-heading)",
                      lineHeight: 1.35,
                    }}
                  >
                    {idea.title}
                  </h2>
                  <IdeaStatusBadge status={idea.status} />
                </div>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: "var(--text-sm)",
                    color: "var(--ink-muted)",
                    lineHeight: 1.45,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {idea.body}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                    fontSize: "0.65rem",
                    color: "var(--ink-muted)",
                  }}
                >
                  {idea.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        padding: "2px 7px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-layer)",
                        border: "1px solid var(--border)",
                        fontWeight: 600,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                  <span style={{ marginLeft: idea.tags.length ? 4 : 0 }}>
                    {displayName(author, idea.createdById)}
                  </span>
                  <span>·</span>
                  <time>
                    {idea.createdAt.toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                  <span>·</span>
                  <span>{idea._count.comments} комм.</span>
                  {idea.analysis != null && (
                    <>
                      <span>·</span>
                      <span style={{ color: "var(--accent)", fontWeight: 650 }}>есть анализ</span>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <p style={{ marginTop: 20, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
          Управление доступом:{" "}
          <Link href="/dashboard/admin/ops" style={{ color: "var(--accent)" }}>
            Пульт → Ideas Board
          </Link>
        </p>
      )}
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "7px 12px",
        borderRadius: "var(--radius-sm)",
        border: active ? "2px solid var(--accent)" : "1px solid var(--border)",
        background: active ? "var(--accent-soft)" : "var(--bg-surface)",
        color: active ? "var(--accent)" : "var(--ink-body)",
        fontWeight: active ? 650 : 500,
        fontSize: "var(--text-xs)",
        textDecoration: "none",
      }}
    >
      {label}
    </Link>
  );
}
