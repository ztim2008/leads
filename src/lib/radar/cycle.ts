import { db } from "@/lib/db";
import { loadHubEnv } from "@/lib/telegram/bot-token";
import { refineMatchScore, radarApiKey } from "./ai";
import { isVideoVacancy, passesHardFilter } from "./filter";
import { fetchEmployerVacancyCount, fetchHhVacancy, searchHh } from "./hh";
import { searchRabota } from "./rabota";
import { searchTrudvsem } from "./trudvsem";
import { scoreMatch } from "./match";
import { resolveRadarDelivery } from "./delivery";
import { digestKeyboard, formatRadarDigest, formatRadarTelegram, radarKeyboard, type RadarAlert } from "./notify";
import { canPushVacancy, digestSince, fewResponses, publishedToday, shouldSendDigest } from "./responses";
import { ensureRadarProfile } from "./profile";
import { allocatePushSlots, asTrack, DEFAULT_AI_QUERIES, trackTerms, type RadarTrack } from "./tracks";
import { freshness, hhTimestamp, inQuietHours, startOfMskDay } from "./time";
import { buildTrustChecks, trustScore } from "./trust";

const AI_CAP_PER_CYCLE = 6;

type RadarProfileRow = Awaited<ReturnType<typeof ensureRadarProfile>>;

type SaveVacancyInput = {
  source: string;
  track: RadarTrack;
  externalId: string;
  title: string;
  company: string | null;
  companyUrl: string | null;
  url: string;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryCurrency: string | null;
  salaryGross: boolean | null;
  area: string | null;
  remote: boolean;
  employment: string | null;
  description: string;
  publishedAt: Date | null;
  trusted: boolean | null;
  employerVacancyCount: number | null;
  responsesCount: number | null;
};

async function saveVacancy(profile: RadarProfileRow, input: SaveVacancyInput, ai: { left: number; key: string | null }): Promise<boolean> {
  const decision = passesHardFilter(
    {
      title: input.title,
      description: input.description,
      salaryFrom: input.salaryFrom,
      salaryTo: input.salaryTo,
      salaryCurrency: input.salaryCurrency,
      remote: input.remote,
    },
    profile,
    input.track,
  );
  if (!decision.ok) return false;

  const checks = buildTrustChecks({
    company: input.company,
    employerTrusted: input.trusted,
    employerVacancyCount: input.employerVacancyCount,
    publishedAt: input.publishedAt,
    salaryFrom: input.salaryFrom,
    salaryTo: input.salaryTo,
    description: input.description,
  });
  const rules = scoreMatch({
    title: input.title,
    description: input.description,
    remote: input.remote,
    employment: input.employment,
    salaryFrom: input.salaryFrom,
    salaryTo: input.salaryTo,
    salaryCurrency: input.salaryCurrency,
    directions: [...profile.directions, ...trackTerms(input.track)],
    skills: profile.skills,
    salaryMin: profile.salaryMin,
    roleBonus: input.track !== "cards",
  });

  let match = rules.score;
  let why = rules.reasons.slice(0, 6).join(" + ");
  if (ai.key && rules.score >= 70 && ai.left > 0) {
    ai.left -= 1;
    try {
      const refined = await refineMatchScore({
        apiKey: ai.key,
        specialization: profile.specialization,
        about: profile.about,
        directions: profile.directions,
        skills: profile.skills,
        exclusions: profile.exclusions,
        salaryMin: profile.salaryMin,
        title: input.title,
        company: input.company,
        description: input.description,
      });
      if (refined) {
        match = refined.score;
        why = refined.why;
      }
    } catch (e) {
      console.error("[hh-radar] ai", e instanceof Error ? e.message : e);
    }
  }

  await db.jobVacancy.create({
    data: {
      source: input.source,
      track: input.track,
      externalId: input.externalId,
      title: input.title.slice(0, 300),
      company: input.company,
      companyUrl: input.companyUrl,
      url: input.url,
      salaryFrom: input.salaryFrom,
      salaryTo: input.salaryTo,
      salaryCurrency: input.salaryCurrency,
      salaryGross: input.salaryGross,
      area: input.area,
      remote: input.remote,
      employment: input.employment,
      description: input.description.slice(0, 12000),
      publishedAt: input.publishedAt,
      employerTrusted: input.trusted,
      employerVacancyCount: input.employerVacancyCount,
      responsesCount: input.responsesCount,
      matchScore: match,
      trustScore: trustScore(checks),
      trustChecks: JSON.parse(JSON.stringify(checks)),
      fitReasons: rules.reasons.slice(0, 8),
      whyFit: why,
      status: "new",
    },
  });
  return true;
}

