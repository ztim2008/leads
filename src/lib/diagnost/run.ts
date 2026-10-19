import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { aiAvailable, AI_MODEL, analyzeVision, writeSummary } from "@/lib/diagnost/ai";
import { detectBusiness, runChecks } from "@/lib/diagnost/checks";
import { fetchFollow, parseHome, pickInner, readFiles, readInner } from "@/lib/diagnost/fetch";
import { LEVEL_LABELS, VERDICT_LABELS, levelOf } from "@/lib/diagnost/levels";
import { renderSite } from "@/lib/diagnost/render";
import { adReadiness, categoryScores, overallScore, priorities, strengths, verdictOf } from "@/lib/diagnost/score";
import { initialStages, progressOf, type StageId, type StageRow, type StageState } from "@/lib/diagnost/stages";
import {
  BUSINESS_LABELS,
  type AiVision,
  type AuditResult,
  type BusinessType,
  type PageSignals,
  type Signals,
} from "@/lib/diagnost/types";

const STALE_MS = 6 * 60 * 1000;

export async function claimNextAudit(): Promise<string | null> {
  await db.diagnostAudit.updateMany({
    where: { status: "running", startedAt: { lt: new Date(Date.now() - STALE_MS) } },
    data: { status: "failed", error: "Проверка прервалась по времени", finishedAt: new Date() },
  });
  const next = await db.diagnostAudit.findFirst({ where: { status: "queued" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!next) return null;
  const claimed = await db.diagnostAudit.updateMany({
    where: { id: next.id, status: "queued" },
    data: { status: "running", startedAt: new Date(), stages: initialStages() as unknown as Prisma.InputJsonValue, progress: 1 },
  });
  return claimed.count === 1 ? next.id : null;
}

export async function processAudit(id: string): Promise<void> {
  const audit = await db.diagnostAudit.findUnique({ where: { id } });
  if (!audit || audit.status !== "running") return;
  const stages: StageRow[] = initialStages();

  const save = () =>
    db.diagnostAudit
      .update({ where: { id }, data: { stages: stages as unknown as Prisma.InputJsonValue, progress: progressOf(stages) } })
      .then(() => undefined)
      .catch(() => undefined);
  const set = async (stage: StageId, state: StageState, note: string | null = null) => {
    const row = stages.find((item) => item.id === stage);
    if (row) Object.assign(row, { state, note });
    await save();
  };

  try {
    // 1. Подключение
    await set("connect", "processing");
    const home = await fetchFollow(audit.url);
    if (!/text\/html|application\/xhtml/i.test(home.contentType) && home.contentType) throw new Error("Адрес открылся, но это не HTML-страница");
    const finalUrl = home.url;
    const https = finalUrl.startsWith("https://");
    await set(
      "connect",
      home.status >= 400 ? "error" : !https || home.redirects.length > 2 ? "warning" : "completed",
      `Код ${home.status}${home.redirects.length ? ` · перенаправлений: ${home.redirects.length}` : ""} · ${home.elapsedMs} мс`,
    );
    if (home.status >= 400 && home.body.length < 500) throw new Error(`Сайт отвечает ошибкой ${home.status}`);

    // 2. Тип бизнеса (эвристика; уточнит AI)
    await set("business", "processing");
    let parsed = parseHome(home.body, finalUrl);
    const signals: Signals = {
      inputUrl: audit.url,
      finalUrl,
      https,
      redirects: home.redirects,
      home: { ...parsed, status: home.status, elapsedMs: home.elapsedMs, htmlKb: Math.round(home.bytes / 1024) },
      inner: [],
      files: null,
      render: { ok: false, error: null, desktop: null, mobile: null, perf: null, html: null },
    };
    const hint = (audit.businessHint as BusinessType | null) || null;
    let business: BusinessType = hint || detectBusiness(signals);
    await set("business", "completed", `${BUSINESS_LABELS[business]}${hint ? " · указан вами" : " · предварительно"}`);

    // 3. Структура
    await set("structure", "processing");
    signals.inner = await readInner(pickInner(home.body, finalUrl));
    const broken = signals.inner.filter((page) => page.status === 0 || page.status >= 400).length;
    await set("structure", broken ? "warning" : "completed", `Страниц проверено: ${signals.inner.length + 1}${broken ? ` · с ошибкой: ${broken}` : ""}`);

    // 4. Первый экран (браузер, компьютер + телефон, замеры)
    await set("first_screen", "processing");
    signals.render = await renderSite(finalUrl, id);
    if (signals.render.html && signals.render.html.length > home.body.length * 0.6) {
      parsed = parseHome(signals.render.html, finalUrl);
      signals.home = { ...signals.home, ...mergeRendered(signals.home, parsed) };
    }
    const desktop = signals.render.desktop;
    await set(
      "first_screen",
      !signals.render.ok ? "error" : desktop?.ctaAboveFold ? "completed" : "warning",
      !signals.render.ok ? "Браузер не открыл страницу — первый экран не оценён" : desktop?.ctaAboveFold ? "Кнопка или форма видна сразу" : "На первом экране не нашли кнопку действия",
    );

    // 5. SEO
    await set("seo", "processing");
    signals.files = await readFiles(finalUrl).catch(() => null);
    await set("seo", signals.home.h1s.length && signals.home.title ? "completed" : "warning", `Title ${signals.home.title ? "есть" : "нет"} · H1: ${signals.home.h1s.length} · robots ${signals.files?.robots.found ? "есть" : "нет"} · sitemap ${signals.files?.sitemap.found ? "есть" : "нет"}`);

    // 6. Скорость
    await set("speed", "processing");
    const perf = signals.render.perf;
    await set(
      "speed",
      !perf ? "warning" : perf.lcpMs !== null && perf.lcpMs > 4000 ? "warning" : "completed",
      !perf ? "Недостаточно данных" : `Загрузка главного блока ${perf.lcpMs !== null ? `${(perf.lcpMs / 1000).toFixed(1).replace(".", ",")} с` : "—"} · ${perf.requests} запросов`,
    );

    // 7. Мобильная версия
    await set("mobile", "processing");
    const mobile = signals.render.mobile;
    await set(
      "mobile",
      !mobile ? "warning" : mobile.horizontalScroll || !signals.home.viewport ? "warning" : "completed",
      !mobile ? "Не удалось открыть мобильную версию" : mobile.horizontalScroll ? "Есть горизонтальная прокрутка" : signals.home.viewport ? "Адаптация включена" : "Нет мета-тега viewport",
    );

    // 8–9. Конверсия и доверие (детерминированно)
    await set("conversion", "processing");
    let checks = runChecks(signals, business, null);
    const convFails = checks.filter((item) => item.category === "conversion" && item.status === "fail").length;
    await set("conversion", convFails ? "warning" : "completed", `Кнопок с действием: ${signals.home.ctaCount} · форм: ${signals.home.forms.count} · телефон ${signals.home.phones.length ? "есть" : "нет"}`);
    await set("trust", "processing");
    const trustOk = checks.filter((item) => item.category === "trust" && item.status === "pass").length;
    const trustAll = checks.filter((item) => item.category === "trust").length;
    await set("trust", trustOk < trustAll / 2 ? "warning" : "completed", `Доверительных факторов: ${trustOk} из ${trustAll}`);

    // 10. Рекомендации (AI по скриншотам)
    await set("recommendations", "processing");
    let vision: AiVision | null = null;
    let aiError: string | null = null;
    if (aiAvailable() && (signals.render.desktop || signals.home.text.length > 200)) {
      try {
        vision = await analyzeVision(signals, hint);
        if (!hint) business = vision.business.type;
      } catch (error) {
        aiError = error instanceof Error ? error.message.slice(0, 200) : "AI недоступен";
        console.error("[diagnost] vision", aiError);
      }
    } else aiError = aiAvailable() ? "Мало данных для AI" : "Ключ AI не задан";
    checks = runChecks(signals, business, vision);

    const categories = categoryScores(checks);
    const overall = overallScore(categories);
    const ad = adReadiness(categories, checks, signals);
    const top = priorities(checks);
    const criticalCount = top.filter((item) => item.severity === "critical").length;
    const verdict = verdictOf(ad.score, criticalCount);
    const good = strengths(checks);

    let summary = fallbackSummary(overall, ad.score, criticalCount, top);
    let ads = fallbackAds(verdict, criticalCount, top, ad.caps, signals.home);
    if (vision) {
      try {
        const written = await writeSummary({
          host: new URL(finalUrl).hostname,
          business: BUSINESS_LABELS[business],
          overall,
          adReadiness: ad.score,
          verdict: VERDICT_LABELS[verdict],
          categories,
          priorities: top,
          criticalCount,
          strengths: good.map((item) => item.title),
        });
        if (written.summary) summary = written.summary;
        ads = {
          ...ads,
          comment: written.comment || ads.comment,
          risks: written.risks.length ? written.risks : ads.risks,
          beforeLaunch: written.beforeLaunch.length ? written.beforeLaunch : ads.beforeLaunch,
        };
      } catch (error) {
        console.error("[diagnost] summary", error instanceof Error ? error.message : error);
      }
    }
    await set("recommendations", vision ? "completed" : "warning", vision ? `Модель ${AI_MODEL} · оффер ${vision.offer.clarity}/10` : `Без AI: ${aiError}`);

    // 11. Отчёт
    await set("report", "processing");
    const fs = vision?.firstScreen;
    const firstScreen = fs ? Math.round(((fs.understanding + fs.cta + fs.trust + fs.hierarchy) / 40) * 100) : null;
    const scoreMap = Object.fromEntries(categories.map((category) => [category.id, category.score])) as AuditResult["scores"];
    const result: AuditResult = {
      version: 1,
      site: {
        url: audit.url,
        finalUrl,
        host: new URL(finalUrl).hostname.replace(/^www\./, ""),
        title: signals.home.title,
        businessType: business,
        businessSource: hint ? "user" : vision ? "ai" : "heuristic",
        niche: vision?.business.niche || null,
        audience: vision?.business.audience || null,
        targetAction: vision?.business.targetAction || null,
        trafficSource: vision?.business.trafficSource || null,
      },
      scores: { ...scoreMap, overall, adReadiness: ad.score, firstScreen },
      categories,
      priorities: top,
      strengths: good,
      verdict,
      criticalCount,
      ads,
      summary,
      firstScreen: {
        understanding: fs?.understanding ?? null,
        cta: fs?.cta ?? null,
        trust: fs?.trust ?? null,
        hierarchy: fs?.hierarchy ?? null,
        comment: fs?.comment ?? null,
      },
      offer: {
        conclusion: vision?.offer.conclusion || null,
        what: vision?.offer.what || null,
        forWhom: vision?.offer.forWhom || null,
        usp: vision?.offer.usp || null,
      },
      shots: { desktop: Boolean(signals.render.desktop?.shot), mobile: Boolean(signals.render.mobile?.shot) },
      marks: {
        desktop: signals.render.desktop?.marks || [],
        mobile: signals.render.mobile?.marks || [],
        desktopSize: [1440, 900],
        mobileSize: [390, 844],
      },
      perf: signals.render.perf,
      pages: [{ url: finalUrl, status: signals.home.status, title: signals.home.title, h1: signals.home.h1s[0] || "" }, ...signals.inner],
      ai: { model: vision ? AI_MODEL : null, error: vision ? null : aiError },
      generatedAt: new Date().toISOString(),
    };
    await set("report", "completed", `${overall}/100 · ${LEVEL_LABELS[levelOf(overall)]}`);

    await db.diagnostAudit.update({
      where: { id },
      data: {
        status: "done",
        progress: 100,
        result: result as unknown as Prisma.InputJsonValue,
        overall,
        adReadiness: ad.score,
        finishedAt: new Date(),
        error: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? humanError(error.message) : "Проверка не выполнилась";
    const active = stages.find((row) => row.state === "processing");
    if (active) Object.assign(active, { state: "error", note: message });
    await db.diagnostAudit.update({
      where: { id },
      data: { status: "failed", error: message, finishedAt: new Date(), stages: stages as unknown as Prisma.InputJsonValue },
    });
  }
}

function mergeRendered(http: PageSignals, rendered: ReturnType<typeof parseHome>): Partial<PageSignals> {
  const pickLonger = <T,>(a: T[], b: T[]) => (b.length > a.length ? b : a);
  return {
    h1s: http.h1s.length ? http.h1s : rendered.h1s,
    h2s: pickLonger(http.h2s, rendered.h2s),
    images: Math.max(http.images, rendered.images),
    imagesNoAlt: rendered.images > http.images ? rendered.imagesNoAlt : http.imagesNoAlt,
    forms: rendered.forms.count > http.forms.count ? rendered.forms : http.forms,
    ctas: pickLonger(http.ctas, rendered.ctas),
    weakCtas: pickLonger(http.weakCtas, rendered.weakCtas),
    ctaCount: Math.max(http.ctaCount, rendered.ctaCount),
    phones: pickLonger(http.phones, rendered.phones),
    messengers: pickLonger(http.messengers, rendered.messengers),
    prices: pickLonger(http.prices, rendered.prices),
    specifics: pickLonger(http.specifics, rendered.specifics),
    navLinks: Math.max(http.navLinks, rendered.navLinks),
    hasAdvantages: http.hasAdvantages || rendered.hasAdvantages,
    cart: http.cart || rendered.cart,
    trust: Object.fromEntries(
      Object.entries(http.trust).map(([key, value]) => [key, value || rendered.trust[key as keyof typeof rendered.trust]]),
    ) as PageSignals["trust"],
    analytics: {
      ...http.analytics,
      metrika: http.analytics.metrika || rendered.analytics.metrika,
      metrikaId: http.analytics.metrikaId || rendered.analytics.metrikaId,
      ga4: http.analytics.ga4 || rendered.analytics.ga4,
      gtm: http.analytics.gtm || rendered.analytics.gtm,
      vkPixel: http.analytics.vkPixel || rendered.analytics.vkPixel,
      topMail: http.analytics.topMail || rendered.analytics.topMail,
      calltracking: pickLonger(http.analytics.calltracking, rendered.analytics.calltracking),
      chats: pickLonger(http.analytics.chats, rendered.analytics.chats),
      ecommerce: http.analytics.ecommerce || rendered.analytics.ecommerce,
      thanksUrl: http.analytics.thanksUrl || rendered.analytics.thanksUrl,
    },
    text: rendered.text.length > http.text.length ? rendered.text : http.text,
  };
}

function humanError(message: string): string {
  if (/ENOTFOUND|нет адреса/i.test(message)) return "Домен не найден — проверьте адрес сайта";
  if (/timeout|aborted/i.test(message)) return "Сайт слишком долго не отвечает";
  if (/certificate|SSL|TLS/i.test(message)) return "Ошибка SSL-сертификата сайта";
  if (/ECONNREFUSED|ECONNRESET|fetch failed/i.test(message)) return "Сайт не принимает соединение";
  return message.slice(0, 200);
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

function fallbackSummary(overall: number, ad: number, critical: number, top: AuditResult["priorities"]): string {
  const main = top[0];
  return [
    `Сайт набрал ${overall} из 100 и готов к рекламе на ${ad}%.`,
    main ? `Главная проблема — «${main.title.toLowerCase()}»: ${main.evidence.replace(/\.$/, "")}.` : "Явных проблем автоматическая проверка не нашла.",
    critical ? `До запуска рекомендуется исправить ${critical} ${plural(critical, ["критичную проблему", "критичные проблемы", "критичных проблем"])}.` : "Критичных проблем нет — можно запускать и параллельно улучшать.",
  ].join(" ");
}

function fallbackAds(verdict: AuditResult["verdict"], critical: number, top: AuditResult["priorities"], caps: string[], home: PageSignals): AuditResult["ads"] {
  const verdictText =
    verdict === "go"
      ? "Да, можно запускать"
      : verdict === "fix"
        ? critical
          ? `Да, но после исправления ${critical} ${plural(critical, ["критичной проблемы", "критичных проблем", "критичных проблем"])}`
          : "Да, но сначала стоит закрыть важные пробелы"
        : "Пока не рекомендуется";
  const risks = [...caps.map((cap) => cap[0].toUpperCase() + cap.slice(1)), ...top.slice(0, 3).map((item) => item.title)].slice(0, 3);
  const before = [
    ...top.filter((item) => item.severity !== "minor").slice(0, 3).map((item) => item.fix.split(".")[0]),
    home.analytics.metrika ? "Проверить цели в Метрике: форма, звонок, мессенджер" : "Установить Яндекс.Метрику и настроить цели",
    "Проверить мобильную версию и форму с телефона",
    "Разметить ссылки объявлений UTM-метками",
  ].slice(0, 6);
  return {
    verdictText,
    risks,
    beforeLaunch: before,
    comment:
      verdict === "go"
        ? "Сайт выдерживает рекламный трафик. Запускайте и улучшайте найденное по ходу, сравнивая стоимость заявки."
        : verdict === "fix"
          ? `Запуск возможен, но часть бюджета уйдёт впустую, пока не исправлены главные проблемы${top[0] ? ` — прежде всего «${top[0].title.toLowerCase()}»` : ""}.`
          : "Сейчас рекламный бюджет будет сгорать: сайт не готов превращать клики в заявки. Сначала исправьте критичные проблемы.",
  };
}

