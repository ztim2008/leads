"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy, Check, Bot, User, ExternalLink, X, Star,
  Send, EyeOff, ChevronDown, Trash2, Clock, Hash, HelpCircle,
} from "lucide-react";

interface LeadDetailProps {
  lead: {
    id: string;
    title: string | null;
    reviewCount?: number | null;
    clientRating?: number | null;
    description: string | null;
    budgetMin: any;
    budgetMax: any;
    url: string | null;
    city: string | null;
    author: string | null;
    status: string;
    createdAt: string;
    index: number;
    source: { platform: string; name: string; color: string | null };
    analyses: Array<{
      score: number;
      budgetPrediction: string | null;
      difficulty: string | null;
      recommendation: string | null;
      reasoning: string | null;
      botProbability: number | null;
      modelUsed: string | null;
    }>;
    responses: Array<{ id: string; type: string; content: string }>;
  };
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "только что";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч`;
  if (seconds < 172800) return "вчера";
  return `${Math.floor(seconds / 86400)} дн`;
}

export default function LeadDetail({ lead }: LeadDetailProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState(lead.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const analysis = lead.analyses[0];
  const bMin = lead.budgetMin ? Number(lead.budgetMin) : null;

  function budgetColor(min?: number | null): string {
    if (!min) return "var(--ink-muted)";
    if (min >= 150000) return "#7c3aed";
    if (min >= 50000) return "var(--green)";
    if (min >= 10000) return "var(--blue)";
    return "var(--ink-muted)";
  }

  function formatBudget(min?: number | null): string {
    if (!min) return "—";
    if (min >= 1000) return `${(min / 1000).toFixed(0)}K ₽`;
    return `${min} ₽`;
  }

  async function copyText(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function changeStatus(newStatus: string) {
    setSaving(true);
    try {
      await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, status: newStatus }),
      });
      setStatus(newStatus);
      router.refresh();
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Удалить заявку навсегда?")) return;
    setDeleting(true);
    try {
      await fetch("/api/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      router.refresh();
    } catch (e) { console.error(e); }
    setDeleting(false);
  }

  const bColor = budgetColor(bMin);
  const STATUS_ACTIONS = [
    { key: "Интересная", icon: Star, color: "var(--amber)", label: "Интересно", hint: "Пометить как интересную" },
    { key: "Откликнулся", icon: Send, color: "var(--blue)", label: "Отклик", hint: "Вы отправили отклик" },
    { key: "Проиграл", icon: EyeOff, color: "var(--ink-muted)", label: "Мимо", hint: "Заявка не подходит" },
  ];

  return (
    <>
      {/* ─── Карточка ──────────────────────────────────── */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "grid", gridTemplateColumns: "100px 1fr auto auto",
          gap: 0, borderBottom: "1px solid var(--border-light)",
          padding: "12px 20px", alignItems: "center",
          cursor: "pointer",
          background: expanded ? "var(--bg-hover)" : "transparent",
          transition: "background 0.1s",
        }}
      >
        {/* № и время */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Hash size={11} style={{ color: "var(--ink-muted)", opacity: 0.4 }} />
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
              {lead.index}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={11} style={{ color: "var(--ink-muted)", opacity: 0.4 }} />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
              {timeAgo(lead.createdAt)}
            </span>
          </div>
        </div>

        {/* Инфо */}
        <div style={{ paddingLeft: 14, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: lead.source.color || "var(--accent)" }} />
            <span style={{ fontWeight: 650, fontSize: "var(--text-sm)", color: "var(--ink-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {lead.title || "Без названия"}
                {lead.clientRating ? <span style={{fontSize:"0.7rem",color:"#f59e0b",marginLeft:6,whiteSpace:"nowrap"}}>{"★".repeat(lead.clientRating)}{"☆".repeat(3-lead.clientRating)}</span> : null}
                {lead.reviewCount ? <span style={{fontSize:"0.6rem",color:"var(--amber)",marginLeft:6,whiteSpace:"nowrap"}}>⭐{lead.reviewCount} отз.</span> : null}
            </span>
          </div>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 550 }}>
            {lead.description?.slice(0, 500)}
          </p>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {analysis?.score != null && (
              <span style={{
                padding: "2px 8px", borderRadius: 100, fontSize: "0.65rem", fontWeight: 700,
                background: analysis.score >= 85 ? "var(--green-soft)" : analysis.score >= 70 ? "var(--blue-soft)" : analysis.score >= 40 ? "var(--amber-soft)" : "var(--red-soft)",
                color: analysis.score >= 85 ? "var(--green)" : analysis.score >= 70 ? "var(--blue)" : analysis.score >= 40 ? "var(--amber)" : "var(--red)",
              }}>
                {analysis.score}
              </span>
            )}
            {analysis?.botProbability != null && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                padding: "2px 8px", borderRadius: 100, fontSize: "0.65rem", fontWeight: 600,
                background: analysis.botProbability <= 30 ? "var(--green-soft)" : analysis.botProbability <= 60 ? "var(--amber-soft)" : "var(--red-soft)",
                color: analysis.botProbability <= 30 ? "var(--green)" : analysis.botProbability <= 60 ? "var(--amber)" : "var(--red)",
              }}>
                {analysis.botProbability <= 30 ? <User size={10} /> : <Bot size={10} />}
                {analysis.botProbability > 30 ? `${analysis.botProbability}%` : ""}
              </span>
            )}
            {lead.responses.length > 0 && (
              <span style={{ fontSize: "0.65rem", color: "var(--accent)", fontWeight: 600 }}>📝{lead.responses.length}</span>
            )}
          </div>
        </div>

        {/* Цена */}
        <div style={{
          background: bColor + "14", border: "1.5px solid " + bColor,
          borderRadius: "var(--radius-sm)", padding: "6px 10px",
          textAlign: "center", minWidth: 65,
        }}>
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 800, color: bColor, lineHeight: 1.1 }}>
            {formatBudget(bMin)}
          </p>
        </div>

        {/* Действия */}
        <div style={{ display: "flex", gap: 4, paddingLeft: 10 }}>
          {/* Удалить */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Удалить заявку"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 30, height: 30, borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)", background: "var(--bg-surface)",
              color: "var(--ink-muted)", cursor: "pointer", opacity: deleting ? 0.5 : 1,
            }}
          >
            <Trash2 size={13} />
          </button>

          {/* Шеврон */}
          <div style={{
            display: "flex", alignItems: "center", color: "var(--ink-muted)",
            paddingLeft: 4,
          }}>
            <ChevronDown size={16} style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }} />
          </div>
        </div>
      </div>

      {/* ─── Разворот ────────────────────────────────────── */}
      {expanded && (
        <div style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-hover)",
          padding: "16px 24px 20px 138px",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Левая колонка: AI */}
            <div>
              <div style={{ marginBottom: 14 }}>
                <SectionTitle icon="🧠" text="Обоснование AI" hint="AI-анализ с обоснованием оценки" />
                <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-body)", lineHeight: "var(--leading-relaxed)", marginTop: 6 }}>
                  {analysis?.reasoning || "Анализ не проводился"}
                </p>
              </div>

              {analysis && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                  <MiniCard label="Прогноз бюджета" value={analysis.budgetPrediction || "—"} />
                  <MiniCard label="Сложность" value={analysis.difficulty || "—"} />
                </div>
              )}

              <a href={lead.url || "#"} target="_blank" rel="noopener" style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: "var(--text-xs)", color: "var(--accent)", fontWeight: 600,
              }}>
                Открыть на {lead.source.platform} <ExternalLink size={11} />
              </a>
            </div>

            {/* Правая колонка: отклики */}
            <div>
              <SectionTitle icon="📝" text="Готовые отклики" hint="AI сгенерировал 4 варианта" />
              <div style={{ marginTop: 8 }}>
                {lead.responses.length === 0 ? (
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>Не сгенерированы (рейтинг ниже 40)</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {lead.responses.map((r) => (
                      <div key={r.id} style={{
                        background: "var(--bg-surface)", borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)", overflow: "hidden",
                      }}>
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 12px", borderBottom: "1px solid var(--border-light)",
                          background: "var(--bg-layer)",
                        }}>
                          <span style={{ fontWeight: 650, fontSize: "var(--text-xs)" }}>{r.type}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyText(r.content, r.id); }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "4px 8px", borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border)", background: "var(--bg-surface)",
                              cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600,
                              color: copied === r.id ? "var(--green)" : "var(--ink-muted)",
                            }}
                          >
                            {copied === r.id ? <Check size={12} /> : <Copy size={12} />}
                            {copied === r.id ? "Готово" : "Копировать"}
                          </button>
                        </div>
                        <p style={{ padding: "10px 12px", fontSize: "var(--text-sm)", color: "var(--ink-body)", lineHeight: "var(--leading-relaxed)", whiteSpace: "pre-wrap" }}>
                          {r.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Действия */}
          <div style={{ display: "flex", gap: 8, marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)", }}>
            {STATUS_ACTIONS.map((action) => (
              <button
                key={action.key}
                onClick={(e) => { e.stopPropagation(); changeStatus(action.key); }}
                disabled={saving || status === action.key}
                title={action.hint}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: "var(--radius-sm)",
                  border: status === action.key ? `2px solid ${action.color}` : "1px solid var(--border)",
                  background: status === action.key ? action.color + "14" : "var(--bg-surface)",
                  color: status === action.key ? action.color : "var(--ink-body)",
                  fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <action.icon size={15} />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Вспомогательные
function SectionTitle({ icon, text, hint }: { icon: string; text: string; hint: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {text}
      </span>
      <span title={hint} style={{ cursor: "help" }}>
        <HelpCircle size={12} style={{ color: "var(--ink-muted)", opacity: 0.4 }} />
      </span>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 2 }}>{label}</p>
      <p style={{ fontWeight: 650, fontSize: "var(--text-sm)", color: "var(--ink-heading)" }}>{value}</p>
    </div>
  );
}
