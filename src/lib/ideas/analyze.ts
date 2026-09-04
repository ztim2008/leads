/**
 * AI-разбор идеи для Ideas Board.
 * Контракт: summary / verdict / effort / pros / cons / risks / analogs / nextSteps / fitWithKonversus (+ optional graph).
 * Паттерн как у lead-analyzer: строгий JSON + парсинг; без ключа — детерминированный fallback.
 */

import { callOpenRouter, type ChatMessage } from "@/lib/ai/openrouter";
import { db } from "@/lib/db";
import {
  VERDICTS,
  SEVERITIES,
  OWNERS,
  EFFORT_LABELS_SET,
  type IdeaAnalysis,
  type IdeaEffort,
  type IdeaGraphEdge,
  type IdeaGraphNode,
  type IdeaRisk,
  type IdeaNextStep,
  type IdeaAnalog,
  type IdeaVerdict,
  type NextStepOwner,
  type RiskSeverity,
  type WeightedPoint,
} from "@/lib/ideas/analysis-types";

export type {
  IdeaAnalysis,
  IdeaEffort,
  IdeaVerdict,
  IdeaRisk,
  IdeaAnalog,
  IdeaNextStep,
  WeightedPoint,
} from "@/lib/ideas/analysis-types";

export { VERDICT_LABELS, EFFORT_LABELS } from "@/lib/ideas/analysis-types";

const SYSTEM_PROMPT = `Ты — стратег продукта Konversus (лиды с Profi/Kwork, AI-агенты на VPS, сайты и SEO для локального бизнеса в РФ).
Разложи идею основателя на структурированный анализ. Ответь СТРОГО валидным JSON без markdown:

{
  "summary": "2–4 предложения: суть и зачем",
  "verdict": "explore | park | build_mvp | skip",
  "effort": { "score": 1-5, "label": "S|M|L|XL", "weeksHint": "например 2–4 нед." },
  "pros": [{ "id": "p1", "text": "сильная сторона / аргумент «за»", "weight": 1-5 }],
  "cons": [{ "id": "c1", "text": "слабая сторона / аргумент «против»", "weight": 1-5 }],
  "risks": [{ "id": "r1", "text": "риск", "severity": "low|med|high", "mitigation": "как снизить" }],
  "analogs": [{ "id": "a1", "name": "название", "url": null, "note": "чем похоже / чем нет" }],
  "fitWithKonversus": "как стыкуется с Leads / сайтами / агентами / директ",
  "nextSteps": [{ "id": "n1", "text": "конкретный шаг", "owner": "founder|partner|both" }],
  "graph": {
    "nodes": [{ "id": "idea", "type": "idea", "label": "краткий ярлык" }],
    "edges": [{ "from": "idea", "to": "p1", "kind": "has" }]
  }
}

Правила:
- pros = за / сильные стороны; cons = против / слабые стороны (по 3–6 пунктов).
- risks: 2–5; analogs: 1–4; nextSteps: 3–6, измеримые.
- Пиши по-русски, конкретно для B2B/локального бизнеса в РФ.
- graph опционален, но желателен: узлы idea + все id из pros/cons/risks/analogs/nextSteps.`;

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function parseWeighted(arr: unknown, prefix: string): WeightedPoint[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 8).map((item, i) => {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      id: asString(o.id, `${prefix}${i + 1}`) || `${prefix}${i + 1}`,
      text: asString(o.text, "—") || "—",
      weight: clampInt(o.weight, 1, 5, 3),
    };
  });
}

function parseRisks(arr: unknown): IdeaRisk[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 8).map((item, i) => {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const sev = asString(o.severity, "med") as RiskSeverity;
    return {
      id: asString(o.id, `r${i + 1}`) || `r${i + 1}`,
      text: asString(o.text, "—") || "—",
      severity: SEVERITIES.has(sev) ? sev : "med",
      mitigation: asString(o.mitigation, "Уточнить на пилоте") || "Уточнить на пилоте",
    };
  });
}

function parseAnalogs(arr: unknown): IdeaAnalog[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 6).map((item, i) => {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const urlRaw = o.url;
    return {
      id: asString(o.id, `a${i + 1}`) || `a${i + 1}`,
      name: asString(o.name, "Аналог") || "Аналог",
      url: typeof urlRaw === "string" && urlRaw.trim() ? urlRaw.trim() : null,
      note: asString(o.note, "") || "",
    };
  });
}

