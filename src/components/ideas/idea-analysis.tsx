"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  VERDICT_LABELS,
  EFFORT_LABELS,
  type IdeaAnalysis,
  type IdeaVerdict,
  type RiskSeverity,
} from "@/lib/ideas/analysis-types";

const SEVERITY_LABELS: Record<RiskSeverity, string> = {
  low: "низкий",
  med: "средний",
  high: "высокий",
};

const OWNER_LABELS: Record<string, string> = {
  founder: "основатель",
  partner: "партнёр",
  both: "оба",
};

type Props = {
  ideaId: string;
  initialAnalysis: IdeaAnalysis | null;
  analyzedAt: string | null;
  status: string;
  canRefresh?: boolean;
};

function Chip({
  children,
  color = "var(--accent)",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-layer)",
        border: `1px solid ${color}`,
        color,
        fontSize: "0.7rem",
        fontWeight: 700,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </span>
  );
}

function SectionTable({
  title,
  headers,
  rows,
  empty,
}: {
  title: string;
  headers: string[];
  rows: React.ReactNode[][];
  empty?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          color: "var(--ink-heading)",
          margin: "0 0 8px",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {title}
      </h3>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
          {empty || "Нет данных"}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "var(--text-sm)",
            }}
          >
            <thead>
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      borderBottom: "1px solid var(--border)",
                      color: "var(--ink-muted)",
                      fontWeight: 650,
                      fontSize: "0.7rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, i) => (
                <tr key={i}>
                  {cells.map((cell, j) => (
                    <td
                      key={j}
                      style={{
                        padding: "9px 10px",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--ink-body)",
                        verticalAlign: "top",
                        lineHeight: 1.45,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WeightDots({ weight }: { weight: number }) {
  return (
    <span style={{ color: "var(--accent)", fontWeight: 700, whiteSpace: "nowrap" }} title={`Вес ${weight}/5`}>
      {"●".repeat(weight)}
      <span style={{ color: "var(--border)" }}>{"○".repeat(Math.max(0, 5 - weight))}</span>
    </span>
  );
}

export default function IdeaAnalysisPanel({
  ideaId,
  initialAnalysis,
  analyzedAt,
  status,
  canRefresh = true,
}: Props) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<IdeaAnalysis | null>(initialAnalysis);
  const [at, setAt] = useState(analyzedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analyzing = status === "analyzing" || busy;

  async function reanalyze() {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/ideas/${ideaId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(d.error || "Ошибка анализа");
      return;
    }
    setAnalysis(d.analysis as IdeaAnalysis);
    setAt(d.analyzedAt ?? null);
    router.refresh();
  }

  if (!analysis && analyzing) {
    return (
      <div
        style={{
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          padding: 18,
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            color: "var(--ink-heading)",
            margin: "0 0 6px",
          }}
        >
          Анализ агента
        </h2>
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
          Агент раскладывает идею на за/против…
        </p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div
        style={{
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          padding: 18,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 700,
                color: "var(--ink-heading)",
                margin: "0 0 6px",
              }}
            >
              Анализ агента
            </h2>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
              Пока нет разбора. Запустите анализ — агент соберёт за/против, риски и шаги.
            </p>
          </div>
          {canRefresh && (
            <button
              type="button"
              onClick={reanalyze}
              disabled={busy}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 650,
                fontSize: "var(--text-xs)",
                cursor: busy ? "wait" : "pointer",
                alignSelf: "flex-start",
              }}
            >
              {busy ? "Анализирую…" : "Запустить анализ"}
            </button>
          )}
        </div>
        {error && (
          <p style={{ margin: "10px 0 0", fontSize: "var(--text-sm)", color: "var(--red)" }}>{error}</p>
        )}
      </div>
    );
  }

  const verdict = analysis.verdict as IdeaVerdict;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-surface)",
        padding: 18,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              color: "var(--ink-heading)",
              margin: "0 0 8px",
            }}
          >
            Анализ агента
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <Chip color="var(--accent)">
              Вердикт: {VERDICT_LABELS[verdict] || analysis.verdict}
            </Chip>
            <Chip color="var(--green)">
              Усилия: {EFFORT_LABELS[analysis.effort?.label] || analysis.effort?.label} ·{" "}
              {analysis.effort?.weeksHint}
            </Chip>
            {analysis.source === "fallback" && <Chip color="var(--ink-muted)">без LLM</Chip>}
          </div>
          {at && (
            <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--ink-muted)" }}>
              Обновлён{" "}
              {new Date(at).toLocaleString("ru-RU", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
        {canRefresh && (
          <button
            type="button"
            onClick={reanalyze}
            disabled={busy}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-layer)",
              color: "var(--ink-body)",
              fontWeight: 650,
              fontSize: "var(--text-xs)",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Пересобираю…" : "Пересобрать анализ"}
          </button>
        )}
      </div>

      <p
        style={{
          margin: "0 0 16px",
          fontSize: "var(--text-sm)",
          color: "var(--ink-body)",
          lineHeight: 1.55,
        }}
      >
        {analysis.summary}
      </p>

      {analysis.fitWithKonversus && (
        <p
          style={{
            margin: "0 0 16px",
            fontSize: "var(--text-sm)",
            color: "var(--ink-muted)",
            lineHeight: 1.5,
            padding: "10px 12px",
            background: "var(--bg-layer)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
          }}
        >
          <strong style={{ color: "var(--ink-heading)" }}>Fit с Konversus: </strong>
          {analysis.fitWithKonversus}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        <SectionTable
          title="За / Сильные"
          headers={["#", "Пункт", "Вес"]}
          rows={(analysis.pros || []).map((p, i) => [
            i + 1,
            p.text,
            <WeightDots key={p.id} weight={p.weight} />,
          ])}
        />
        <SectionTable
          title="Против / Слабые"
          headers={["#", "Пункт", "Вес"]}
          rows={(analysis.cons || []).map((c, i) => [
            i + 1,
            c.text,
            <WeightDots key={c.id} weight={c.weight} />,
          ])}
        />
      </div>

      <SectionTable
        title="Риски"
        headers={["Риск", "Уровень", "Митигация"]}
        rows={(analysis.risks || []).map((r) => [
          r.text,
          SEVERITY_LABELS[r.severity] || r.severity,
          r.mitigation,
        ])}
      />

      <SectionTable
        title="Аналоги"
        headers={["Название", "Заметка"]}
        rows={(analysis.analogs || []).map((a) => [
          a.url ? (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)", fontWeight: 600 }}
            >
              {a.name}
            </a>
          ) : (
            <strong key={a.id}>{a.name}</strong>
          ),
          a.note,
        ])}
      />

      <SectionTable
        title="Следующие шаги"
        headers={["Шаг", "Кто"]}
        rows={(analysis.nextSteps || []).map((n) => [
          n.text,
          OWNER_LABELS[n.owner] || n.owner,
        ])}
      />

      {analysis.error && (
        <p style={{ margin: "8px 0 0", fontSize: "0.7rem", color: "var(--ink-muted)" }}>
          Примечание: {analysis.error}
        </p>
      )}
      {error && (
        <p style={{ margin: "8px 0 0", fontSize: "var(--text-sm)", color: "var(--red)" }}>{error}</p>
      )}
    </div>
  );
}
