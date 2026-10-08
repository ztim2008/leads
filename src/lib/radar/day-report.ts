import { pingHh } from "./hh";
import { pingRabota } from "./rabota";
import { sourceLabel } from "./sources";
import { pingTrudvsem } from "./trudvsem";

export type SourceProbe = { source: string; label: string; ok: boolean; detail: string };
export type SourceCount = { source: string; saved: number; pushed: number };

const ORDER = ["hh", "trudvsem", "rabota"] as const;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function sourceCounts(
  saved: { source: string; count: number }[],
  pushed: { source: string; count: number }[],
): SourceCount[] {
  return ORDER.map((source) => ({
    source,
    saved: saved.find((row) => row.source === source)?.count ?? 0,
    pushed: pushed.find((row) => row.source === source)?.count ?? 0,
  }));
}

function totals(counts: SourceCount[]): { saved: number; pushed: number; parts: string } {
  const saved = counts.reduce((sum, row) => sum + row.saved, 0);
  const pushed = counts.reduce((sum, row) => sum + row.pushed, 0);
  const parts = counts.map((row) => `${sourceLabel(row.source)} ${row.saved}`).join(" · ");
  return { saved, pushed, parts };
}

export function formatMorningReport(probes: SourceProbe[], counts: SourceCount[]): string {
  const { saved, pushed, parts } = totals(counts);
  const lines = ["Утро · Job Radar", ""];
  for (const probe of probes) {
    lines.push(`${probe.label}: ${probe.ok ? "отвечает" : escapeHtml(probe.detail)}`);
  }
  lines.push("");
  lines.push(`С полуночи в ленте: ${saved}`);
  lines.push(parts);
  lines.push(`В Telegram ушло: ${pushed}`);
  const failed = probes.filter((probe) => !probe.ok);
  lines.push("");
  lines.push(failed.length ? "Есть проблема с источником." : "Источники на связи.");
  return lines.join("\n");
}

export function formatEveningReport(counts: SourceCount[], deleted: number, problems: string[]): string {
  const { saved, pushed, parts } = totals(counts);
  const lines = [
    "Вечер · Job Radar",
    "",
    `За день в ленте: ${saved}`,
    parts,
    `В Telegram ушло: ${pushed}`,
    `Карточки в чате удалены: ${deleted}`,
    "",
    "Завтра чат начнёт день без вчерашних карточек.",
  ];
  const note = problems.map((item) => item.trim()).filter(Boolean).join("; ");
  if (note) {
    lines.push("");
    lines.push(`Сбор: ${escapeHtml(note.slice(0, 400))}`);
  }
  return lines.join("\n");
}

export async function probeRadarSources(): Promise<SourceProbe[]> {
  const checks: { source: string; run: () => Promise<void> }[] = [
    { source: "hh", run: pingHh },
    { source: "trudvsem", run: pingTrudvsem },
    { source: "rabota", run: pingRabota },
  ];
  const probes: SourceProbe[] = [];
  for (const check of checks) {
    try {
      await check.run();
      probes.push({ source: check.source, label: sourceLabel(check.source), ok: true, detail: "отвечает" });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      probes.push({ source: check.source, label: sourceLabel(check.source), ok: false, detail: detail.slice(0, 180) });
    }
  }
  return probes;
}
