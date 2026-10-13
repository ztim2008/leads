import { db } from "@/lib/db";
import { factsFromPages, factsFromSiteFiles, readSite, readSiteFiles, type SiteFiles } from "@/lib/briefs/fetch-site";
import { interpretSite } from "@/lib/briefs/interpret";
import { collectWordstat, publicWordstatError, type WordstatPhrase, type WordstatRegion } from "@/lib/briefs/wordstat";

const MODEL = process.env.BRIEFS_MODEL || "deepseek/deepseek-chat";

async function resolveOpenRouterKey(): Promise<string> {
  const envKey = process.env.OPENROUTER_API_KEY?.trim();
  if (envKey) return envKey;
  const row = await db.settings.findFirst({
    where: { NOT: { openrouterKey: null } },
    select: { openrouterKey: true },
    orderBy: { updatedAt: "desc" },
  });
  return row?.openrouterKey?.trim() || "";
}

export async function processBriefRun(runId: string): Promise<void> {
  const run = await db.briefRun.findUnique({
    where: { id: runId },
    include: { project: true },
  });
  if (!run || run.status !== "running") return;

  try {
    const pages = await readSite(run.project.siteUrl);
    let files: SiteFiles | null = null;
    if (pages[0] && pages[0].status > 0 && pages[0].status < 400) {
      try {
        files = await readSiteFiles(pages[0].url);
      } catch (error) {
        console.error("[briefs] files", error instanceof Error ? error.message : error);
      }
    }
    const facts = [...factsFromPages(pages), ...(files ? factsFromSiteFiles(files) : [])];
    let model: string | null = null;
    let interpreted: Awaited<ReturnType<typeof interpretSite>> = [];
    const apiKey = await resolveOpenRouterKey();
    if (apiKey && pages[0] && pages[0].status > 0 && pages[0].status < 400) {
      try {
        interpreted = await interpretSite({
          apiKey,
          model: MODEL,
          niche: run.project.niche,
          regionName: run.project.regionName,
          goal: run.project.goal,
          pages,
        });
        model = MODEL;
      } catch (error) {
        interpreted = [];
        model = null;
        console.error("[briefs] model", error instanceof Error ? error.message : error);
      }
    }

    const semantics = await semanticsRows(run.project.niche, run.project.regionName);

    const rows = [
      ...facts.map((item, index) => ({
        projectId: run.projectId,
        runId: run.id,
        section: "site",
        kind: item.kind,
        title: item.title,
        body: item.body,
        evidenceUrl: item.evidenceUrl,
        evidenceQuote: item.evidenceQuote,
        sort: index,
      })),
      ...interpreted.map((item, index) => ({
        projectId: run.projectId,
        runId: run.id,
        section: "site",
        kind: item.kind,
        title: item.title,
        body: item.body,
        evidenceUrl: item.evidenceUrl,
        evidenceQuote: item.evidenceQuote,
        sort: facts.length + index,
      })),
      ...semantics,
    ].map((item) => ({ ...item, projectId: run.projectId, runId: run.id }));

    await db.$transaction([
      db.briefFinding.deleteMany({ where: { projectId: run.projectId, section: { in: ["site", "semantics"] } } }),
      db.briefFinding.createMany({ data: rows }),
      db.briefRun.update({
        where: { id: run.id },
        data: {
          status: "done",
          finishedAt: new Date(),
          error: null,
          pages: { model, pages, files },
        },
      }),
      db.briefProject.update({
        where: { id: run.projectId },
        data: { status: "ready" },
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Разбор не выполнился";
    await db.briefRun.update({
      where: { id: run.id },
      data: { status: "failed", error: message, finishedAt: new Date() },
    });
    await db.briefProject.update({
      where: { id: run.projectId },
      data: { status: "failed" },
    });
  }
}

export async function claimNextBriefRun(): Promise<string | null> {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  await db.briefRun.updateMany({
    where: { status: "running", startedAt: { lt: staleBefore } },
    data: { status: "failed", error: "Прогон прервался по времени", finishedAt: new Date() },
  });
  await db.briefProject.updateMany({
    where: {
      status: "running",
      runs: { none: { status: { in: ["queued", "running"] } } },
    },
    data: { status: "failed" },
  });

  const next = await db.briefRun.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    select: { id: true, projectId: true },
  });
  if (!next) return null;
  const claimed = await db.briefRun.updateMany({
    where: { id: next.id, status: "queued" },
    data: { status: "running", startedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  await db.briefProject.update({
    where: { id: next.projectId },
    data: { status: "running" },
  });
  return next.id;
}

function formatCount(count: number): string {
  return new Intl.NumberFormat("ru-RU").format(count);
}

async function semanticsRows(niche: string, regionName: string) {
  try {
    const collected = await collectWordstat({ niche, regionName });
    if (!collected) return [];
    return collected.phrases.map((phrase, index) => ({
      section: "semantics",
      kind: "fact",
      title: phrase.phrase,
      body: wordstatBody(phrase, collected.region),
      evidenceUrl: "https://wordstat.yandex.ru/",
      evidenceQuote: String(phrase.count),
      sort: index,
    }));
  } catch (error) {
    return [
      {
        section: "semantics",
        kind: "fact",
        title: "Wordstat недоступен",
        body: publicWordstatError(error),
        evidenceUrl: null,
        evidenceQuote: null,
        sort: 0,
      },
    ];
  }
}

function wordstatBody(phrase: WordstatPhrase, region: WordstatRegion): string {
  const scope = region.exact
    ? `Регион: ${region.label}.`
    : "Город в справочнике не найден, показана Россия.";
  return `${formatCount(phrase.count)} показов за 30 дней. ${scope} Источник: Wordstat.`;
}
