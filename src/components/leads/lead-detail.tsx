"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy, Check, Bot, User, ExternalLink, X, Star,
  Send, EyeOff, ChevronDown,
} from "lucide-react";

interface LeadDetailProps {
  lead: {
    id: string;
    title: string | null;
    description: string | null;
    budgetMin: any;
    budgetMax: any;
    url: string | null;
    city: string | null;
    author: string | null;
    status: string;
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
    responses: Array<{
      id: string;
      type: string;
      content: string;
    }>;
  };
}

export default function LeadDetail({ lead }: LeadDetailProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState(lead.status);
  const [saving, setSaving] = useState(false);

  const analysis = lead.analyses[0];
  const bMin = lead.budgetMin ? Number(lead.budgetMin) : null;
  const bMax = lead.budgetMax ? Number(lead.budgetMax) : null;

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
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  const bColor = budgetColor(bMin);
  const STATUS_ACTIONS = [
    { key: "Интересная", icon: Star, color: "var(--amber)", label: "Интересно" },
    { key: "Откликнулся", icon: Send, color: "var(--blue)", label: "Отклик" },
    { key: "Проиграл", icon: EyeOff, color: "var(--ink-muted)", label: "Мимо" },
  ];

  return (
    <>
      {/* ─── Карточка (свёрнуто) ────────────────────────── */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "grid", gridTemplateColumns: "110px 1fr auto",
          gap: 0, borderBottom: "1px solid var(--border-light)",
          padding: "14px 20px", alignItems: "center",
          cursor: "pointer",
          background: expanded ? "var(--bg-hover)" : "transparent",
          transition: "background 0.1s",
        }}
      >
        {/* Цена */}
        <div style={{
          background: bColor + "14", border: "1.5px solid " + bColor,
          borderRadius: "var(--radius-sm)", padding: "8px 12px",
          textAlign: "center", minWidth: 80,
        }}>
          <p style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: bColor, lineHeight: 1.1 }}>
            {formatBudget(bMin)}
          </p>
        </div>

        {/* Инфо */}
        <div style={{ paddingLeft: 18, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: lead.source.color || "var(--accent)" }} />
            <span style={{ fontWeight: 650, fontSize: "var(--text-sm)", color: "var(--ink-heading)" }}>
              {lead.title || "Без названия"}
            </span>
          </div>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400 }}>
            {lead.description?.slice(0, 120)}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            {analysis?.score != null && (
              <ScoreBadge score={analysis.score} />
            )}
            {analysis?.botProbability != null && (
              <BotBadge prob={analysis.botProbability} />
            )}
            {lead.responses.length > 0 && (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", fontWeight: 600 }}>
                📝 {lead.responses.length}
              </span>
            )}
          </div>
        </div>

        {/* Шеврон */}
        <div style={{ paddingLeft: 12, color: "var(--ink-muted)" }}>
          <ChevronDown size={18} style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }} />
        </div>
      </div>

      {/* ─── Разворот ────────────────────────────────────── */}
      {expanded && (
        <div style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-hover)",
          padding: "20px 24px 24px 148px",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* ─── Левая колонка: AI + детали ─────────────── */}
            <div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Обоснование AI
                </p>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-body)", lineHeight: "var(--leading-relaxed)" }}>
                  {analysis?.reasoning || "Анализ не проводился"}
                </p>
              </div>

              {/* Метрики AI */}
              {analysis && (
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
                  marginBottom: 16,
                }}>
                  <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 2 }}>Прогноз бюджета</p>
                    <p style={{ fontWeight: 650, fontSize: "var(--text-sm)", color: "var(--ink-heading)" }}>
                      {analysis.budgetPrediction || "—"}
                    </p>
                  </div>
                  <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 2 }}>Сложность</p>
                    <p style={{ fontWeight: 650, fontSize: "var(--text-sm)", color: "var(--ink-heading)" }}>
                      {analysis.difficulty || "—"}
                    </p>
                  </div>
                </div>
              )}

              {/* Ссылка */}
              {lead.url && (
                <a
                  href={lead.url}
                  target="_blank"
                  rel="noopener"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: "var(--text-xs)", color: "var(--accent)", fontWeight: 600,
                  }}
                >
                  Открыть на {lead.source.platform} <ExternalLink size={12} />
                </a>
              )}
            </div>

            {/* ─── Правая колонка: отклики ────────────────── */}
            <div>
              <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                Готовые отклики
              </p>

              {lead.responses.length === 0 ? (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
                  Отклики не сгенерированы (рейтинг ниже 40)
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {lead.responses.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        background: "var(--bg-surface)", borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)", overflow: "hidden",
                      }}
                    >
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", borderBottom: "1px solid var(--border-light)",
                        background: "var(--bg-layer)",
                      }}>
                        <span style={{ fontWeight: 650, fontSize: "var(--text-xs)", color: "var(--ink-heading)" }}>
                          {r.type}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyText(r.content, r.id); }}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "4px 10px", borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border)", background: "var(--bg-surface)",
                            cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600,
                            color: copied === r.id ? "var(--green)" : "var(--ink-muted)",
                          }}
                        >
                          {copied === r.id ? <Check size={12} /> : <Copy size={12} />}
                          {copied === r.id ? "Скопировано" : "Копировать"}
                        </button>
                      </div>
                      <p style={{
                        padding: "12px 14px", fontSize: "var(--text-sm)",
                        color: "var(--ink-body)", lineHeight: "var(--leading-relaxed)",
                        whiteSpace: "pre-wrap",
                      }}>
                        {r.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── Действия ─────────────────────────────────── */}
          <div style={{
            display: "flex", gap: 8, marginTop: 20, paddingTop: 16,
            borderTop: "1px solid var(--border)",
          }}>
            {STATUS_ACTIONS.map((action) => (
              <button
                key={action.key}
                onClick={(e) => { e.stopPropagation(); changeStatus(action.key); }}
                disabled={saving || status === action.key}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 18px", borderRadius: "var(--radius-sm)",
                  border: status === action.key
                    ? `2px solid ${action.color}`
                    : "1px solid var(--border)",
                  background: status === action.key
                    ? action.color + "14"
                    : "var(--bg-surface)",
                  color: status === action.key ? action.color : "var(--ink-body)",
                  fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <action.icon size={16} />
                {status === action.key ? action.label : action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Вспомогательные компоненты
function ScoreBadge({ score }: { score: number }) {
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 100, fontSize: "var(--text-xs)", fontWeight: 700,
      background: score >= 85 ? "var(--green-soft)" : score >= 70 ? "var(--blue-soft)" : score >= 40 ? "var(--amber-soft)" : "var(--red-soft)",
      color: score >= 85 ? "var(--green)" : score >= 70 ? "var(--blue)" : score >= 40 ? "var(--amber)" : "var(--red)",
    }}>
      {score}/100
    </span>
  );
}

function BotBadge({ prob }: { prob: number }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 100, fontSize: "var(--text-xs)", fontWeight: 600,
      background: prob <= 30 ? "var(--green-soft)" : prob <= 60 ? "var(--amber-soft)" : "var(--red-soft)",
      color: prob <= 30 ? "var(--green)" : prob <= 60 ? "var(--amber)" : "var(--red)",
    }}>
      {prob <= 30 ? <User size={11} /> : <Bot size={11} />}
      {prob <= 30 ? "Живой" : prob <= 60 ? `${prob}% робот` : "Робот"}
    </span>
  );
}
