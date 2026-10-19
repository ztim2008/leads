"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import ResultDashboard from "@/components/diagnost/result-dashboard";
import StartForm from "@/components/diagnost/start-form";
import type { AuditView as View } from "@/lib/diagnost/data";
import { STAGES, initialStages, type StageState } from "@/lib/diagnost/stages";

const STATE_LABELS: Record<StageState, string> = {
  waiting: "Ожидает",
  processing: "Идёт",
  completed: "Готово",
  warning: "Внимание",
  error: "Ошибка",
};

const STATE_COLORS: Record<StageState, string> = {
  waiting: "var(--dg-muted)",
  processing: "var(--dg-accent)",
  completed: "var(--dg-excellent)",
  warning: "var(--dg-fair)",
  error: "var(--dg-critical)",
};

function StageIcon({ state }: { state: StageState }) {
  const color = STATE_COLORS[state];
  if (state === "processing") return <Loader2 size={18} className="dg-spin" style={{ color }} />;
  if (state === "completed") return <CheckCircle2 size={18} style={{ color }} />;
  if (state === "warning") return <AlertTriangle size={18} style={{ color }} />;
  if (state === "error") return <XCircle size={18} style={{ color }} />;
  return <Circle size={18} style={{ color, opacity: 0.5 }} />;
}

function Ring({ value }: { value: number }) {
  const r = 78;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 200 200" width={220} height={220} role="img" aria-label={`Прогресс ${value}%`}>
      <circle cx={100} cy={100} r={r} stroke="var(--dg-line)" strokeWidth={10} fill="none" />
      <circle
        cx={100}
        cy={100}
        r={r}
        stroke="var(--dg-accent)"
        strokeWidth={10}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
        transform="rotate(-90 100 100)"
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
      <text x={100} y={106} textAnchor="middle" fontSize="40" fontWeight="800" fill="var(--dg-ink)" style={{ fontFamily: "var(--font-montserrat)" }}>
        {value}%
      </text>
      <text x={100} y={130} textAnchor="middle" fontSize="10" fill="var(--dg-muted)" letterSpacing="1.2">
        ДИАГНОСТИКА
      </text>
    </svg>
  );
}

/** Пока воркер на этапе, кольцо плавно «доезжает» внутри этапа, а не стоит на месте */
function DriftRing({ base }: { base: number }) {
  const [shown, setShown] = useState(base);
  useEffect(() => {
    const ceiling = Math.min(99, base + Math.round(100 / STAGES.length) - 1);
    const timer = setInterval(() => setShown((current) => (current < ceiling ? current + 1 : current)), 900);
    return () => clearInterval(timer);
  }, [base]);
  return <Ring value={shown} />;
}

function ProgressScreen({ view }: { view: View }) {
  const rows = view.stages || initialStages();
  const active = rows.find((row) => row.state === "processing");
  const activeMeta = STAGES.find((stage) => stage.id === active?.id);
  const failed = view.status === "failed";

  return (
    <main className="mx-auto grid max-w-[1100px] gap-10 px-5 pt-6 md:px-8 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="flex flex-col items-center text-center lg:sticky lg:top-8 lg:self-start">
        <div className="dg-mono mb-6 max-w-full truncate text-xs" style={{ color: "var(--dg-accent)" }}>
          {view.url}
        </div>
        {view.status === "running" ? <DriftRing key={view.progress} base={view.progress} /> : <Ring value={view.progress} />}
        <h1 className="mt-6 text-[22px] font-bold">{failed ? "Проверка не завершилась" : view.status === "queued" ? "Ставим в очередь…" : "Анализируем сайт…"}</h1>
        <p className="mt-2 max-w-[320px] text-sm leading-relaxed" style={{ color: failed ? "var(--dg-critical)" : "var(--dg-body)" }}>
          {failed
            ? view.error || "Что-то пошло не так"
            : view.status === "queued"
              ? view.queueAhead > 0
                ? `Перед вами проверок: ${view.queueAhead}. Обычно это меньше минуты на каждую.`
                : "Через пару секунд начнём."
              : activeMeta?.hint || "Проходим по каждому слою страницы: от сервера до аналитики."}
        </p>
        {failed && (
          <div className="mt-8 w-full max-w-[420px] text-left">
            <StartForm initialUrl={view.url} compact />
          </div>
        )}
      </section>

      <section className="dg-panel overflow-hidden" aria-live="polite">
        <ol>
          {STAGES.map((stage) => {
            const row = rows.find((item) => item.id === stage.id) || { state: "waiting" as StageState, note: null };
            return (
              <li key={stage.id} data-state={row.state} className="dg-stage flex items-start gap-3.5 border-b px-5 py-3.5 last:border-b-0" style={{ borderColor: "var(--dg-line-soft)" }}>
                <span className="mt-0.5 flex-none">
                  <StageIcon state={row.state} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium" style={{ color: row.state === "waiting" ? "var(--dg-muted)" : "var(--dg-ink)" }}>
                    {stage.label}
                  </div>
                  <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--dg-muted)" }}>
                    {row.note || stage.hint}
                  </div>
                </div>
                <span className="mt-0.5 flex-none text-xs font-medium" style={{ color: STATE_COLORS[row.state] }}>
                  {STATE_LABELS[row.state]}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}

export default function AuditView({ initial }: { initial: View }) {
  const [view, setView] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (view.status === "done" || view.status === "failed") return;
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/diagnost/${view.slug}`, { cache: "no-store" });
        if (response.ok) setView((await response.json()) as View);
        else setView((current) => ({ ...current }));
      } catch {
        setView((current) => ({ ...current }));
      }
    }, 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [view]);

  if (view.status === "done" && view.result) return <ResultDashboard view={view} />;
  return <ProgressScreen view={view} />;
}
