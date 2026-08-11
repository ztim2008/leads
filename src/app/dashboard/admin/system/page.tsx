import HealthCheckWidget from "@/components/admin/health-check-widget";
import CollectorStatus from "@/components/admin/collector-status";
import { db } from "@/lib/db";

export default async function AdminSystemPage() {
  const recentActivity = await db.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginBottom: 20 }}>
        Состояние хаба, коллекторы Kwork и журнал событий. Profi на хабе отключён — сбор только на VPS партнёров.
      </p>
      <HealthCheckWidget />
      <CollectorStatus />

      <div
        style={{
          marginTop: 24,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          background: "var(--bg-surface)",
        }}
      >
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontWeight: 650 }}>
          Журнал событий
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {recentActivity.length === 0 ? (
            <p style={{ padding: 20, color: "var(--ink-muted)", fontSize: "var(--text-sm)", textAlign: "center" }}>
              Событий нет
            </p>
          ) : (
            recentActivity.map((a) => (
              <div
                key={a.id}
                style={{
                  padding: "8px 20px",
                  borderBottom: "1px solid var(--border-light)",
                  display: "flex",
                  gap: 12,
                  fontSize: "var(--text-xs)",
                }}
              >
                <span style={{ color: "var(--ink-muted)", minWidth: 70 }}>
                  {new Date(a.createdAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span style={{ color: "var(--ink-muted)", minWidth: 80, textTransform: "uppercase" }}>{a.type}</span>
                <span>{a.description}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
