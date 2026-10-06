import Link from "next/link";
import type { CSSProperties } from "react";
import { db } from "@/lib/db";
import { hideVacancy, markApplied, restoreVacancy } from "@/lib/radar/actions";
import { formatSalary } from "@/lib/radar/money";
import { ensureRadarProfile } from "@/lib/radar/profile";
import { hideReasonLabel, responsesLabel } from "@/lib/radar/responses";
import { asTrack, TRACK_LABEL, type RadarTrack } from "@/lib/radar/tracks";
import { freshness } from "@/lib/radar/time";

export default async function RadarFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; track?: string }>;
}) {
  const { view, track: trackParam } = await searchParams;
  const hidden = view === "hidden";
  const applied = view === "applied";
  const track: RadarTrack | null =
    trackParam === "cards" || trackParam === "tilda" || trackParam === "ai" ? trackParam : null;
  const profile = await ensureRadarProfile();
  const rows = await db.jobVacancy.findMany({
    where: {
      status: hidden ? "hidden" : applied ? "applied" : { notIn: ["hidden", "applied"] },
      ...(track ? { track } : {}),
    },
    orderBy: { firstSeenAt: "desc" },
    take: 80,
  });
  const viewQuery = hidden ? "hidden" : applied ? "applied" : "";

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: "var(--text-sm)" }}>
        <Link href={feedHref("", track)} style={tabStyle(!hidden && !applied)}>
          В ленте
        </Link>
        <Link href={feedHref("applied", track)} style={tabStyle(applied)}>
          Откликнулся
        </Link>
        <Link href={feedHref("hidden", track)} style={tabStyle(hidden)}>
          Скрытые
        </Link>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: "var(--text-sm)" }}>
        <Link href={feedHref(viewQuery, null)} style={tabStyle(track == null)}>
          Все потоки
        </Link>
        {(["cards", "tilda", "ai"] as const).map((id) => (
          <Link key={id} href={feedHref(viewQuery, id)} style={tabStyle(track === id)}>
            {TRACK_LABEL[id]}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24 }}>
          <p style={{ margin: 0, fontWeight: 650, color: "var(--ink-heading)" }}>
            {hidden ? "Скрытых вакансий нет" : applied ? "Откликов пока нет" : "В ленте пока пусто"}
          </p>
          {!hidden && !applied && (
            <p style={{ margin: "8px 0 0", color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
              {profile.enabled
                ? `В ленте только сегодняшние удалённые вакансии с числом откликов до 3. Зарплата на отбор не влияет. ${profile.lastCheckAt ? `Последний обход ничего подходящего не сохранил.` : "Первый обход можно запустить в настройках."}`
                : "Сбор выключен. Включите его в настройках."}
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => {
            const fresh = freshness(row.publishedAt, row.firstSeenAt);
            return (
              <article
                key={row.id}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px 18px",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                  <Link href={`/dashboard/radar/${row.id}`} style={{ color: "var(--ink-heading)", fontWeight: 700, fontSize: "var(--text-base)" }}>
                    <span style={{ color: "var(--accent)", fontWeight: 650, fontSize: "var(--text-xs)", marginRight: 8 }}>
                      {TRACK_LABEL[asTrack(row.track)]}
                    </span>
                    {row.title}
                  </Link>
                  <span style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>
                    {fresh.label}
                    {responsesLabel(row.responsesCount) ? ` · ${responsesLabel(row.responsesCount)}` : ""}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-body)" }}>
                  {row.company || "Компания не указана"}
                  {row.remote ? " · удалённо" : ""}
                  {row.employment ? ` · ${row.employment}` : ""}
                </p>
                <p style={{ margin: 0, fontSize: "var(--text-sm)" }}>
                  {formatSalary(row.salaryFrom, row.salaryTo, row.salaryCurrency, row.salaryGross)}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <Score label="Совпадение" value={row.matchScore} />
                  <Score label="Надёжность" value={row.trustScore} />
                  {row.fitReasons.slice(0, 4).map((reason) => (
                    <span key={reason} style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                      {reason}
                    </span>
                  ))}
                </div>
                {hidden && hideReasonLabel(row.hideReason) && (
                  <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                    Скрыто: {hideReasonLabel(row.hideReason)}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a href={row.url} target="_blank" rel="noreferrer" style={linkButton}>
                    Открыть
                  </a>
                  {!hidden && !applied && (
                    <form action={markApplied}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" style={quietButton}>Откликнулся</button>
                    </form>
                  )}
                  {(hidden || applied) && (
                    <form action={restoreVacancy}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" style={quietButton}>Вернуть</button>
                    </form>
                  )}
                  {!hidden && !applied && (
                    <form action={hideVacancy} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" name="reason" value="role" style={quietButton}>Не та роль</button>
                      <button type="submit" name="reason" value="pay" style={quietButton}>Мало денег</button>
                      <button type="submit" name="reason" value="seen" style={quietButton}>Уже смотрел</button>
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function feedHref(view: string, track: RadarTrack | null): string {
  const params = new URLSearchParams();
  if (view) params.set("view", view);
  if (track) params.set("track", track);
  const query = params.toString();
  return query ? `/dashboard/radar?${query}` : "/dashboard/radar";
}

function tabStyle(active: boolean): CSSProperties {
  return { fontWeight: active ? 700 : 500, color: active ? "var(--ink-heading)" : "var(--ink-muted)" };
}

function Score({ label, value }: { label: string; value: number | null }) {
  const n = value ?? 0;
  const color = n >= 85 ? "var(--green)" : n >= 70 ? "var(--blue)" : n >= 40 ? "var(--amber)" : "var(--ink-muted)";
  return (
    <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color }}>
      {label} {value == null ? "—" : `${value}/100`}
    </span>
  );
}

const linkButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  background: "var(--accent)",
  color: "#fff",
  borderRadius: "var(--radius-sm)",
  padding: "8px 12px",
  fontSize: "var(--text-sm)",
  fontWeight: 650,
  textDecoration: "none",
};

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
