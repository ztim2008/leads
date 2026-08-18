import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import PartnerFiltersForm from "@/components/dashboard/partner-filters-form";
import { filtersFromConfig } from "@/lib/leads/partner-filters";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const authUser = session.user as { id?: string; role?: string; impersonatorId?: string };
  const isOperator = authUser.role === "admin" && !authUser.impersonatorId;

  if (isOperator) {
    return (
      <div>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 8 }}>Настройки</h1>
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
          Фильтры партнёра — в кабинете партнёра (войти как он или открыть «Просмотр»).
          Интервал Profi и стоп сбора — только с Пульта, без смены входа.
        </p>
      </div>
    );
  }

  const workspace = await db.workspace.findFirst({ where: { userId: authUser.id! } });
  if (!workspace) return null;

  let settings = await db.settings.findUnique({ where: { workspaceId: workspace.id } });
  if (!settings) settings = await db.settings.create({ data: { workspaceId: workspace.id } });
  const source = await db.source.findFirst({ where: { workspaceId: workspace.id, platform: "profi" } });
  const cfg = (source?.config as Record<string, unknown>) || {};
  const initial = filtersFromConfig(cfg, settings as unknown as Record<string, unknown>);

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 4 }}>Фильтры</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 16 }}>
        Плюс и минус отдельно для заголовка и для текста. «Сайт» = сайты, сайтов, сайтами.
      </p>
      <PartnerFiltersForm workspaceId={workspace.id} initial={initial} />
    </div>
  );
}
