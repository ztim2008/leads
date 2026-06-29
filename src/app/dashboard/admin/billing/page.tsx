"use client";
import { useState, useEffect } from "react";
import { CreditCard, Settings } from "lucide-react";

export default function BillingAdminPage() {
  const [data, setData] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [bRes, cRes] = await Promise.all([fetch("/api/admin/billing"), fetch("/api/admin/app-config")]);
      if (bRes.ok) setData(await bRes.json());
      if (cRes.ok) setConfig(await cRes.json());
    } catch {}
    setLoading(false);
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const fd = new FormData(e.target as HTMLFormElement);
    const body: any = { proPrice: parseInt(fd.get("proPrice") as string) || 999, trialDays: parseInt(fd.get("trialDays") as string) || 7, supportTelegram: fd.get("supportTelegram") || "", supportEmail: fd.get("supportEmail") || "" };
    try {
      const res = await fetch("/api/admin/app-config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setConfig(await res.json()); setMsg("✅ Сохранено"); }
    } catch {}
    setSaving(false); setTimeout(() => setMsg(""), 3000);
  }

  async function manageSub(action: string, workspaceId: string) {
    await fetch("/api/admin/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, workspaceId }) });
    load(); setMsg(action === "extend" ? "✅ Продлено на 30 дней" : "❌ Отменено");
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-muted)" }}>Загрузка...</div>;
  const subs = data?.subscriptions || [];
  const payments = data?.payments || [];
  const rev = data?.revenue || { today: 0, month: 0, total: 0 };

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 24 }}>💰 Биллинг</h1>

      {/* Доходы */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: 24 }}>
        {[rev.today+" ₽", rev.month+" ₽", rev.total+" ₽"].map((val, i) => {
          const labels = ["Сегодня","За месяц","Всего"];
          const colors = ["var(--green)","var(--accent)","var(--purple)"];
          return (
          <div key={i} style={{ padding: "20px 24px", background: "var(--bg-surface)", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 4 }}>{labels[i]}</p>
            <p style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: colors[i] }}>{val}</p>
          </div>
        );})}
      </div>

      {/* Настройки цен */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--bg-surface)", padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: "var(--text-base)", fontWeight: 650, marginBottom: 16 }}><Settings size={18} /> Настройки цен</h2>
        <form onSubmit={saveConfig}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label style={lbl}>💰 Цена Pro (₽/мес)</label><input name="proPrice" type="number" defaultValue={config?.proPrice || 2900} style={inp} /></div>
            <div><label style={lbl}>🎁 Пробный период (отключён)</label><input name="trialDays" type="number" defaultValue={config?.trialDays || 0} style={inp} /></div>
            <div><label style={lbl}>📞 Telegram поддержки</label><input name="supportTelegram" defaultValue={config?.supportTelegram || ""} placeholder="@username" style={inp} /></div>
            <div><label style={lbl}>📧 Email поддержки</label><input name="supportEmail" defaultValue={config?.supportEmail || ""} placeholder="info@..." style={inp} /></div>
          </div>
          <button type="submit" disabled={saving} style={{ marginTop: 16, padding: "8px 20px", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>{saving ? "..." : "💾 Сохранить"}</button>
          {msg && <span style={{ marginLeft: 12, fontSize: "var(--text-xs)", color: "var(--green)" }}>{msg}</span>}
        </form>
      </div>

      {/* Подписки */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)", marginBottom: 24 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontWeight: 650 }}>📋 Подписки ({subs.length})</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--border)" }}><th style={th}>Пользователь</th><th style={th}>Тариф</th><th style={th}>Статус</th><th style={th}>Действует до</th><th style={th}>Платежей</th><th style={th}>Управление</th></tr></thead>
          <tbody>
            {subs.map((s: any, i: number) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={td}>{s.email || "?"}</td>
                <td style={td}><span style={{ padding: "2px 8px", borderRadius: 100, fontSize: "var(--text-xs)", fontWeight: 600, background: s.plan === "pro" ? "var(--green-soft)" : "var(--bg-hover)", color: s.plan === "pro" ? "var(--green)" : "var(--ink-muted)" }}>{s.plan === "pro" ? "Pro" : "Free"}</span></td>
                <td style={td}>{s.status === "active" ? "🟢 Активна" : "🔴 Истекла"}</td>
                <td style={td}>{s.expiresAt ? new Date(s.expiresAt).toLocaleDateString("ru-RU") : "—"}</td>
                <td style={td}>{s.paymentCount || 0}</td>
                <td style={td}><button onClick={() => manageSub("extend", s.workspaceId)} style={btn}>+30 дн</button> <button onClick={() => manageSub("cancel", s.workspaceId)} style={{ ...btn, background: "var(--red-soft)", color: "var(--red)", border: "1px solid var(--red)" }}>Отменить</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Платежи */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontWeight: 650 }}>💳 История платежей ({payments.length})</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--border)" }}><th style={th}>Дата</th><th style={th}>Email</th><th style={th}>Сумма</th><th style={th}>Тариф</th><th style={th}>ID</th></tr></thead>
          <tbody>
            {payments.slice(0, 20).map((p: any, i: number) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={td}>{new Date(p.createdAt).toLocaleString("ru-RU")}</td>
                <td style={td}>{p.email || "?"}</td>
                <td style={td}><b>{p.amount} ₽</b></td>
                <td style={td}>{p.plan === "pro" ? "Pro" : p.plan}</td>
                <td style={{ fontFamily: "monospace", fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{p.paymentId?.slice(0, 16)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
const th: any = { padding: "10px 16px", textAlign: "left", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)" };
const td: any = { padding: "10px 16px", fontSize: "var(--text-sm)" };
const btn: any = { padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--accent)", background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600, fontSize: "var(--text-xs)", cursor: "pointer" };
const lbl: any = { display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)", marginBottom: 4 };
const inp: any = { width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-root)", color: "var(--ink-body)", fontSize: "var(--text-sm)", boxSizing: "border-box" };