export type RadarCycleResult = {
  scanned: number;
  fresh: number;
  saved: number;
  notified: number;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dropStaleAndVideo(): Promise<void> {
  const start = startOfMskDay();
  await db.jobVacancy.deleteMany({
    where: { OR: [{ publishedAt: null }, { publishedAt: { lt: start } }, { responsesCount: { gt: 3 } }] },
  });
  const ai = await db.jobVacancy.findMany({ where: { track: "ai" }, select: { id: true, title: true } });
  const videoIds = ai.filter((row) => isVideoVacancy(row.title)).map((row) => row.id);
  if (videoIds.length) await db.jobVacancy.deleteMany({ where: { id: { in: videoIds } } });
}

export async function runRadarCycle(): Promise<RadarCycleResult> {
  loadHubEnv();
  const profile = await ensureRadarProfile();
  if (!profile.enabled) return { scanned: 0, fresh: 0, saved: 0, notified: 0 };
  await dropStaleAndVideo();
  if (profile.aiQueries.some((query) => /видео|монтаж|video/i.test(query))) {
    await db.jobRadarProfile.update({ where: { id: profile.id }, data: { aiQueries: DEFAULT_AI_QUERIES } });
    profile.aiQueries = DEFAULT_AI_QUERIES;
  }

  let scanned = 0;
  let saved = 0;
  let considered = 0;
  let error: string | undefined;
  const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
  const ai = { left: AI_CAP_PER_CYCLE, key: radarApiKey() };
  let trudError: string | undefined;
  let rabotaError: string | undefined;

  try {
    const since = hhTimestamp(new Date(Date.now() - 6 * 60 * 60 * 1000));
    const streams: { track: RadarTrack; queries: string[] }[] = [
      { track: "cards", queries: profile.searchQueries },
      { track: "web", queries: profile.webQueries },
      { track: "tilda", queries: profile.tildaQueries },
      { track: "ai", queries: profile.aiQueries },
    ];
    for (const stream of streams) {
    for (const query of stream.queries) {
      const text = query.trim();
      if (!text) continue;
      const params = new URLSearchParams({
        text,
        order_by: "publication_time",
        per_page: "15",
        date_from: since,
        area: "113", // вся Россия, без города
        currency: "RUR",
        search_field: "name",
        search_period: "1",
      });
      if (profile.remoteOnly) params.set("schedule", "remote");
      // Зарплату режем локально: HH по нижней границе прячет вилку 60–100 при пороге 70.
      const hits = await searchHh(params);
      scanned += hits.length;
      for (const hit of hits) {
        const exists = await db.jobVacancy.findUnique({
          where: { source_externalId: { source: "hh", externalId: hit.id } },
          select: { id: true },
        });
        const publishedAtHit = hit.publishedAt ? new Date(hit.publishedAt) : null;
        if (!publishedToday(publishedAtHit) || !fewResponses(hit.responsesCount)) {
          if (exists && ((hit.responsesCount != null && hit.responsesCount > 3) || !publishedToday(publishedAtHit))) {
            await db.jobVacancy.delete({ where: { id: exists.id } });
          }
          continue;
        }
        if (exists) {
          if (hit.responsesCount != null) {
            await db.jobVacancy.update({
              where: { id: exists.id },
              data: { responsesCount: hit.responsesCount },
            });
          }
          continue;
        }
        const createdMs = publishedAtHit ? publishedAtHit.getTime() : 0;
        if (!createdMs || Date.now() - createdMs > maxAgeMs) continue;
        considered += 1;
        const preview = passesHardFilter(
          {
            title: hit.title,
            description: hit.title,
            salaryFrom: hit.salaryFrom,
            salaryTo: hit.salaryTo,
            salaryCurrency: hit.salaryCurrency,
            remote: hit.remote,
          },
          profile,
          stream.track,
        );
        if (!preview.ok && preview.reason !== "нет совпадения с профилем") continue;

        await sleep(800);
        let description = hit.snippet;
        let remote = hit.remote;
        let employment = hit.employment;
        let trusted: boolean | null = hit.trusted;
        try {
          const detail = await fetchHhVacancy(hit.id);
          if (detail) {
            if (detail.description) description = detail.description;
            remote = detail.remote || remote;
            employment = detail.employment || employment;
            if (detail.trusted != null) trusted = detail.trusted;
            if (detail.keySkills.length) description += `\nНавыки: ${detail.keySkills.join(", ")}`;
          }
        } catch (e) {
          console.error("[hh-radar] detail", hit.id, e instanceof Error ? e.message : e);
        }

        let employerVacancyCount: number | null = null;
        if (hit.employerId) employerVacancyCount = await fetchEmployerVacancyCount(hit.employerId);
        const created = await saveVacancy(
          profile,
          {
            source: "hh",
            track: stream.track,
            externalId: hit.id,
            title: hit.title,
            company: hit.company,
            companyUrl: hit.companyUrl,
            url: hit.url,
            salaryFrom: hit.salaryFrom,
            salaryTo: hit.salaryTo,
            salaryCurrency: hit.salaryCurrency,
            salaryGross: hit.salaryGross,
            area: hit.area,
            remote,
            employment,
            description,
            publishedAt: publishedAtHit,
            trusted,
            employerVacancyCount,
            responsesCount: hit.responsesCount,
          },
          ai,
        );
        if (created) saved += 1;
      }
    }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.error("[hh-radar]", error);
  }

  try {
    const streams: { track: RadarTrack; queries: string[] }[] = [
      { track: "cards", queries: profile.searchQueries },
      { track: "web", queries: profile.webQueries },
      { track: "tilda", queries: profile.tildaQueries },
      { track: "ai", queries: profile.aiQueries },
    ];
    for (const stream of streams) {
      for (const query of stream.queries) {
        const text = query.trim();
        if (!text) continue;
        let hits;
        try {
          hits = await searchTrudvsem(text);
        } catch (e) {
          trudError = e instanceof Error ? e.message : String(e);
          console.error("[hh-radar] trudvsem", text, trudError);
          continue;
        }
        scanned += hits.length;
        for (const hit of hits) {
          if (profile.remoteOnly && !hit.remote) continue;
          const exists = await db.jobVacancy.findUnique({
            where: { source_externalId: { source: "trudvsem", externalId: hit.id } },
            select: { id: true },
          });
          if (exists || !publishedToday(hit.publishedAt) || !fewResponses(null)) continue;
          considered += 1;
          try {
            const created = await saveVacancy(
            profile,
            {
              source: "trudvsem",
              track: stream.track,
              externalId: hit.id,
              title: hit.title,
              company: hit.company,
              companyUrl: hit.companyUrl,
              url: hit.url,
              salaryFrom: hit.salaryFrom,
              salaryTo: hit.salaryTo,
              salaryCurrency: hit.salaryCurrency,
              salaryGross: null,
              area: hit.area,
              remote: hit.remote,
              employment: hit.employment,
              description: hit.description || hit.title,
              publishedAt: hit.publishedAt,
              trusted: null,
              employerVacancyCount: null,
              responsesCount: null,
            },
            ai,
          );
            if (created) saved += 1;
          } catch (e) {
            console.error("[hh-radar] trudvsem save", hit.id, e instanceof Error ? e.message : e);
          }
        }
      }
    }
  } catch (e) {
    trudError = e instanceof Error ? e.message : String(e);
    console.error("[hh-radar] trudvsem", trudError);
  }

  try {
    const streams: { track: RadarTrack; queries: string[] }[] = [
      { track: "cards", queries: profile.searchQueries },
      { track: "web", queries: profile.webQueries },
      { track: "tilda", queries: profile.tildaQueries },
      { track: "ai", queries: profile.aiQueries },
    ];
    let stopRabota = false;
    for (const stream of streams) {
      if (stopRabota) break;
      for (const query of stream.queries) {
        const text = query.trim();
        if (!text) continue;
        let hits;
        try {
          hits = await searchRabota(text, profile.remoteOnly);
        } catch (e) {
          rabotaError = e instanceof Error ? e.message : String(e);
          console.error("[hh-radar] rabota", text, rabotaError);
          if (rabotaError.includes("нет токена")) stopRabota = true;
          if (stopRabota) break;
          continue;
        }
        scanned += hits.length;
        for (const hit of hits) {
          if (profile.remoteOnly && !hit.remote) continue;
          const exists = await db.jobVacancy.findUnique({
            where: { source_externalId: { source: "rabota", externalId: hit.id } },
            select: { id: true },
          });
          if (exists || !publishedToday(hit.publishedAt) || !fewResponses(null)) continue;
          considered += 1;
          try {
            const created = await saveVacancy(
              profile,
              {
                source: "rabota",
                track: stream.track,
                externalId: hit.id,
                title: hit.title,
                company: hit.company,
                companyUrl: hit.companyUrl,
                url: hit.url,
                salaryFrom: hit.salaryFrom,
                salaryTo: hit.salaryTo,
                salaryCurrency: hit.salaryCurrency,
                salaryGross: null,
                area: hit.area,
                remote: hit.remote,
                employment: hit.employment,
                description: hit.description || hit.title,
                publishedAt: hit.publishedAt,
                trusted: null,
                employerVacancyCount: null,
                responsesCount: null,
              },
              ai,
            );
            if (created) saved += 1;
          } catch (e) {
            console.error("[hh-radar] rabota save", hit.id, e instanceof Error ? e.message : e);
          }
        }
      }
    }
  } catch (e) {
    rabotaError = e instanceof Error ? e.message : String(e);
    console.error("[hh-radar] rabota", rabotaError);
  }

  const digested = await sendMorningDigest(profile);
  const notified = error ? digested : digested + (await notifyPending(profile));
  await db.jobRadarProfile.update({
    where: { id: profile.id },
    data: {
      lastCheckAt: new Date(),
      lastError: [error, trudError, rabotaError].filter(Boolean).join("; ") || null,
      lastNewCount: saved,
    },
  });
  const reported = [error, trudError, rabotaError].filter(Boolean).join("; ") || undefined;
  return { scanned, fresh: considered, saved, notified, error: reported };
}

async function sendMorningDigest(profile: Awaited<ReturnType<typeof ensureRadarProfile>>): Promise<number> {
  if (!profile.alertsEnabled || !shouldSendDigest(new Date(), profile.lastDigestAt)) return 0;
  const delivery = await resolveRadarDelivery(profile.telegramChatId);
  if (!delivery) return 0;
  const since = digestSince(new Date(), profile.quietStart);
  const rows = await db.jobVacancy.findMany({
    where: {
      status: { in: ["new", "opened"] },
      notifiedAt: null,
      firstSeenAt: { gte: since },
    },
    orderBy: [{ matchScore: "desc" }, { firstSeenAt: "desc" }],
    take: 12,
  });
  const picked = rows
    .filter((row) => {
      const fresh = freshness(row.publishedAt, row.firstSeenAt);
      return !(fresh.hot && fewResponses(row.responsesCount));
    })
    .slice(0, 3);
  if (!picked.length) return 0;
  const alerts = picked.map(toAlert);
  const ok = await sendText(delivery.token, delivery.chat, formatRadarDigest(alerts), digestKeyboard(alerts));
  if (!ok) return 0;
  await db.jobVacancy.updateMany({
    where: { id: { in: picked.map((row) => row.id) } },
    data: { notifiedAt: new Date() },
  });
  await db.jobRadarProfile.update({ where: { id: profile.id }, data: { lastDigestAt: new Date() } });
  return picked.length;
}

async function notifyPending(profile: Awaited<ReturnType<typeof ensureRadarProfile>>): Promise<number> {
  if (!profile.alertsEnabled) return 0;
  if (inQuietHours(profile.quietStart, profile.quietEnd)) return 0;

  const sentRows = await db.jobVacancy.groupBy({
    by: ["track"],
    where: { notifiedAt: { gte: startOfMskDay() } },
    _count: true,
  });
  const sentToday = sentRows.reduce((sum, row) => sum + row._count, 0);
  const room = Math.max(0, profile.dailyAlertCap - sentToday);
  if (!room) return 0;
  const already: Record<RadarTrack, number> = { cards: 0, tilda: 0, ai: 0, web: 0 };
  for (const row of sentRows) already[asTrack(row.track)] += row._count;

  const delivery = await resolveRadarDelivery(profile.telegramChatId);
  if (!delivery) return 0;
  const { token, chat } = delivery;

  const pending = await db.jobVacancy.findMany({
    where: {
      status: "new",
      notifiedAt: null,
    },
    orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
    take: 80,
  });
  const ready = pending.filter((row) =>
    canPushVacancy({
      publishedAt: row.publishedAt,
      firstSeenAt: row.firstSeenAt,
      responsesCount: row.responsesCount,
      salaryFrom: row.salaryFrom,
      salaryTo: row.salaryTo,
    }),
  );
  const picked = allocatePushSlots(
    ready.map((row) => ({ ...row, track: asTrack(row.track) })),
    room,
    already,
  );

  let sent = 0;
  for (const row of picked) {
    const alert = toAlert(row);
    const ok = await sendRadarAlert(token, chat, alert);
    if (!ok) continue;
    await db.jobVacancy.update({ where: { id: row.id }, data: { notifiedAt: new Date() } });
    sent += 1;
  }
  return sent;
}

function toAlert(row: {
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
  matchScore: number | null;
  trustScore: number | null;
  fitReasons: string[];
  responsesCount: number | null;
  track: string;
  source: string;
}): RadarAlert {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    url: row.url,
    salaryFrom: row.salaryFrom,
    salaryTo: row.salaryTo,
    salaryCurrency: row.salaryCurrency,
    salaryGross: row.salaryGross,
    remote: row.remote,
    employment: row.employment,
    publishedAt: row.publishedAt,
    firstSeenAt: row.firstSeenAt,
    matchScore: row.matchScore || 0,
    trustScore: row.trustScore || 0,
    fitReasons: row.fitReasons,
    responsesCount: row.responsesCount,
    track: asTrack(row.track),
    source: row.source,
  };
}

async function sendText(
  token: string,
  chatId: string,
  text: string,
  replyMarkup: { inline_keyboard: unknown[][] },
): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await response.json()) as { ok?: boolean };
    return data.ok === true;
  } catch (e) {
    console.error("[hh-radar] telegram", e instanceof Error ? e.message : e);
    return false;
  }
}

async function sendRadarAlert(token: string, chatId: string, alert: RadarAlert): Promise<boolean> {
  return sendText(token, chatId, formatRadarTelegram(alert), radarKeyboard(alert));
}