function parseNextSteps(arr: unknown): IdeaNextStep[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 8).map((item, i) => {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const owner = asString(o.owner, "both") as NextStepOwner;
    return {
      id: asString(o.id, `n${i + 1}`) || `n${i + 1}`,
      text: asString(o.text, "—") || "—",
      owner: OWNERS.has(owner) ? owner : "both",
    };
  });
}

function buildGraph(analysis: Omit<IdeaAnalysis, "graph" | "source" | "error">, ideaLabel: string): IdeaAnalysis["graph"] {
  const nodes: IdeaGraphNode[] = [{ id: "idea", type: "idea", label: ideaLabel.slice(0, 40) }];
  const edges: IdeaGraphEdge[] = [];
  for (const p of analysis.pros) {
    nodes.push({ id: p.id, type: "pro", label: p.text.slice(0, 48) });
    edges.push({ from: "idea", to: p.id, kind: "has" });
  }
  for (const c of analysis.cons) {
    nodes.push({ id: c.id, type: "con", label: c.text.slice(0, 48) });
    edges.push({ from: "idea", to: c.id, kind: "has" });
  }
  for (const r of analysis.risks) {
    nodes.push({ id: r.id, type: "risk", label: r.text.slice(0, 48) });
    edges.push({ from: "idea", to: r.id, kind: "has" });
  }
  for (const a of analysis.analogs) {
    nodes.push({ id: a.id, type: "analog", label: a.name.slice(0, 48) });
    edges.push({ from: "idea", to: a.id, kind: "has" });
  }
  for (const n of analysis.nextSteps) {
    nodes.push({ id: n.id, type: "next", label: n.text.slice(0, 48) });
    edges.push({ from: "idea", to: n.id, kind: "next" });
  }
  return { nodes, edges };
}

/** Строгая нормализация сырого JSON в IdeaAnalysis. */
export function parseIdeaAnalysis(raw: unknown, ideaTitle: string): IdeaAnalysis {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const verdictRaw = asString(o.verdict, "explore") as IdeaVerdict;
  const effortRaw = (o.effort && typeof o.effort === "object" ? o.effort : {}) as Record<string, unknown>;
  const labelRaw = asString(effortRaw.label, "M").toUpperCase();
  const label = (EFFORT_LABELS_SET.has(labelRaw) ? labelRaw : "M") as IdeaEffort["label"];

  const base: Omit<IdeaAnalysis, "graph" | "source" | "error"> = {
    summary: asString(o.summary, "Анализ идеи") || "Анализ идеи",
    verdict: VERDICTS.has(verdictRaw) ? verdictRaw : "explore",
    effort: {
      score: clampInt(effortRaw.score, 1, 5, label === "S" ? 1 : label === "M" ? 2 : label === "L" ? 4 : 5),
      label,
      weeksHint: asString(effortRaw.weeksHint, "2–4 нед.") || "2–4 нед.",
    },
    pros: parseWeighted(o.pros, "p"),
    cons: parseWeighted(o.cons, "c"),
    risks: parseRisks(o.risks),
    analogs: parseAnalogs(o.analogs),
    fitWithKonversus: asString(o.fitWithKonversus, "Уточнить стыковку с продуктами Konversus"),
    nextSteps: parseNextSteps(o.nextSteps),
  };

  if (base.pros.length === 0) {
    base.pros = [{ id: "p1", text: "Потенциал проверить на небольшом пилоте", weight: 3 }];
  }
  if (base.cons.length === 0) {
    base.cons = [{ id: "c1", text: "Нужна проверка спроса и unit-экономики", weight: 3 }];
  }
  if (base.risks.length === 0) {
    base.risks = [
      {
        id: "r1",
        text: "Переоценка спроса",
        severity: "med",
        mitigation: "Короткий пилот с измеримой метрикой",
      },
    ];
  }
  if (base.nextSteps.length === 0) {
    base.nextSteps = [
      { id: "n1", text: "Сформулировать гипотезу и критерий успеха на 2 недели", owner: "both" },
    ];
  }

  let graph: IdeaAnalysis["graph"];
  if (o.graph && typeof o.graph === "object") {
    const g = o.graph as Record<string, unknown>;
    const nodes = Array.isArray(g.nodes)
      ? g.nodes
          .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
          .map((n) => ({
            id: asString(n.id, "n"),
            type: (asString(n.type, "idea") as IdeaGraphNode["type"]) || "idea",
            label: asString(n.label, "") || asString(n.id, ""),
          }))
      : [];
    const edges = Array.isArray(g.edges)
      ? g.edges
          .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
          .map((e) => ({
            from: asString(e.from),
            to: asString(e.to),
            kind: asString(e.kind, "has") || "has",
          }))
          .filter((e) => e.from && e.to)
      : [];
    graph = nodes.length ? { nodes, edges } : buildGraph(base, ideaTitle);
  } else {
    graph = buildGraph(base, ideaTitle);
  }

  return { ...base, graph };
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Невалидный JSON от AI");
    return JSON.parse(m[0]);
  }
}

