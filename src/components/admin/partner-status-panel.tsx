"use client";
import { useState, useEffect } from "react";

interface AgentStatus {
  online: boolean;
  lastHeartbeat: string | null;
  uptime: number;
  memory: number;
  leads: number;
  errors: number;
  lastError: string | null;
  lastErrorTime: string | null;
}

interface PartnerSource {
  id: string;
  platform: string;
  enabled: boolean;
  lastCheckAt: string | null;
  status: string;
  lastError: string | null;
  agentStatus: AgentStatus;
  setupCommand: string | null;
}

interface Partner {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  workspace: {
    name: string;
    sources: PartnerSource[];
    leadsCount: number;
  } | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec} сек`;
  if (sec < 3600) return `${Math.floor(sec / 60)} мин`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ч`;
  return `${Math.floor(sec / 86400)} дн`;
}

function statusBadge(s: PartnerSource) {
  const a = s.agentStatus;
  if (!a.online) return { text: "⚫ Нет связи", color: "var(--ink-muted)", bg: "var(--bg-hover)" };
  if (a.lastError) return { text: "🟡 Ошибка", color: "var(--amber)", bg: "#f59e0b15" };
  if (!s.enabled) return { text: "⏸ Пауза", color: "var(--ink-muted)", bg: "var(--bg-hover)" };
  return { text: "🟢 Онлайн", color: "var(--green)", bg: "#22c55e15" };
}

function copyToClipboard(text: string, cb: () => void) {
  navigator.clipboard.writeText(text).then(cb);
}

export default function PartnerStatusPanel() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string>("");

  useEffect(() => {
    fetch("/api/admin/partners")
      .then(r => r.json())
      .then(d => { setPartners(d.partners || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20, color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Загрузка...</div>;
  if (partners.length === 0) return <div style={{ padding: 20, color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Нет партнёров</div>;

  const th: any = { padding: "10px 14px", textAlign: "left", fontSize: "0.7rem", fontWeight: 600, color: "var(--ink-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" };
  const td: any = { padding: "10px 14px", fontSize: "var(--text-xs)", borderBottom: "1px solid var(--border-light)", verticalAlign: "top" };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Партнёр</th>
            <th style={th}>Статус</th>
            <th style={th}>💓 Heartbeat</th>
            <th style={th}>📥 Сегодня</th>
            <th style={th}>📦 Всего</th>
            <th style={th}>⚠️ Ошибка</th>
            <th style={th}>💾 RAM</th>
            <th style={th}>🔄 Uptime</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {partners.map(p => {
            const ws = p.workspace;
            const sources = ws?.sources || [];
            return sources.map((src, i) => {
              const a = src.agentStatus;
              const badge = statusBadge(src);
              const isFirstSource = i === 0;
              return (
                <tr key={src.id}>
                  {isFirstSource ? (
                    <td style={{...td, borderRight: "1px solid var(--border-light)"}} rowSpan={sources.length}>
                      <div>
                        <p style={{ fontWeight: 650, color: "var(--ink-heading)" }}>{p.name || p.email.split("@")[0]}</p>
                        <p style={{ color: "var(--ink-muted)", fontSize: "0.65rem" }}>{p.email}</p>
                      </div>
                    </td>
                  ) : null}
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 100, fontSize: "0.7rem", fontWeight: 600, background: badge.bg, color: badge.color }}>
                      {badge.text}
                    </span>
                  </td>
                  <td style={{...td, color: "var(--ink-muted)", fontSize: "0.7rem"}}>
                    {a.lastHeartbeat ? timeAgo(a.lastHeartbeat) : "—"}
                  </td>
                  <td style={{...td, fontWeight: 600, color: "var(--ink-heading)"}}>
                    {ws?.leadsCount || 0}
                  </td>
                  <td style={{...td, color: "var(--ink-muted)"}}>
                    {a.leads}
                  </td>
                  <td style={td}>
                    {a.lastError ? (
                      <div>
                        <p style={{ color: "var(--red)", fontSize: "0.7rem", fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.lastError}>
                          {a.lastError}
                        </p>
                        {a.lastErrorTime && <p style={{ color: "var(--ink-muted)", fontSize: "0.6rem" }}>{timeAgo(a.lastErrorTime)}</p>}
                      </div>
                    ) : (
                      <span style={{ color: "var(--ink-muted)", fontSize: "0.65rem" }}>—</span>
                    )}
                  </td>
                  <td style={{...td, fontSize: "0.7rem", color: "var(--ink-muted)"}}>
                    {a.online ? `${a.memory} MB` : "—"}
                  </td>
                  <td style={{...td, fontSize: "0.7rem", color: "var(--ink-muted)"}}>
                    {a.online ? `${Math.floor(a.uptime / 3600)}ч ${Math.floor((a.uptime % 3600) / 60)}м` : "—"}
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {src.setupCommand && (
                        <button onClick={() => { copyToClipboard(src.setupCommand || "", () => setCopied(src.id)); setTimeout(() => setCopied(""), 2000); }}
                          style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: copied === src.id ? "var(--green-soft)" : "var(--bg-root)", color: copied === src.id ? "var(--green)" : "var(--ink-muted)", fontSize: "0.65rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                          {copied === src.id ? "✅" : "📋"} Код
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}
