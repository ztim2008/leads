import { SLOT_LABELS, SLOT_ORDER, slotFinding, slotSummary, type PresentFinding } from "@/lib/briefs/present";

export default function BriefSlots({ findings }: { findings: PresentFinding[] }) {
  return (
    <div className="brief-slots">
      {SLOT_ORDER.map((slot) => {
        const finding = slotFinding(findings, slot);
        return (
          <article key={slot} className="brief-slot">
            <span className="brief-slot-label">{SLOT_LABELS[slot]}</span>
            <p>{finding ? slotSummary(finding, slot) : "Нет данных"}</p>
            {finding?.evidenceUrl ? (
              <a href={finding.evidenceUrl} target="_blank" rel="noreferrer">
                {shortPath(finding.evidenceUrl)}
              </a>
            ) : (
              <span />
            )}
          </article>
        );
      })}
    </div>
  );
}

function shortPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" ? parsed.hostname : `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
}