/** Детерминированный разбор по эвристикам title/body — для демо без LLM. */
export function buildFallbackAnalysis(title: string, body: string, extraNote?: string): IdeaAnalysis {
  const blob = `${title}\n${body}`.toLowerCase();
  const isTemplates =
    /шаблон|каталог|landing\.compmaster|директ|яндекс/.test(blob) || /template|catalog/.test(blob);
  const isContent = /контент|ферм|wordstat|seo|город|район/.test(blob);
  const isScan = /скан|сайт.*улучш|оффер|аудит/.test(blob);

  let analysis: IdeaAnalysis;

  if (isTemplates) {
    analysis = {
      summary:
        "Каталог ИИ/готовых лендинг-шаблонов под строительные и локальные ниши: быстрый старт клиента и проверка гипотез в Яндекс Директе без долгой кастомной разработки. Референс — витрина готовых шаблонов вроде LandingCompMaster (фильтры по нише, калькуляторы, цена ~1 000 ₽).",
      verdict: "build_mvp",
      effort: { score: 3, label: "M", weeksHint: "3–5 нед. на витрину + 3–5 шаблонов" },
      pros: [
        { id: "p1", text: "Быстрый time-to-value: клиент запускает гипотезу за дни, не месяцы", weight: 5 },
        { id: "p2", text: "Сильный fit с Директом: одинаковые шаблоны удобно A/B-тестить по нише", weight: 5 },
        { id: "p3", text: "Повторяемый продукт (каталог), а не разовая кастомная разработка", weight: 4 },
        { id: "p4", text: "Стройка/ремонт — платёжеспособные локальные ниши с понятным CPA", weight: 4 },
      ],
      cons: [
        { id: "c1", text: "Конкуренция с готовыми витринами шаблонов и конструкторами", weight: 4 },
        { id: "c2", text: "Нужен контент/фото/калькуляторы под каждую нишу — иначе «пустые» шаблоны", weight: 4 },
        { id: "c3", text: "Риск, что клиент купит шаблон и уйдёт без сопровождения Директа/лидов", weight: 3 },
        { id: "c4", text: "Поддержка правок «под меня» может съесть маржу каталога", weight: 3 },
      ],
      risks: [
        {
          id: "r1",
          text: "Шаблон не конвертит в конкретной гео/услуге",
          severity: "med",
          mitigation: "Пилот 1–2 ниши + обязательный блок УТП/гео в редакторе",
        },
        {
          id: "r2",
          text: "Каннибализация кастомных проектов Konversus",
          severity: "low",
          mitigation: "Позиционировать каталог как вход, апселл — лиды/агент/доработки",
        },
        {
          id: "r3",
          text: "Юр. риски копирования чужих макетов/текстов",
          severity: "med",
          mitigation: "Свои макеты + лицензии на стоки; чеклист уникальности",
        },
      ],
      analogs: [
        {
          id: "a1",
          name: "LandingCompMaster",
          url: "https://landing.compmaster.site/",
          note: "Витрина готовых лендингов с калькуляторами и нишевыми фильтрами — прямой референс UX каталога",
        },
        {
          id: "a2",
          name: "Tilda / Flexbe магазины шаблонов",
          url: null,
          note: "Массовый рынок конструкторов; наша дифференциация — ниша стройки + связка с Директом и лидами",
        },
      ],
      fitWithKonversus:
        "Входной продукт к экосистеме: шаблон → трафик из Директа → лиды в Konversus Leads / Telegram. Можно пакетировать с агентом и сопровождением рекламы.",
      nextSteps: [
        { id: "n1", text: "Выбрать 3 ниши стройки и ТЗ на первый шаблон (калькулятор + форма)", owner: "founder" },
        { id: "n2", text: "Сверстать каркас витрины каталога (карточка, фильтр, цена, демо)", owner: "partner" },
        { id: "n3", text: "Прогнать 1 нишу в Директе на тестовом бюджете и зафиксировать CPL", owner: "both" },
        { id: "n4", text: "Описать апселл: шаблон → лиды / доработки / агент", owner: "founder" },
      ],
      source: "fallback",
    };
  } else if (isContent) {
    analysis = {
      summary:
        "Контент-ферма на сайтах клиентов: генерация/публикация SEO-страниц под запросы Wordstat с разбивкой по городу, району и услуге. Цель — органический поток заявок без роста стоимости клика в Директе.",
      verdict: "explore",
      effort: { score: 4, label: "L", weeksHint: "4–8 нед. до стабильного пайплайна" },
      pros: [
        { id: "p1", text: "Масштабируемый recurring: страницы × города × услуги", weight: 5 },
        { id: "p2", text: "Wordstat даёт измеримый спрос до генерации", weight: 5 },
        { id: "p3", text: "Усиливает уже существующие сайты клиентов Konversus", weight: 4 },
        { id: "p4", text: "Снижает зависимость от платного трафика", weight: 4 },
      ],
      cons: [
        { id: "c1", text: "Риск «фермы» и фильтров поиска при шаблонном контенте", weight: 5 },
        { id: "c2", text: "Нужны вводные от клиента (услуги, гео, УТП) — иначе вода", weight: 4 },
        { id: "c3", text: "Долгий горизонт SEO: эффект не за неделю", weight: 4 },
        { id: "c4", text: "Поддержка индексации, битых ссылок, обновлений — операционка", weight: 3 },
      ],
      risks: [
        {
          id: "r1",
          text: "Санкции/пессимизация за массовый thin-content",
          severity: "high",
          mitigation: "Уникальность, E-E-A-T, ручная редактура топа, лимит страниц/неделя",
        },
        {
          id: "r2",
          text: "Клиент ждёт заявки сразу",
          severity: "med",
          mitigation: "SLA и ожидания в договоре: горизонт 1–3 мес. + промежуточные KPI",
        },
        {
          id: "r3",
          text: "Конфликт с платным трафиком (каннибализация)",
          severity: "low",
          mitigation: "Развести интенты: SEO на mid/long, Директ на горячие",
        },
      ],
      analogs: [
        {
          id: "a1",
          name: "Сервисы AI-SEO / programmatic SEO",
          url: null,
          note: "Массовая генерация лендингов под ключи; нужно отстроиться качеством и локальной экспертизой",
        },
        {
          id: "a2",
          name: "Агентства контент-маркетинга",
          url: null,
          note: "Ручной контент дороже; наша ставка — полуавтомат + Wordstat-пайплайн",
        },
      ],
      fitWithKonversus:
        "Доп. продукт к сайтам и лидам: тот же клиент, другой канал. Можно продавать пакетом с Директом и мониторингом заявок в кабинете Leads.",
      nextSteps: [
        { id: "n1", text: "Пилот: 1 клиент, 20–40 страниц по Wordstat (город×услуга)", owner: "both" },
        { id: "n2", text: "Шаблон структуры страницы + чеклист уникальности", owner: "partner" },
        { id: "n3", text: "Схема публикации на сайт клиента (CMS/API) и отчёт по индексации", owner: "founder" },
        { id: "n4", text: "Метрики через 30/60 дней: индекс, позиции, заявки", owner: "both" },
      ],
      source: "fallback",
    };
  } else if (isScan) {
    analysis = {
      summary:
        "Лидоген через скан чужих сайтов: находим слабые места (скорость, мобилка, формы, оффер, SEO) и предлагаем платное улучшение. Канал привлечения клиентов Konversus без холодных «продаж в лоб».",
      verdict: "explore",
      effort: { score: 3, label: "M", weeksHint: "2–4 нед. на MVP-сканер + оффер" },
      pros: [
        { id: "p1", text: "Персонализированный оффер сильнее массовой рассылки", weight: 5 },
        { id: "p2", text: "Низкий порог входа: можно начать с ручного аудита + чеклиста", weight: 4 },
        { id: "p3", text: "Прямой вход в кастом/шаблоны/лиды — понятный апселл", weight: 5 },
        { id: "p4", text: "Масштабируется автоматизацией (краулер + скоринг)", weight: 3 },
      ],
      cons: [
        { id: "c1", text: "Холодный outreach может восприниматься как спам", weight: 4 },
        { id: "c2", text: "Качество скана без Playwright/Lighthouse-стека ограничено", weight: 3 },
        { id: "c3", text: "Нужен сильный follow-up и упаковка кейсов", weight: 3 },
        { id: "c4", text: "Юр. и этические границы массового сканирования", weight: 3 },
      ],
      risks: [
        {
          id: "r1",
          text: "Низкий response rate на офферы",
          severity: "high",
          mitigation: "Узкая ниша + 1–2 конкретных бага в письме + соцдоказательства",
        },
        {
          id: "r2",
          text: "Ложные срабатывания сканера → потеря доверия",
          severity: "med",
          mitigation: "Ручная проверка топ-находок до отправки",
        },
        {
          id: "r3",
          text: "Блокировки IP / ToS сайтов при агрессивном крауле",
          severity: "med",
          mitigation: "Мягкий rate-limit, публичные страницы, без обхода защит",
        },
      ],
      analogs: [
        {
          id: "a1",
          name: "Агентства с «бесплатным аудитом сайта»",
          url: null,
          note: "Классический lead-magnet; автоматизация скана ускоряет воронку",
        },
        {
          id: "a2",
          name: "SaaS website graders (PageSpeed-отчёты)",
          url: null,
          note: "Дают отчёт, но не продают внедрение — наша сила в доведении до результата",
        },
      ],
      fitWithKonversus:
        "Канал привлечения клиентов на сайты/шаблоны/лиды. Скан → оффер → проект → подключение к Leads AI как удержание.",
      nextSteps: [
        { id: "n1", text: "Чеклист аудита из 10 пунктов и шаблон письма-оффера", owner: "founder" },
        { id: "n2", text: "Ручной пилот: 30 сайтов одной ниши, 10 персонализированных офферов", owner: "both" },
        { id: "n3", text: "Зафиксировать конверсию в ответ/созвон — решение об автоматизации", owner: "partner" },
        { id: "n4", text: "Связать успешные сделки с пакетом «сайт + лиды»", owner: "founder" },
      ],
      source: "fallback",
    };
  } else {
    analysis = {
      summary: `Черновой разбор идеи «${title}»: потенциал есть, но нужны гипотеза, критерий успеха и оценка спроса до большой разработки.`,
      verdict: "explore",
      effort: { score: 3, label: "M", weeksHint: "2–4 нед. на проверку" },
      pros: [
        { id: "p1", text: "Идею можно проверить маленьким пилотом", weight: 4 },
        { id: "p2", text: "Есть пересечение с экспертизой Konversus (сайты, лиды, AI)", weight: 3 },
        { id: "p3", text: "Можно упаковать как доп. продукт для текущих клиентов", weight: 3 },
      ],
      cons: [
        { id: "c1", text: "Неясен объём рынка и готовность платить", weight: 4 },
        { id: "c2", text: "Риск распылить фокус команды", weight: 3 },
        { id: "c3", text: "Нужна более точная формулировка ICP и оффера", weight: 3 },
      ],
      risks: [
        {
          id: "r1",
          text: "Сделать «большое» до проверки спроса",
          severity: "med",
          mitigation: "Ограничить MVP 2 неделями и одной метрикой",
        },
        {
          id: "r2",
          text: "Конкуренция или уже занятая ниша",
          severity: "med",
          mitigation: "Собрать 3–5 аналогов и отличия",
        },
      ],
      analogs: [
        { id: "a1", name: "Ближайшие продукты рынка", url: null, note: "Уточнить вручную после desk research" },
      ],
      fitWithKonversus: "Оценить, усиливает ли идея лиды, сайты или агентский контур — иначе парковать.",
      nextSteps: [
        { id: "n1", text: "Описать ICP и ценностное предложение в 5 предложениях", owner: "founder" },
        { id: "n2", text: "Найти 3 аналога и сравнить по цене/каналу", owner: "partner" },
        { id: "n3", text: "Сформулировать пилот на 14 дней с критерием go/no-go", owner: "both" },
      ],
      source: "fallback",
    };
  }

  if (extraNote) {
    analysis.summary = `${analysis.summary} ${extraNote}`.trim();
  }

  analysis.graph = buildGraph(analysis, title);
  return analysis;
}

