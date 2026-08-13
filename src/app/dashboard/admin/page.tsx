import PartnersAdminTable from "@/components/admin/partners-admin-table";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { Shield } from "lucide-react";

export default async function AdminPartnersPage() {
  const session = await auth();
  if (!session?.user) return null;
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "admin") {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Shield size={48} style={{ color: "var(--ink-muted)", opacity: 0.3, marginBottom: 16 }} />
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700 }}>Доступ запрещён</h1>
      </div>
    );
  }

  const partnerCount = await db.user.count({ where: { role: { not: "admin" } } });
  const leadsTotal = await db.lead.count({
    where: { workspace: { user: { role: { not: "admin" } } } },
  });

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatCard label="Партнёров" value={partnerCount} />
        <StatCard label="Заявок всего" value={leadsTotal} />
      </div>
      <PartnersAdminTable />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{label}</p>
      <p style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--ink-heading)" }}>{value}</p>
    </div>
  );
}
