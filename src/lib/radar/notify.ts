import { formatSalary } from "./money";
import { responsesLabel } from "./responses";
import { TRACK_LABEL, type RadarTrack } from "./tracks";
import { freshness } from "./time";

export type RadarAlert = {
  id: string;
  title: string;
  company: string | null;
  url: string;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryCurrency: string | null;
  salaryGross: boolean | null;
  remote: boolean;
  employment: string | null;
  publishedAt: Date | null;
  firstSeenAt: Date;
  matchScore: number;
  trustScore: number;
  fitReasons: string[];
  responsesCount?: number | null;
  track?: RadarTrack;
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatRadarTelegram(alert: RadarAlert, now = new Date()): string {
  const fresh = freshness(alert.publishedAt, alert.firstSeenAt, now);
  const head = fresh.hot ? "🔥 НОВАЯ ВАКАНСИЯ" : "Вакансия";
  const lines = [
    TRACK_LABEL[alert.track || "cards"],
    head,
    "",
    `<b>${escapeHtml(alert.title)}</b>`,
    escapeHtml(alert.company || "Компания не указана"),
    "",
    `💰 ${escapeHtml(formatSalary(alert.salaryFrom, alert.salaryTo, alert.salaryCurrency, alert.salaryGross))}`,
  ];
  if (alert.remote) lines.push("🌎 Удалённо");
  if (alert.employment) lines.push(`📅 ${escapeHtml(alert.employment)}`);
  lines.push("");
  const replies = responsesLabel(alert.responsesCount);
  lines.push(`Появилась: ${escapeHtml(fresh.label)}${replies ? ` · ${escapeHtml(replies)}` : ""}`);
  lines.push("");
  lines.push(`Совпадение: ${alert.matchScore}/100`);
  lines.push(`Надёжность: ${alert.trustScore}/100`);
  if (alert.fitReasons.length) {
    lines.push("");
    lines.push("Почему подходит:");
    lines.push(escapeHtml(alert.fitReasons.slice(0, 6).join(" + ")));
  }
  return lines.join("\n");
}

export type TgButton = { text: string; url?: string; callback_data?: string };

export function radarKeyboard(alert: RadarAlert): { inline_keyboard: TgButton[][] } {
  return {
    inline_keyboard: [
      [
        { text: "Открыть", url: alert.url },
        { text: "Отклик", callback_data: `reply:${alert.id}` },
      ],
      [
        { text: "Скрыть", callback_data: `hide:${alert.id}` },
        { text: "Откликнулся", callback_data: `applied:${alert.id}` },
      ],
    ],
  };
}

export function hideReasonKeyboard(id: string): { inline_keyboard: TgButton[][] } {
  return {
    inline_keyboard: [
      [
        { text: "Не та роль", callback_data: `hide:role:${id}` },
        { text: "Мало денег", callback_data: `hide:pay:${id}` },
      ],
      [
        { text: "Уже смотрел", callback_data: `hide:seen:${id}` },
        { text: "Назад", callback_data: `hide:back:${id}` },
      ],
    ],
  };
}

export function formatRadarDigest(alerts: RadarAlert[], now = new Date()): string {
  const lines = ["Утренний разбор", ""];
  alerts.forEach((alert, index) => {
    const fresh = freshness(alert.publishedAt, alert.firstSeenAt, now);
    const replies = responsesLabel(alert.responsesCount);
    const track = TRACK_LABEL[alert.track || "cards"];
    lines.push(`<b>${index + 1}. ${escapeHtml(track)} · ${escapeHtml(alert.title)}</b>`);
    lines.push(escapeHtml(alert.company || "Компания не указана"));
    lines.push(`💰 ${escapeHtml(formatSalary(alert.salaryFrom, alert.salaryTo, alert.salaryCurrency, alert.salaryGross))}`);
    lines.push(`${escapeHtml(fresh.label)}${replies ? ` · ${escapeHtml(replies)}` : ""}`);
    lines.push(`Совпадение ${alert.matchScore} · надёжность ${alert.trustScore}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

export function digestKeyboard(alerts: RadarAlert[]): { inline_keyboard: TgButton[][] } {
  return {
    inline_keyboard: alerts.map((alert, index) => [
      { text: `${index + 1} · Открыть`, url: alert.url },
      { text: `${index + 1} · Отклик`, callback_data: `reply:${alert.id}` },
    ]),
  };
}