async function resolveApiKey(): Promise<{ key: string; source: string } | null> {
  const envKey = process.env.OPENROUTER_API_KEY?.trim();
  if (envKey) return { key: envKey, source: "env" };

  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) return { key: openai, source: "openai_env" };

  const row = await db.settings.findFirst({
    where: { NOT: { openrouterKey: null } },
    select: { openrouterKey: true },
    orderBy: { updatedAt: "desc" },
  });
  const k = row?.openrouterKey?.trim();
  if (k) return { key: k, source: "workspace_settings" };
  return null;
}

async function callLlmAnalysis(
  title: string,
  body: string,
  apiKey: string,
  keySource: string,
  extraContext?: string,
): Promise<IdeaAnalysis> {
  const userParts = [
    `Заголовок: ${title}`,
    "",
    "Описание:",
    body.slice(0, 6000),
  ];
  if (extraContext) {
    userParts.push("", "Доп. контекст:", extraContext.slice(0, 2500));
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userParts.join("\n") },
  ];

  // OpenAI direct path if key looks like OpenAI and source is openai
  if (keySource === "openai_env") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI пустой ответ");
    const parsed = parseIdeaAnalysis(extractJson(content), title);
    parsed.source = "llm";
    return parsed;
  }

  const result = await callOpenRouter(
    messages,
    {
      model: process.env.IDEAS_ANALYZER_MODEL || "deepseek/deepseek-chat",
      temperature: 0.3,
      maxTokens: 2500,
      timeout: 60_000,
    },
    apiKey,
  );

  const parsed = parseIdeaAnalysis(extractJson(result), title);
  parsed.source = "llm";
  return parsed;
}

