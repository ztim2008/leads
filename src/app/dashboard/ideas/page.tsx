import { auth } from "@/lib/auth/auth";
import { canAccessIdeas } from "@/lib/ideas/access";
import { homePathForRole } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function IdeasBoardPage() {
  const session = await auth();
  const user = session?.user as { email?: string; role?: string } | undefined;
  if (!user?.email) redirect("/auth");

  const ok = await canAccessIdeas(user.email, user.role);
  if (!ok) redirect(homePathForRole(user.role));

  return (
    <div>
      <h1
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 800,
          color: "var(--ink-heading)",
          marginBottom: 8,
        }}
      >
        Партнеры идеи
      </h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 24, maxWidth: 520 }}>
        Доска идей для основателя и выбранных партнёров. Создание, анализ и комментарии —
        скоро. Сейчас доступ уже работает: админ выдаёт его на пульте.
      </p>

      <div
        style={{
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          padding: 28,
          textAlign: "center",
        }}
      >
        <p style={{ fontWeight: 650, marginBottom: 8, color: "var(--ink-heading)" }}>
          Пока идей нет
        </p>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginBottom: 0 }}>
          CRUD появится на следующем шаге. API: <code>/api/ideas</code>
        </p>
      </div>

      <p style={{ marginTop: 20, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
        Управление доступом:{" "}
        <Link href="/dashboard/admin/ops" style={{ color: "var(--accent)" }}>
          Пульт → Ideas Board
        </Link>
        {" "}(только админ)
      </p>
    </div>
  );
}
