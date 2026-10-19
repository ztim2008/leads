import { Lock } from "lucide-react";
import { CLOSED_CONTACT, CLOSED_MESSAGE } from "@/lib/diagnost/access";
import { LEVEL_LABELS, levelOf, VERDICT_LABELS } from "@/lib/diagnost/levels";
import type { Verdict } from "@/lib/diagnost/types";

export function ClosedNotice() {
  return (
    <p className="mt-3 flex items-start gap-2 text-sm" style={{ color: "var(--dg-body)" }} role="alert">
      <Lock size={16} className="mt-0.5 shrink-0" style={{ color: "var(--dg-muted)" }} />
      <span>
        {CLOSED_MESSAGE}{" "}
        <a href={CLOSED_CONTACT} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: "var(--dg-accent)" }}>
          t.me/bilarius
        </a>
      </span>
    </p>
  );
}

export function levelClass(score: number | null): string {
  return `dg-l-${score === null ? "none" : levelOf(score)}`;
}

export function LevelBadge({ score }: { score: number | null }) {
  return (
    <span className={`dg-badge ${levelClass(score)}`}>
      <span className="dg-dot" />
      {score === null ? "Недостаточно данных" : LEVEL_LABELS[levelOf(score)]}
    </span>
  );
}

const VERDICT_LEVEL: Record<Verdict, string> = { go: "dg-l-excellent", fix: "dg-l-fair", stop: "dg-l-critical" };

export function VerdictBadge({ verdict, text }: { verdict: Verdict; text?: string }) {
  return (
    <span className={`dg-badge ${VERDICT_LEVEL[verdict]}`}>
      <span className="dg-dot" />
      {text || VERDICT_LABELS[verdict]}
    </span>
  );
}

export function verdictClass(verdict: Verdict | string | null): string {
  return verdict && verdict in VERDICT_LEVEL ? VERDICT_LEVEL[verdict as Verdict] : "dg-l-none";
}

export function ScoreText({ score, suffix = "/100" }: { score: number | null; suffix?: string }) {
  return (
    <span className={levelClass(score)}>
      <span className="dg-mono text-[22px] font-semibold" style={{ color: "var(--dg-ink)" }}>
        {score === null ? "—" : score}
      </span>
      <span className="dg-mono text-xs" style={{ color: "var(--dg-muted)" }}>
        {score === null ? " нет данных" : suffix}
      </span>
    </span>
  );
}

export function Delta({ from, to, unit = "" }: { from: number | null; to: number | null; unit?: string }) {
  if (from === null || to === null) return null;
  const diff = to - from;
  const color = diff > 0 ? "var(--dg-excellent)" : diff < 0 ? "var(--dg-critical)" : "var(--dg-muted)";
  return (
    <span className="dg-mono text-sm" style={{ color }}>
      {diff > 0 ? "+" : ""}
      {diff}
      {unit}
    </span>
  );
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Moscow" }).format(new Date(iso));
}