export type AnalyzeIdeaOptions = {
  force?: boolean;
  extraContext?: string;
};

/**
 * Полный цикл: status analyzing → LLM/fallback → analysis + analyzedAt → ready.
 * Возвращает сохранённый анализ.
 */
export async function runIdeaAnalysis(
  ideaId: string,
  options: AnalyzeIdeaOptions = {},
): Promise<{ analysis: IdeaAnalysis; fromCache: boolean }> {
  const idea = await db.idea.findUnique({ where: { id: ideaId } });
  if (!idea) throw new Error("IDEA_NOT_FOUND");

  if (idea.analysis && !options.force) {
    return {
      analysis: parseIdeaAnalysis(idea.analysis, idea.title),
      fromCache: true,
    };
  }

  await db.idea.update({
    where: { id: ideaId },
    data: { status: "analyzing" },
  });

  let analysis: IdeaAnalysis;
  const keyInfo = await resolveApiKey();

  if (!keyInfo) {
    console.warn(`[ideas/analyze] no API key for idea ${ideaId} — fallback`);
    analysis = buildFallbackAnalysis(idea.title, idea.body);
    analysis.error = "Нет API-ключа (OPENROUTER/OPENAI) — использован детерминированный разбор";
  } else {
    try {
      analysis = await callLlmAnalysis(
        idea.title,
        idea.body,
        keyInfo.key,
        keyInfo.source,
        options.extraContext,
      );
    } catch (e1) {
      const msg1 = e1 instanceof Error ? e1.message : String(e1);
      console.warn(`[ideas/analyze] LLM fail #1 idea ${ideaId}: ${msg1} — retry`);
      try {
        analysis = await callLlmAnalysis(
          idea.title,
          idea.body,
          keyInfo.key,
          keyInfo.source,
          options.extraContext,
        );
      } catch (e2) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        console.error(`[ideas/analyze] LLM fail #2 idea ${ideaId}: ${msg2} — fallback`);
        analysis = buildFallbackAnalysis(idea.title, idea.body);
        analysis.error = `LLM недоступен (${msg2}) — детерминированный разбор`;
      }
    }
  }

  await db.idea.update({
    where: { id: ideaId },
    data: {
      analysis: analysis as object,
      analyzedAt: new Date(),
      status: "ready",
    },
  });

  return { analysis, fromCache: false };
}
