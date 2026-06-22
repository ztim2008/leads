import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { notFound } from "next/navigation";
import { Inbox, Plug, Settings } from "lucide-react";
import ProfiTestButton from "@/components/profi-test-button";
import PartnerLoginButton from "@/components/admin/partner-login-button";

export default async function PartnerDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return null;
  const admin = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!admin || admin.role !== "admin") return notFound();

  const partner = await db.user.findUnique({
    where: { id: params.id },
    include: { workspaces: { include: { sources: true, settings: true, leads: { orderBy: { createdAt: "desc" }, take: 20 }, _count: { select: { leads: true } } } }, subscription: true },
  });
  if (!partner) return notFound();

  const ws = partner.workspaces[0];
  const s = ws?.settings;
  const source = ws?.sources?.[0];
  const sub = partner.subscription;
  const email = partner.email || "";
  const daysLeft = sub?.expiresAt ? Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div><h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 2 }}>{partner.firstName || email.split("@")[0]}</h1><p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>{email}</p></div>
        <PartnerLoginButton email={email} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", background: "var(--bg-surface)", borderRight: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 650, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Settings size={16} /> Настройки</h2>
          <Row label="Ловец лидов" value={s?.systemEnabled !== false ? "🟢 Включён" : "⏸ Выключен"} />
          <Row label="Интервал опроса" value={`⏱ ${s?.checkInterval || 3} мин`} />
          <Row label="Ключевые слова" value={s?.keywords || "—"} mono />
          <Row label="Минус-слова" value={s?.minusKeywords || "—"} mono />
          <Row label="Бюджет" value={`${s?.budgetMin || 3000}₽ – ${s?.budgetMax || 500000}₽`} />
          <Row label="Без бюджета" value={s?.showNoBudget !== false ? "✅ Показывать" : "❌ Скрывать"} />
          <Row label="Расписание" value={s?.workDays ? `${s.workDays.replace(/,/g,", ")} · ${s.workHoursStart || "—"}–${s.workHoursEnd || "—"}` : "24/7"} />
          <div style={{ borderTop: "1px solid var(--border)", margin: "14px 0" }} />
          <Row label="OpenRouter" value={s?.openrouterKey ? "✅ Есть ключ" : "❌ Нет ключа (AI отключён)"} />
        </div>
        <div style={{ padding: "20px 24px", background: "var(--bg-surface)" }}>
          <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 650, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Plug size={16} /> Источник</h2>
          {source ? (<>
            <Row label="Платформа" value={source.platform === "profi" ? "🟢 Profi.ru" : source.platform} />
            <Row label="Статус" value={(source.status || (source.enabled ? "active" : "pending")) === "active" ? "🟢 Работает" : source.status === "error" ? "🔴 Ошибка" : source.status === "pending" || !source.enabled ? "🟡 Ожидает проверки" : (source.status || "—")} />
            {source.lastError && <Row label="Ошибка" value={String(source.lastError).slice(0, 120)} mono />}
            <Row label="Логин Profi" value={String((source.config as any)?.login || "—")} />
            <Row label="Последняя проверка" value={source.lastCheckAt ? new Date(source.lastCheckAt).toLocaleString("ru") : "—"} />
            <Row label="Заявок собрано" value={String(ws?._count?.leads || 0)} />
            {source.platform === "profi" && (<div style={{ marginTop: 12 }}><ProfiTestButton sourceId={source.id} currentLogin={String((source.config as any)?.login || "")} currentPassword={String((source.config as any)?.password || "")} /></div>)}
          </>) : (<p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>Нет подключённых источников</p>)}
          <div style={{ borderTop: "1px solid var(--border)", margin: "20px 0 14px" }} />
          <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 650, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>📱 Telegram</h2>
          <Row label="Chat ID" value={s?.telegramChatId || "—"} />
          <Row label="Bot Token" value={s?.telegramToken ? "✅ Установлен" : "❌ Не настроен"} />
          <Row label="Уведомления" value={s?.telegramAlerts !== false ? "✅ Включены" : "⏸ Выключены"} />
          <div style={{ borderTop: "1px solid var(--border)", margin: "20px 0 14px" }} />
          <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 650, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>💳 Подписка</h2>
          <Row label="Тариф" value={sub?.plan === "pro" ? "⭐ Pro" : "Бесплатный"} />
          <Row label="Статус" value={sub?.status === "active" ? "🟢 Активна" : sub?.status || "—"} />
          {sub?.expiresAt && <Row label="До" value={`${new Date(sub.expiresAt).toLocaleDateString("ru")} (${daysLeft} дн.)`} />}
        </div>
      </div>
      <div style={{ marginTop: 24, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}><h2 style={{ fontSize: "var(--text-sm)", fontWeight: 650, display: "flex", alignItems: "center", gap: 8 }}><Inbox size={16} /> Последние заявки ({ws?._count?.leads || 0})</h2></div>
        {(!ws?.leads || ws.leads.length === 0) ? (<p style={{ padding: "30px 20px", color: "var(--ink-muted)", fontSize: "var(--text-sm)", textAlign: "center" }}>Нет заявок</p>) : (
          <div style={{ maxHeight: 500, overflowY: "auto" }}>
            {ws.leads.map((lead: any) => (
              <div key={lead.id} style={{ padding: "10px 20px", borderBottom: "1px solid var(--border-light)", display: "flex", gap: 12, alignItems: "flex-start", fontSize: "var(--text-xs)" }}>
                <div style={{ minWidth: 40, textAlign: "right", color: "var(--ink-muted)", fontWeight: 600 }}>{lead.budgetMin ? `${String(lead.budgetMin)}₽` : "—"}</div>
                <div style={{ flex: 1 }}><p style={{ fontWeight: 500, color: "var(--ink-body)", marginBottom: 2 }}>{lead.title || "Без названия"}</p><p style={{ color: "var(--ink-muted)", lineHeight: 1.4 }}>{(lead.description || "").slice(0, 120)}</p></div>
                <div style={{ fontSize: "0.6rem", color: "var(--ink-muted)", whiteSpace: "nowrap" }}>{new Date(lead.createdAt).toLocaleDateString("ru")}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid var(--border-light)", gap: 12 }}><span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", minWidth: 120 }}>{label}</span><span style={{ fontSize: "var(--text-xs)", color: "var(--ink-body)", fontWeight: 500, textAlign: "right", fontFamily: mono ? "var(--font-mono, monospace)" : undefined, wordBreak: "break-all" }}>{value}</span></div>);
}
