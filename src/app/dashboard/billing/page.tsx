import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Shield, Zap, Check, ArrowRight } from "lucide-react";
import PayButton from "./pay-button";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user) return null;

  const ws = await db.workspace.findFirst({ where: { userId: user.id } });
  if (!ws) return null;

  const sub = await db.subscription.findFirst({ where: { workspaceId: ws.id } });
  const isPro = sub?.plan === "pro" && sub?.status === "active";
  const daysLeft = sub?.expiresAt
    ? Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 4 }}>Тарифы</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 32 }}>
        {isPro ? `Pro активен · осталось ${daysLeft} дн.` : "Бесплатный план"}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        {/* Бесплатный */}
        <div style={{ padding: "32px 28px", background: "var(--bg-surface)", borderRight: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: 4 }}>Бесплатный</h2>
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 20 }}>Для старта</p>
          <p style={{ fontSize: "var(--text-3xl)", fontWeight: 800, marginBottom: 24 }}>0 ₽</p>
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {["1 источник заявок", "50 заявок в день", "Telegram-уведомления", "Базовые фильтры", "Панель управления"].map(t => (
              <li key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-sm)", color: "var(--ink-body)" }}><Check size={14} style={{ color: "var(--green)" }} /> {t}</li>
            ))}
            {["AI-анализ", "Генерация откликов", "Безлимит заявок", "Приоритетная поддержка"].map(t => (
              <li key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}><span style={{ opacity: 0.3 }}>✗</span> {t}</li>
            ))}
          </ul>
          {!isPro && <span style={{ display: "block", textAlign: "center", padding: "10px", borderRadius: "var(--radius-sm)", background: "var(--bg-layer)", color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Текущий план</span>}
        </div>

        {/* Pro */}
        <div style={{ padding: "32px 28px", background: "var(--accent)", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Shield size={18} /><h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "#fff" }}>Pro</h2>
          </div>
          <p style={{ opacity: 0.7, fontSize: "var(--text-sm)", marginBottom: 20 }}>Для профессионалов</p>
          <p style={{ fontSize: "var(--text-3xl)", fontWeight: 800, marginBottom: 4, color: "#fff" }}>700 ₽</p>
          <p style={{ opacity: 0.7, fontSize: "var(--text-sm)", marginBottom: 24 }}>в месяц</p>
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {["Все источники заявок", "Безлимит заявок", "AI-анализ каждой заявки", "Генерация 4 типов откликов", "Приоритетная поддержка", "Telegram-уведомления"].map(t => (
              <li key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-sm)", opacity: 0.9 }}><Check size={14} /> {t}</li>
            ))}
          </ul>
          {isPro ? (
            <span style={{ display: "block", textAlign: "center", padding: "10px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.15)", fontSize: "var(--text-sm)" }}>Текущий план · {daysLeft} дн.</span>
          ) : (
            <PayButton plan="pro" />
          )}
        </div>
      </div>
    </div>
  );
}
