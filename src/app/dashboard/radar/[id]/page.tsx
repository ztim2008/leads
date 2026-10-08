import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import ReplyBox from "@/components/radar/reply-box";
import { db } from "@/lib/db";
import { hideVacancy, markApplied } from "@/lib/radar/actions";
import { formatSalary } from "@/lib/radar/money";
import { responsesLabel } from "@/lib/radar/responses";
import { asTrack, TRACK_LABEL } from "@/lib/radar/tracks";
import { sourceLabel } from "@/lib/radar/sources";
import { freshness } from "@/lib/radar/time";
import type { TrustCheck } from "@/lib/radar/trust";

export default async function RadarVacancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vacancy = await db.jobVacancy.findUnique({ where: { id } });
  if (!vacancy) notFound();
  if (vacancy.status === "new") {
    await db.jobVacancy.update({ where: { id }, data: { status: "opened" } });
  }

  const fresh = freshness(vacancy.publishedAt, vacancy.firstSeenAt);
  const checks = Array.isArray(vacancy.trustChecks) ? (vacancy.trustChecks as TrustCheck[]) : [];

  return (
    <article style={{ display: "grid", gap: 18, maxWidth: 760 }}>
      <Link href="/dashboard/radar" style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
        К ленте
      </Link>
      <header style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: 0, color: "var(--accent)", fontSize: "var(--text-sm)", fontWeight: 650 }}>
          {sourceLabel(vacancy.source)} · {TRACK_LABEL[asTrack(vacancy.track)]}
        </p>
        <h2 style={{ margin: 0, fontSize: "var(--text-xl)" }}>{vacancy.title}</h2>
        <p style={{ margin: 0, color: "var(--ink-body)" }}>
          {vacancy.company || "Компания не указана"}
          {vacancy.remote ? " · удалённо" : ""}
          {vacancy.area ? ` · ${vacancy.area}` : ""}
        </p>
        <p style={{ margin: 0 }}>
          {formatSalary(vacancy.salaryFrom, vacancy.salaryTo, vacancy.salaryCurrency, vacancy.salaryGross)}
          {vacancy.employment ? ` · ${vacancy.employment}` : ""}
        </p>
        <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
          {fresh.label}
          {responsesLabel(vacancy.responsesCount) ? ` · ${responsesLabel(vacancy.responsesCount)}` : ""}
          {" · "}совпадение {vacancy.matchScore ?? "—"}/100 · надёжность {vacancy.trustScore ?? "—"}/100
        </p>
        {vacancy.status !== "applied" && vacancy.status !== "hidden" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <form action={markApplied}>
              <input type="hidden" name="id" value={vacancy.id} />
              <button type="submit" style={quietButton}>Откликнулся</button>
            </form>
            <form action={hideVacancy} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input type="hidden" name="id" value={vacancy.id} />
              <button type="submit" name="reason" value="role" style={quietButton}>Не та роль</button>
              <button type="submit" name="reason" value="pay" style={quietButton}>Мало денег</button>
              <button type="submit" name="reason" value="seen" style={quietButton}>Уже смотрел</button>
            </form>
          </div>
        )}
        {vacancy.whyFit && <p style={{ margin: 0 }}>{vacancy.whyFit}</p>}
        <a href={vacancy.url} target="_blank" rel="noreferrer" style={{ fontWeight: 650 }}>
          Открыть вакансию
        </a>
      </header>

      {checks.length > 0 && (
        <section>
          <h3 style={{ fontSize: "var(--text-base)", margin: "0 0 8px" }}>Надёжность</h3>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: "var(--text-sm)" }}>
            {checks.map((check) => (
              <li key={check.id} style={{ color: check.ok ? "var(--ink-body)" : "var(--ink-muted)" }}>
                {check.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 style={{ fontSize: "var(--text-base)", margin: "0 0 8px" }}>Описание</h3>
        <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "var(--text-sm)", lineHeight: 1.55 }}>{vacancy.description}</p>
      </section>

      <ReplyBox id={vacancy.id} initial={vacancy.replyDraft} />
    </article>
  );
}

const quietButton: CSSProperties = {
  background: "var(--bg-surface)",
  color: "var(--ink-body)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "8px 12px",
  fontSize: "var(--text-sm)",
  fontWeight: 650,
  cursor: "pointer",
};
