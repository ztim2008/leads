export type BusinessType = "ecommerce" | "services" | "b2b" | "saas" | "local" | "info" | "other";

export const BUSINESS_LABELS: Record<BusinessType, string> = {
  ecommerce: "Интернет-магазин",
  services: "Услуги",
  b2b: "B2B",
  saas: "SaaS",
  local: "Локальный бизнес",
  info: "Инфобизнес",
  other: "Другое",
};

export type CategoryId = "conversion" | "offer" | "ux" | "seo" | "performance" | "trust" | "analytics";

export const CATEGORY_WEIGHTS: Record<CategoryId, number> = {
  conversion: 25,
  offer: 20,
  ux: 15,
  seo: 15,
  performance: 10,
  trust: 10,
  analytics: 5,
};

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  conversion: "Конверсия",
  offer: "Оффер",
  ux: "UX",
  seo: "SEO",
  performance: "Скорость",
  trust: "Доверие",
  analytics: "Аналитика и реклама",
};

export const CATEGORY_ABOUT: Record<CategoryId, string> = {
  conversion: "Насколько сайт превращает рекламный трафик в заявку: CTA, форма, контакты, следующий шаг.",
  offer: "Понимает ли посетитель, что продают, кому и почему выбрать именно эту компанию.",
  ux: "Первый экран, иерархия, мобильная версия и очевидный путь к заявке.",
  seo: "Техническая база страницы: заголовки, индексация, robots, sitemap, разметка.",
  performance: "Скорость загрузки и вес страницы. Лабораторный замер с нашего сервера.",
  trust: "Отзывы, кейсы, реквизиты, адрес, гарантии и юридические документы.",
  analytics: "Можно ли измерить результат рекламы: счётчики, пиксели, коллтрекинг, цели.",
};

export type CheckStatus = "pass" | "warn" | "fail" | "unknown" | "info";
export type Severity = "critical" | "important" | "minor";
export type Level = "low" | "medium" | "high";

export type Check = {
  id: string;
  category: CategoryId;
  title: string;
  status: CheckStatus;
  weight: number;
  /** Что именно найдено — факт со страницы или замер. Без выдумки. */
  evidence: string;
  url: string | null;
  /** Насколько это важно для рекламы — объяснение языком бизнеса */
  why: string;
  fix: string;
  severity: Severity;
  impact: Level;
  effort: Level;
  /** 1 — детерминированная проверка, 0.6–0.8 — оценка модели по скриншоту */
  confidence: number;
  source: "check" | "render" | "ai";
};

export type ScoreLevel = "excellent" | "good" | "fair" | "poor" | "critical";

export type CategoryResult = {
  id: CategoryId;
  score: number | null;
  level: ScoreLevel | null;
  checks: Check[];
};

export type Box = { x: number; y: number; w: number; h: number };

export type FoldMark = { kind: "h1" | "cta" | "phone" | "form" | "trust"; label: string; box: Box };

export type ViewSignals = {
  shot: string | null;
  width: number;
  height: number;
  marks: FoldMark[];
  ctaAboveFold: boolean;
  phoneAboveFold: boolean;
  formAboveFold: boolean;
  /** Верх первой формы в экранах (1 = сразу под первым экраном) */
  formDepthScreens: number | null;
  horizontalScroll: boolean;
  baseFontPx: number | null;
  smallTapShare: number | null;
  foldText: string;
};

export type PerfSignals = {
  ttfbMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number | null;
  loadMs: number | null;
  requests: number | null;
  transferKb: number | null;
  jsKb: number | null;
  cssKb: number | null;
  imgKb: number | null;
  fontKb: number | null;
};

export type RenderSignals = {
  ok: boolean;
  error: string | null;
  desktop: ViewSignals | null;
  mobile: ViewSignals | null;
  perf: PerfSignals | null;
  html: string | null;
};

export type Redirect = { from: string; to: string; status: number };

