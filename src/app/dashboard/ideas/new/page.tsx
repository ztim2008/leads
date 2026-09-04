import { auth } from "@/lib/auth/auth";
import { canAccessIdeas } from "@/lib/ideas/access";
import { homePathForRole, isAdminRole } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import Link from "next/link";
import IdeaCreateForm from "@/components/ideas/idea-create-form";

export default async function IdeasNewPage() {
  const session = await auth();
  const user = session?.user as { email?: string; role?: string } | undefined;
  if (!user?.email) redirect("/auth");

  const ok = await canAccessIdeas(user.email, user.role);
  if (!ok) redirect(homePathForRole(user.role));
  if (!isAdminRole(user.role)) redirect("/dashboard/ideas");

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
      <h1
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 800,
          color: "var(--ink-heading)",
          marginBottom: 8,
        }}
      >
        Новая идея
      </h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 24, maxWidth: 520 }}>
        Создать идею может только админ. Партнёры с доступом увидят её на доске и смогут комментировать.
      </p>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          padding: 20,
        }}
      >
        <IdeaCreateForm />
      </div>
    </div>
  );
}
