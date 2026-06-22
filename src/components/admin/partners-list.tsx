"use client";
import { useState, useEffect } from "react";

function HealthDot({ status, lastError, lastCheckAt }: { status: string; lastError?: string | null; lastCheckAt?: string | null }) {
  const colors: Record<string, string> = {
    active: "var(--green)",
    error: "var(--red)",
    warning: "var(--amber)",
    pending: "var(--amber)",
  };
  const labels: Record<string, string> = {
    active: "Работает",
    error: "Ошибка",
    warning: "Внимание",
    pending: "Ожидает проверки",
  };
  const color = colors[status] || "var(--ink-muted)";
  const label = labels[status] || status;

  const tooltip = [
    label,
    lastCheckAt ? `Проверка: ${new Date(lastCheckAt).toLocaleString("ru")}` : "",
    lastError ? `Ошибка: ${lastError}` : "",
  ].filter(Boolean).join("\n");

  return (
    <span title={tooltip} style={{ cursor: "help", display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{
        display: "inline-block", width: 8, height: 8, borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}80`,
      }} />
      <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{label}</span>
    </span>
  );
}

export default function PartnersList() {
  const [partners, setPartners] = useState<any[]>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{email:string;ok:boolean;msg:string}|null>(null);

  async function load() {
    try {
      const r = await fetch("/api/admin/partners");
      const d = await r.json();
      setPartners(d.partners || []);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  async function deletePartner(email: string) {
    if (!confirm(`Удалить партнёра ${email}?\n\nБудут удалены: все заявки, настройки, источники.\nДействие необратимо.`)) return;
    const res = await fetch("/api/admin/delete-partner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await res.json();
    if (d.ok) { alert("✅ Удалён"); load(); }
    else alert("❌ " + (d.error || "Ошибка"));
  }

  async function loginAs(email: string) {
    const res = await fetch("/api/admin/login-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await res.json();
    if (d.ok) window.open(d.url, "_blank");
    else alert("Ошибка: " + (d.error || "Неизвестно"));
  }

  async function testTelegram(email: string) {
    setTesting(email);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/test-telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const d = await res.json();
      setTestResult({ email, ok: d.ok, msg: d.ok ? `✅ ${d.botName} — работает` : `❌ ${d.error}` });
    } catch {
      setTestResult({ email, ok: false, msg: "❌ Ошибка запроса" });
    }
    setTesting(null);
  }

  async function markPaid(email: string) {
    if (!confirm("Пометить оплату на 30 дней?")) return;
    await fetch("/api/admin/mark-paid", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    alert("✅ Отмечено");
  }

  if (partners.length === 0) return <p style={{padding:"20px",color:"var(--ink-muted)",fontSize:"var(--text-sm)",textAlign:"center"}}>Нет партнёров</p>;

  return (
    <div>
      {testResult && testResult.email && (
        <div style={{margin:"0 16px 8px",padding:"8px 14px",borderRadius:"var(--radius-sm)",fontSize:"var(--text-xs)",
          background: testResult.ok ? "var(--green-soft)" : "var(--red-soft)",
          color: testResult.ok ? "var(--green)" : "var(--red)",
          border: `1px solid ${testResult.ok ? "var(--green)" : "var(--red)"}`,
          display:"flex",justifyContent:"space-between",alignItems:"center",
        }}>
          <span>{testResult.msg}</span>
          <button onClick={()=>setTestResult(null)} style={{background:"none",border:"none",color:"inherit",cursor:"pointer",fontWeight:700}}>✕</button>
        </div>
      )}
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr style={{borderBottom:"1px solid var(--border)"}}>
          <th style={th}>Партнёр</th>
          <th style={th}>Profi</th>
          <th style={th}>Заявок</th>
          <th style={th}>Tg</th>
          <th style={th}>Здоровье</th>
          <th style={th}>Последняя</th>
          <th style={th}></th>
        </tr></thead>
        <tbody>
          {partners.map((p:any) => {
            const ws = p.workspace;
            const source = ws?.sources?.[0];
            const sourceStatus = source?.status || (source?.enabled ? "active" : "pending");
            const sourceError = source?.lastError;
            const lastCheck = source?.lastCheckAt;
            const hasTg = ws?.settings?.telegramChatId && ws?.settings?.telegramToken;

            return (
              <tr key={p.id} style={{borderBottom:"1px solid var(--border-light)"}}>
                <td style={td}>
                  <span style={{fontWeight:650,fontSize:"var(--text-sm)"}}>{p.name||p.email}</span>
                  <br/><span style={{fontSize:"var(--text-xs)",color:"var(--ink-muted)"}}>{p.email}</span>
                </td>
                <td style={td}>
                  {source?.enabled ? <span style={{color:"var(--green)",fontSize:"var(--text-xs)"}}>✅</span> : <span style={{color:"var(--ink-muted)",fontSize:"var(--text-xs)"}}>❌</span>}
                </td>
                <td style={{...td,fontWeight:600}}>{ws?.leadsCount||0}</td>
                <td style={td}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {hasTg ? <span style={{color:"var(--green)",fontSize:"var(--text-xs)"}}>✅</span> : <span style={{color:"var(--ink-muted)",fontSize:"var(--text-xs)"}}>—</span>}
                    {hasTg && (
                      <button onClick={()=>testTelegram(p.email)} disabled={testing===p.email}
                        title="Проверить связь с ботом"
                        style={{padding:"2px 6px",borderRadius:4,border:"1px solid var(--border)",background:"var(--bg-layer)",color:"var(--ink-muted)",fontSize:"0.6rem",cursor:"pointer"}}>
                        {testing===p.email?"…":"🧪"}
                      </button>
                    )}
                  </div>
                </td>
                <td style={td}>
                  <HealthDot status={sourceStatus} lastError={sourceError} lastCheckAt={lastCheck} />
                </td>
                <td style={{...td,fontSize:"var(--text-xs)",color:"var(--ink-muted)"}}>
                  {lastCheck ? new Date(lastCheck).toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"}) : "—"}
                </td>
                <td style={td}>
                  <div style={{display:"flex",gap:4}}>
                    <button onClick={()=>loginAs(p.email)} style={btn("var(--accent-soft)","var(--accent)")}>🔑 Войти</button>
                    {(() => { const isPaid = p.subscription?.plan === "pro" && p.subscription?.status === "active"; return <button onClick={()=>markPaid(p.email)} title={isPaid ? "Pro активна" : "Не оплачено"} style={btn(isPaid ? "var(--green-soft)" : "var(--bg-hover)", isPaid ? "var(--green)" : "var(--ink-muted)")}>💰</button>; })()}
                    <button onClick={()=>deletePartner(p.email)} style={btn("var(--red-soft)","var(--red)")}>🗑</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {padding:"10px 12px",textAlign:"left",fontSize:"var(--text-xs)",fontWeight:600,color:"var(--ink-muted)"};
const td: React.CSSProperties = {padding:"10px 12px",fontSize:"var(--text-sm)"};
const btn = (bg:string, clr:string): React.CSSProperties => ({
  padding:"4px 8px",borderRadius:"var(--radius-sm)",background:bg,color:clr,
  border:`1px solid ${clr}`,fontSize:"var(--text-xs)",fontWeight:600,cursor:"pointer",
});