export type PageSignals = {
  url: string;
  status: number;
  elapsedMs: number;
  htmlKb: number;
  title: string;
  description: string;
  h1s: string[];
  h2s: string[];
  canonical: string;
  noindex: boolean;
  lang: string;
  viewport: boolean;
  og: boolean;
  schemaTypes: string[];
  images: number;
  imagesNoAlt: number;
  forms: { count: number; maxFields: number; consent: boolean };
  ctas: string[];
  weakCtas: string[];
  ctaCount: number;
  phones: string[];
  emails: string[];
  messengers: string[];
  prices: string[];
  specifics: string[];
  navLinks: number;
  hasAdvantages: boolean;
  trust: {
    reviews: boolean;
    cases: boolean;
    certificates: boolean;
    guarantee: boolean;
    clients: boolean;
    years: string | null;
    inn: string | null;
    ogrn: boolean;
    address: boolean;
    privacyUrl: string | null;
    ofertaUrl: string | null;
    aboutUrl: string | null;
  };
  analytics: {
    metrika: boolean;
    metrikaId: string | null;
    ga4: boolean;
    gtm: boolean;
    vkPixel: boolean;
    topMail: boolean;
    calltracking: string[];
    chats: string[];
    ecommerce: boolean;
    thanksUrl: string | null;
  };
  cart: boolean;
  text: string;
};

export type SiteFilesSignals = {
  robots: { url: string; found: boolean; blocksYandex: boolean; sitemaps: string[] };
  sitemap: { url: string; found: boolean; locs: number; foreignHosts: string[] };
};

export type InnerPage = { url: string; status: number; title: string; h1: string };

export type Signals = {
  inputUrl: string;
  finalUrl: string;
  https: boolean;
  redirects: Redirect[];
  home: PageSignals;
  inner: InnerPage[];
  files: SiteFilesSignals | null;
  render: RenderSignals;
};

export type AiVision = {
  business: {
    type: BusinessType;
    niche: string;
    audience: string;
    targetAction: string;
    trafficSource: string;
    priceExpected: boolean;
  };
  offer: {
    clarity: number;
    differentiation: number;
    what: string;
    forWhom: string;
    usp: string | null;
    conclusion: string;
    quote: string;
  };
  firstScreen: { understanding: number; cta: number; trust: number; hierarchy: number; comment: string };
  ux: { hierarchy: number; pathToLead: number; comment: string };
};

export type Verdict = "go" | "fix" | "stop";

export type Priority = {
  checkId: string;
  category: CategoryId;
  severity: Severity;
  title: string;
  why: string;
  fix: string;
  evidence: string;
  url: string | null;
  impact: Level;
  effort: Level;
  confidence: number;
  ice: number;
};

export type AuditResult = {
  version: 1;
  site: {
    url: string;
    finalUrl: string;
    host: string;
    title: string;
    businessType: BusinessType;
    businessSource: "user" | "ai" | "heuristic";
    niche: string | null;
    audience: string | null;
    targetAction: string | null;
    trafficSource: string | null;
  };
  scores: {
    overall: number;
    adReadiness: number;
    firstScreen: number | null;
  } & Record<CategoryId, number | null>;
  categories: CategoryResult[];
  priorities: Priority[];
  strengths: Check[];
  verdict: Verdict;
  criticalCount: number;
  ads: {
    verdictText: string;
    risks: string[];
    beforeLaunch: string[];
    comment: string;
  };
  summary: string;
  firstScreen: {
    understanding: number | null;
    cta: number | null;
    trust: number | null;
    hierarchy: number | null;
    comment: string | null;
  };
  offer: { conclusion: string | null; what: string | null; forWhom: string | null; usp: string | null };
  shots: { desktop: boolean; mobile: boolean };
  marks: { desktop: FoldMark[]; mobile: FoldMark[]; desktopSize: [number, number]; mobileSize: [number, number] };
  perf: PerfSignals | null;
  pages: InnerPage[];
  ai: {
    model: string | null;
    error: string | null;
    usage?: AiUsage;
    vision?: AiVision | null;
    fingerprint?: string | null;
    summaryKey?: string | null;
    summaryText?: { summary: string; comment: string } | null;
    reused?: { vision: boolean; summary: boolean };
  };
  generatedAt: string;
};

export type AiUsage = {
  calls: number;
  promptTokens: number;
  cacheHitTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  costUsd: number;
};
