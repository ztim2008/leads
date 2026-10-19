"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Gauge as GaugeIcon,
  HelpCircle,
  Info,
  Loader2,
  Megaphone,
  MousePointerClick,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  XCircle,
  Zap,
} from "lucide-react";
import Gauge from "@/components/diagnost/gauge";
import { ClosedNotice, Delta, formatDate, LevelBadge, levelClass, ScoreText, VerdictBadge } from "@/components/diagnost/bits";
import type { AuditView } from "@/lib/diagnost/data";
import { EFFORT_WORDS, LEVEL_HEADLINES, LEVEL_WORDS, levelOf, SEVERITY_LABELS, VERDICT_LABELS } from "@/lib/diagnost/levels";
import {
  BUSINESS_LABELS,
  CATEGORY_ABOUT,
  CATEGORY_LABELS,
  CATEGORY_WEIGHTS,
  type AuditResult,
  type CategoryId,
  type Check,
  type CheckStatus,
  type FoldMark,
  type Priority,
  type ScoreLevel,
  type Severity,
  type Verdict,
} from "@/lib/diagnost/types";

const CATEGORY_ICONS: Record<CategoryId, typeof Target> = {
  conversion: Target,
  offer: Megaphone,
  ux: MousePointerClick,
  seo: Search,
  performance: Zap,
  trust: ShieldCheck,
  analytics: BarChart3,
};

const SEVERITY_LEVEL: Record<Severity, string> = { critical: "dg-l-critical", important: "dg-l-poor", minor: "dg-l-fair" };

function StatusIcon({ status, size = 16 }: { status: CheckStatus; size?: number }) {
  if (status === "pass") return <CheckCircle2 size={size} style={{ color: "var(--dg-excellent)" }} aria-label="Хорошо" />;
  if (status === "warn") return <AlertTriangle size={size} style={{ color: "var(--dg-fair)" }} aria-label="Частично" />;
  if (status === "fail") return <XCircle size={size} style={{ color: "var(--dg-critical)" }} aria-label="Проблема" />;
  if (status === "info") return <Info size={size} style={{ color: "var(--dg-muted)" }} aria-label="Информация" />;
  return <HelpCircle size={size} style={{ color: "var(--dg-muted)" }} aria-label="Не проверено" />;
}

function plural(n: number, forms: [string, string, string]) {
  const a = n % 10;
  const b = n % 100;
  return a === 1 && b !== 11 ? forms[0] : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? forms[1] : forms[2];
}

function Section({ id, title, lead, children, icon: Icon }: { id?: string; title: string; lead?: string; children: React.ReactNode; icon?: typeof Target }) {
  return (
    <section id={id} className="mt-16 scroll-mt-8">
      <div className="mb-5 flex items-center gap-3">
        {Icon && <Icon size={22} style={{ color: "var(--dg-accent)" }} />}
        <h2 className="text-[26px] font-bold">{title}</h2>
      </div>
      {lead && (
        <p className="-mt-2 mb-5 max-w-[760px] text-[15px]" style={{ color: "var(--dg-body)" }}>
          {lead}
        </p>
      )}
      {children}
    </section>
  );
}

function Actions({ result, slug, url }: { result: AuditResult; slug: string; url: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  async function rerun() {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/diagnost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, businessType: result.site.businessSource === "user" ? result.site.businessType : null }),
      });
      const data = (await response.json()) as { slug?: string; error?: string; closed?: boolean };
      if (data.closed) {
        setClosed(true);
        setBusy(false);
        return;
      }
      if (!data.slug) throw new Error(data.error || "Не удалось запустить");
      router.push(`/diagnost/r/${data.slug}`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Не удалось запустить");
      setBusy(false);
    }
  }

  async function share() {
    const link = `${window.location.origin}/diagnost/r/${slug}`;
    try {
      if (navigator.share) await navigator.share({ title: `Аудит сайта ${result.site.host}`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setNote("Ссылка на отчёт скопирована");
      }
    } catch {
      /* пользователь закрыл окно */
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        <a className="dg-btn dg-btn-primary" href={`/api/diagnost/${slug}/pdf?kind=client`}>
          <Download size={16} />
          Отчёт для клиента
        </a>
        <a className="dg-btn dg-btn-ghost" href={`/api/diagnost/${slug}/pdf?kind=pro`}>
          <FileText size={16} />
          Отчёт для директолога
        </a>
        <button type="button" className="dg-btn dg-btn-ghost" onClick={rerun} disabled={busy}>
          {busy ? <Loader2 size={16} className="dg-spin" /> : <RotateCcw size={16} />}
          Повторный аудит
        </button>
        <button type="button" className="dg-btn dg-btn-ghost" onClick={share}>
          <Share2 size={16} />
          Поделиться
        </button>
      </div>
      {closed && <ClosedNotice />}
      {note && (
        <p className="mt-2 text-sm" style={{ color: "var(--dg-muted)" }} role="status">
          {note}
        </p>
      )}
      <p className="mt-2 text-xs" style={{ color: "var(--dg-muted)" }}>
        PDF собирается 10–20 секунд.
      </p>
    </div>
  );
}

function CheckItem({ item, open = false }: { item: Check; open?: boolean }) {
  const [expanded, setExpanded] = useState(open);
  return (
    <li className="border-b py-3 last:border-b-0" style={{ borderColor: "var(--dg-line-soft)" }}>
      <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span className="mt-0.5 flex-none">
          <StatusIcon status={item.status} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium" style={{ color: "var(--dg-ink)" }}>
            {item.title}
            {item.source === "ai" && (
              <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--dg-muted)" }}>
                оценка AI по скриншоту
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[13px]" style={{ color: "var(--dg-body)" }}>
            {item.evidence}
          </span>
        </span>
        <ChevronDown size={16} className="mt-1 flex-none" style={{ color: "var(--dg-muted)", transform: expanded ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
      </button>
      {expanded && (
        <div className="mt-3 ml-7 grid gap-3 text-[13px] md:grid-cols-2">
          <div className="dg-tile p-3">
            <div className="dg-eyebrow mb-1">Почему это важно</div>
            <p style={{ color: "var(--dg-body)" }}>{item.why}</p>
          </div>
          <div className="dg-tile p-3">
            <div className="dg-eyebrow mb-1">Что исправить</div>
            <p style={{ color: "var(--dg-body)" }}>{item.status === "pass" ? "Ничего — проверка пройдена." : item.fix}</p>
          </div>
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer noopener" className="dg-mono inline-flex items-center gap-1.5 text-xs md:col-span-2" style={{ color: "var(--dg-muted)" }}>
              <ExternalLink size={12} />
              {item.url}
            </a>
          )}
        </div>
      )}
    </li>
  );
}

function CategoryDetail({ category, result }: { category: AuditResult["categories"][number]; result: AuditResult }) {
  const good = category.checks.filter((item) => item.status === "pass");
  const bad = category.checks.filter((item) => item.status === "fail" || item.status === "warn");
  const rest = category.checks.filter((item) => item.status === "unknown" || item.status === "info");
  return (
    <div className={`dg-panel dg-fade mt-4 p-6 ${levelClass(category.score)}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-[20px] font-bold">
            {CATEGORY_LABELS[category.id]} — {category.score === null ? "недостаточно данных" : `${category.score}/100`}
          </h3>
          <p className="mt-1 max-w-[620px] text-sm" style={{ color: "var(--dg-body)" }}>
            {CATEGORY_ABOUT[category.id]} Вес в общей оценке — {CATEGORY_WEIGHTS[category.id]}%.
          </p>
          {category.id === "offer" && result.offer.conclusion && (
            <p className="mt-3 max-w-[680px] text-[15px]" style={{ color: "var(--dg-ink)" }}>
              {result.offer.conclusion}
            </p>
          )}
        </div>
        <LevelBadge score={category.score} />
      </div>
      <h4 className="mt-6 text-[15px] font-semibold">Почему такой балл?</h4>
      <div className="mt-3 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-sm font-medium" style={{ color: "var(--dg-excellent)" }}>
            Что хорошо · {good.length}
          </div>
          {good.length ? (
            <ul>{good.map((item) => <CheckItem key={item.id} item={item} />)}</ul>
          ) : (
            <p className="py-3 text-sm" style={{ color: "var(--dg-muted)" }}>
              Пройденных проверок нет.
            </p>
          )}
        </div>
        <div>
          <div className="mb-1 text-sm font-medium" style={{ color: "var(--dg-fair)" }}>
            {category.score !== null && category.score >= 90 ? "Что ещё можно улучшить" : "Что мешает получить 90+"} · {bad.length}
          </div>
          {bad.length ? (
            <ul>{bad.map((item) => <CheckItem key={item.id} item={item} />)}</ul>
          ) : (
            <p className="py-3 text-sm" style={{ color: "var(--dg-muted)" }}>
              Проблем не найдено.
            </p>
          )}
        </div>
      </div>
      {rest.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-sm font-medium" style={{ color: "var(--dg-muted)" }}>
            Не проверяется автоматически · {rest.length}
          </div>
          <ul>{rest.map((item) => <CheckItem key={item.id} item={item} />)}</ul>
        </div>
      )}
    </div>
  );
}

function PriorityCard({ item, index }: { item: Priority; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`dg-panel p-5 ${SEVERITY_LEVEL[item.severity]}`}>
      <div className="flex items-start gap-4">
        <span className="dg-mono flex h-8 w-8 flex-none items-center justify-center rounded-lg text-sm" style={{ background: "var(--bg-layer)", color: "var(--dg-ink)" }}>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-2 text-xs font-semibold dg-lvl-text">
            <span className="dg-dot" />
            {SEVERITY_LABELS[item.severity]}
            <span className="font-normal" style={{ color: "var(--dg-muted)" }}>
              · {CATEGORY_LABELS[item.category]}
            </span>
          </span>
          <h3 className="mt-1.5 text-[17px] font-semibold">{item.fix.split(".")[0]}</h3>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--dg-body)" }}>
            {item.why}
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-xs sm:max-w-[460px]">
            <div>
              <dt style={{ color: "var(--dg-muted)" }}>Влияние</dt>
              <dd className="mt-0.5 font-semibold" style={{ color: "var(--dg-ink)" }}>
                {LEVEL_WORDS[item.impact]}
              </dd>
            </div>
            <div>
              <dt style={{ color: "var(--dg-muted)" }}>Сложность</dt>
              <dd className="mt-0.5 font-semibold" style={{ color: "var(--dg-ink)" }}>
                {EFFORT_WORDS[item.effort]}
              </dd>
            </div>
            <div>
              <dt style={{ color: "var(--dg-muted)" }}>Эффект</dt>
              <dd className="mt-0.5 font-semibold" style={{ color: "var(--dg-ink)" }}>
                {item.ice >= 2.5 ? "Высокий" : item.ice >= 1.2 ? "Средний" : "Умеренный"}
              </dd>
            </div>
          </dl>
          <button type="button" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--dg-accent)" }} onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "Свернуть" : "Подробнее"}
            <ArrowRight size={14} style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform 0.2s" }} />
          </button>
          {open && (
            <div className="mt-3 grid gap-3 text-[13px] md:grid-cols-2">
              <div className="dg-tile p-3">
                <div className="dg-eyebrow mb-1">Обнаружено</div>
                <p className="dg-mono" style={{ color: "var(--dg-ink)" }}>
                  {item.evidence}
                </p>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer noopener" className="dg-mono mt-2 inline-flex items-center gap-1 text-xs break-all" style={{ color: "var(--dg-muted)" }}>
                    <ExternalLink size={12} />
                    {item.url}
                  </a>
                )}
              </div>
              <div className="dg-tile p-3">
                <div className="dg-eyebrow mb-1">Рекомендация</div>
                <p style={{ color: "var(--dg-body)" }}>{item.fix}</p>
                <p className="mt-2 text-xs" style={{ color: "var(--dg-muted)" }}>
                  {item.confidence < 1 ? "Основание: оценка AI по скриншоту и тексту страницы." : "Основание: автоматическая проверка страницы."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

const MARK_LABELS: Record<FoldMark["kind"], string> = { h1: "H1", cta: "CTA", phone: "Телефон", form: "Форма", trust: "Доверие" };

function FirstScreen({ result, slug }: { result: AuditResult; slug: string }) {
  const [view, setView] = useState<"desktop" | "mobile">(result.shots.desktop ? "desktop" : "mobile");
  const marks = view === "desktop" ? result.marks.desktop : result.marks.mobile;
  const has = view === "desktop" ? result.shots.desktop : result.shots.mobile;
  const fs = result.firstScreen;
  const rows: [string, number | null][] = [
    ["Понимание предложения", fs.understanding],
    ["CTA", fs.cta],
    ["Доверие", fs.trust],
    ["Визуальная иерархия", fs.hierarchy],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
      <div className="dg-panel p-3">
        <div className="mb-3 flex items-center justify-between px-2 pt-1">
          <div className="flex gap-1.5">
            {(["desktop", "mobile"] as const).map((kind) => (
              <button key={kind} type="button" className="dg-chip" aria-pressed={view === kind} onClick={() => setView(kind)} disabled={!result.shots[kind]}>
                {kind === "desktop" ? "Компьютер" : "Телефон"}
              </button>
            ))}
          </div>
          <div className="hidden flex-wrap gap-3 text-[11px] sm:flex" style={{ color: "var(--dg-muted)" }}>
            {(Object.keys(MARK_LABELS) as FoldMark["kind"][]).map((kind) => (
              <span key={kind} className={`inline-flex items-center gap-1.5 dg-mk-${kind}`}>
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--mk)" }} />
                {MARK_LABELS[kind]}
              </span>
            ))}
          </div>
        </div>
        {has ? (
          <div className={`relative mx-auto overflow-hidden rounded-lg ${view === "mobile" ? "max-w-[300px]" : ""}`} style={{ border: "1px solid var(--dg-line)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/diagnost/${slug}/shot/${view}`} alt={`Первый экран сайта ${result.site.host}`} className="block w-full" />
            {marks
              .filter((mark) => mark.box.y < 1)
              .map((mark, index) => (
                <div
                  key={index}
                  className={`dg-mark dg-mk-${mark.kind}`}
                  style={{ left: `${mark.box.x * 100}%`, top: `${mark.box.y * 100}%`, width: `${mark.box.w * 100}%`, height: `${Math.min(mark.box.h, 1 - mark.box.y) * 100}%` }}
                >
                  <span style={{ top: mark.box.y < 0.04 ? "100%" : undefined }}>{MARK_LABELS[mark.kind]}</span>
                </div>
              ))}
          </div>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-sm" style={{ color: "var(--dg-muted)" }}>
            Скриншот сделать не удалось
          </div>
        )}
      </div>
      <div className={`dg-panel p-6 ${levelClass(result.scores.firstScreen)}`}>
        <h3 className="text-[20px] font-bold">Первый экран — {result.scores.firstScreen === null ? "нет оценки" : `${result.scores.firstScreen}/100`}</h3>
        <ul className="mt-5 space-y-4">
          {rows.map(([label, value]) => (
            <li key={label} className={value === null ? "dg-l-none" : `dg-l-${levelOf(value * 10)}`}>
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--dg-body)" }}>{label}</span>
                <span className="dg-mono font-semibold" style={{ color: "var(--dg-ink)" }}>
                  {value === null ? "—" : `${value}/10`}
                </span>
              </div>
              <div className="dg-bar mt-1.5">
                <span style={{ width: `${(value ?? 0) * 10}%` }} />
              </div>
            </li>
          ))}
        </ul>
        {fs.comment && (
          <p className="mt-5 text-sm leading-relaxed" style={{ color: "var(--dg-body)" }}>
            {fs.comment}
          </p>
        )}
        <div className="mt-5 space-y-1.5 text-[13px]" style={{ color: "var(--dg-body)" }}>
          <div className="flex items-center gap-2">
            <StatusIcon status={marks.some((m) => m.kind === "cta" || m.kind === "form") ? "pass" : "fail"} size={14} />
            Кнопка или форма {marks.some((m) => m.kind === "cta" || m.kind === "form") ? "видна" : "не видна"} без прокрутки
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon status={marks.some((m) => m.kind === "phone") ? "pass" : "warn"} size={14} />
            Телефон {marks.some((m) => m.kind === "phone") ? "виден" : "не виден"} на первом экране
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon status={marks.some((m) => m.kind === "h1") ? "pass" : "warn"} size={14} />
            Заголовок H1 {marks.some((m) => m.kind === "h1") ? "на первом экране" : "не найден на первом экране"}
          </div>
        </div>
        {fs.understanding === null && (
          <p className="mt-4 text-xs" style={{ color: "var(--dg-muted)" }}>
            Оценки 0–10 ставит AI по скриншоту. В этом аудите AI был недоступен — показываем только найденные элементы.
          </p>
        )}
      </div>
    </div>
  );
}

const VERDICT_ORDER: Verdict[] = ["go", "fix", "stop"];

const SHORT_LEVEL: Record<ScoreLevel, string> = { excellent: "Отлично", good: "Хорошо", fair: "Приемлемо", poor: "Доработать", critical: "Критично" };

export default function ResultDashboard({ view }: { view: AuditView }) {
  const result = view.result as AuditResult;
  const [openCat, setOpenCat] = useState<CategoryId | null>(null);
  const level = levelOf(result.scores.overall);
  const prev = view.prev;
  const fixCount = result.priorities.filter((item) => item.severity !== "minor").length;
  const openCategory = result.categories.find((category) => category.id === openCat);
  const profile: [string, string | null][] = [
    ["Тип бизнеса", `${BUSINESS_LABELS[result.site.businessType]}${result.site.businessSource === "user" ? " · указан вами" : result.site.businessSource === "heuristic" ? " · по признакам" : ""}`],
    ["Ниша", result.site.niche],
    ["Аудитория", result.site.audience],
    ["Целевое действие", result.site.targetAction],
    ["Источник трафика", result.site.trafficSource],
  ];

  return (
    <main className="mx-auto max-w-[1240px] px-5 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="min-w-0">
          <div className="dg-mono truncate text-sm" style={{ color: "var(--dg-accent)" }}>
            {result.site.finalUrl}
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--dg-muted)" }}>
            Аудит от {formatDate(view.createdAt)} · проверено страниц: {result.pages.length}
          </div>
        </div>
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={`dg-panel flex flex-col items-center p-6 pb-8 md:p-8 dg-l-${level}`}>
          <div className="dg-eyebrow self-start">Website Score</div>
          <Gauge value={result.scores.overall} size={400} />
          <h1 className="mt-1 text-center text-[24px] font-bold md:text-[28px]">{LEVEL_HEADLINES[level]}</h1>
          <div className="mt-3">
            <LevelBadge score={result.scores.overall} />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="dg-panel p-6">
            <div className="dg-eyebrow">Ad Readiness · готовность к рекламе</div>
            <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
              <div className={`text-[64px] leading-none font-extrabold ${levelClass(result.scores.adReadiness)}`} style={{ fontFamily: "var(--font-montserrat)" }}>
                <span className="dg-lvl-text">{result.scores.adReadiness}%</span>
              </div>
              <ul className="space-y-1.5 pb-1 text-sm">
                {VERDICT_ORDER.map((verdict) => (
                  <li key={verdict} className={`flex items-center gap-2 ${verdict === "go" ? "dg-l-excellent" : verdict === "fix" ? "dg-l-fair" : "dg-l-critical"}`} style={{ opacity: verdict === result.verdict ? 1 : 0.38 }}>
                    <span className="dg-dot" />
                    <span style={{ color: "var(--dg-ink)", fontWeight: verdict === result.verdict ? 600 : 400 }}>{VERDICT_LABELS[verdict]}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-4 text-sm" style={{ color: "var(--dg-body)" }}>
              {result.criticalCount
                ? `${plural(result.criticalCount, ["Найдена", "Найдены", "Найдено"])} ${result.criticalCount} ${plural(result.criticalCount, ["критичная проблема", "критичные проблемы", "критичных проблем"])} — ${result.criticalCount === 1 ? "её" : "их"} лучше исправить до запуска.`
                : fixCount
                  ? `Критичных проблем нет. Есть ${fixCount} ${plural(fixCount, ["важный пункт", "важных пункта", "важных пунктов"])} для улучшения.`
                  : "Критичных проблем не найдено."}
            </p>
          </div>
          <div className="dg-panel p-6">
            <div className="dg-eyebrow mb-3">Профиль сайта</div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
              {profile.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs" style={{ color: "var(--dg-muted)" }}>
                    {label}
                  </dt>
                  <dd className="mt-0.5" style={{ color: value ? "var(--dg-ink)" : "var(--dg-muted)" }}>
                    {value || "Не определено"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="dg-panel mt-6 p-6 md:p-7">
        <div className="flex items-center gap-2.5">
          <Sparkles size={18} style={{ color: "var(--dg-accent)" }} />
          <h2 className="text-[18px] font-bold">{result.ai.model ? "AI-рекомендация" : "Сводка по фактам"}</h2>
          <span className="text-xs" style={{ color: "var(--dg-muted)" }}>
            {result.ai.model ? `DeepSeek · на основе собранных фактов` : "AI недоступен — текст собран из проверок"}
          </span>
        </div>
        <p className="mt-3 max-w-[920px] text-[16px] leading-relaxed" style={{ color: "var(--dg-ink)" }}>
          {result.summary}
        </p>
        <div className="mt-5">
          <Actions result={result} slug={view.slug} url={view.url} />
        </div>
      </section>

      {prev?.overall != null && (
        <section className="dg-panel mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[18px] font-bold">Было → Стало</h2>
            <a href={`/diagnost/r/${prev.slug}`} className="dg-link text-sm">
              Прошлый аудит от {formatDate(prev.createdAt)}
            </a>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Website Score", prev.overall, result.scores.overall, ""],
              ["Ad Readiness", prev.adReadiness, result.scores.adReadiness, "%"],
            ].map(([label, from, to, unit]) => (
              <div key={label as string} className="dg-tile p-4">
                <div className="text-xs" style={{ color: "var(--dg-muted)" }}>
                  {label}
                </div>
                <div className="dg-mono mt-1 text-[22px]" style={{ color: "var(--dg-ink)" }}>
                  {from ?? "—"}
                  {unit} → {to}
                  {unit}
                </div>
                <Delta from={from as number | null} to={to as number} unit={unit as string} />
              </div>
            ))}
            {prev.result &&
              result.categories
                .map((category) => ({ category, before: prev.result?.scores[category.id] ?? null }))
                .filter(({ category, before }) => before !== null && category.score !== null && before !== category.score)
                .slice(0, 2)
                .map(({ category, before }) => (
                  <div key={category.id} className="dg-tile p-4">
                    <div className="text-xs" style={{ color: "var(--dg-muted)" }}>
                      {CATEGORY_LABELS[category.id]}
                    </div>
                    <div className="dg-mono mt-1 text-[22px]" style={{ color: "var(--dg-ink)" }}>
                      {before} → {category.score}
                    </div>
                    <Delta from={before} to={category.score} />
                  </div>
                ))}
          </div>
        </section>
      )}

      <Section id="categories" title="Оценка по направлениям" lead="Нажмите на карточку, чтобы увидеть, что проверено, что найдено и что исправить.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {result.categories.map((category) => {
            const Icon = CATEGORY_ICONS[category.id];
            const open = openCat === category.id;
            return (
              <button
                key={category.id}
                type="button"
                className={`dg-panel dg-card-btn p-4 ${levelClass(category.score)}`}
                aria-expanded={open}
                onClick={() => setOpenCat(open ? null : category.id)}
              >
                <div className="flex items-center justify-between">
                  <Icon size={18} style={{ color: "var(--dg-muted)" }} />
                  <span className="dg-mono text-[10px]" style={{ color: "var(--dg-muted)" }}>
                    {CATEGORY_WEIGHTS[category.id]}%
                  </span>
                </div>
                <div className="mt-3 text-[13px]" style={{ color: "var(--dg-body)" }}>
                  {category.id === "analytics" ? "Реклама" : CATEGORY_LABELS[category.id]}
                </div>
                <div className="mt-0.5">
                  <ScoreText score={category.score} />
                </div>
                <div className="dg-bar mt-3">
                  <span style={{ width: `${category.score ?? 0}%` }} />
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] dg-lvl-text">
                  <span className="dg-dot" />
                  {category.level ? SHORT_LEVEL[category.level] : "Нет данных"}
                </div>
              </button>
            );
          })}
        </div>
        {openCategory && <CategoryDetail category={openCategory} result={result} />}
      </Section>

      {result.priorities.length > 0 && (
        <Section
          title="Что даст максимальный эффект"
          icon={Zap}
          lead="Отсортировано не по технической важности, а по ожидаемому влиянию на рекламный трафик: влияние × уверенность ÷ сложность."
        >
          <ol className="grid gap-3 lg:grid-cols-2">
            {result.priorities.map((item, index) => (
              <PriorityCard key={item.checkId} item={item} index={index} />
            ))}
          </ol>
        </Section>
      )}

      <Section title="Что это значит для рекламы" icon={Target}>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="dg-panel p-6">
            <p className="text-[16px] leading-relaxed" style={{ color: "var(--dg-ink)" }}>
              {result.ads.comment}
            </p>
            <h3 className="mt-6 text-[15px] font-semibold">Можно запускать рекламу?</h3>
            <div className="mt-2">
              <VerdictBadge verdict={result.verdict} text={result.ads.verdictText} />
            </div>
            {result.ads.risks.length > 0 && (
              <>
                <h3 className="mt-6 text-[15px] font-semibold">Основные риски</h3>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm" style={{ color: "var(--dg-body)" }}>
                  {result.ads.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ol>
              </>
            )}
          </div>
          <div className="dg-panel p-6">
            <h3 className="text-[15px] font-semibold">Что сделать до запуска</h3>
            <ul className="mt-3 space-y-2.5">
              {result.ads.beforeLaunch.map((step) => (
                <li key={step} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--dg-body)" }}>
                  <CheckCircle2 size={16} className="mt-0.5 flex-none" style={{ color: "var(--dg-accent)" }} />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Анализ первого экрана" icon={MousePointerClick} lead="Что видит посетитель из рекламы в первые секунды — без прокрутки.">
        <FirstScreen result={result} slug={view.slug} />
      </Section>

      {result.strengths.length > 0 && (
        <Section title="Сильные стороны" icon={CheckCircle2}>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {result.strengths.map((item) => (
              <li key={item.id} className="dg-panel flex items-start gap-3 p-4">
                <CheckCircle2 size={18} className="mt-0.5 flex-none" style={{ color: "var(--dg-excellent)" }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--dg-ink)" }}>
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-[13px]" style={{ color: "var(--dg-body)" }}>
                    {item.evidence}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.perf && (
        <Section title="Замеры скорости" icon={GaugeIcon} lead="Лабораторный замер в браузере с нашего сервера. Это не данные реальных посетителей, но хорошо показывает тяжёлые места.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Главный блок (LCP)", result.perf.lcpMs, (v: number) => `${(v / 1000).toFixed(1).replace(".", ",")} с`],
              ["Первое отображение", result.perf.fcpMs, (v: number) => `${(v / 1000).toFixed(1).replace(".", ",")} с`],
              ["Сдвиги вёрстки (CLS)", result.perf.cls, (v: number) => String(v).replace(".", ",")],
              ["Ответ сервера", result.perf.ttfbMs, (v: number) => `${v} мс`],
              ["Вес страницы", result.perf.transferKb, (v: number) => (v >= 1024 ? `${(v / 1024).toFixed(1).replace(".", ",")} МБ` : `${v} КБ`)],
              ["Запросов", result.perf.requests, (v: number) => String(v)],
              ["Скрипты", result.perf.jsKb, (v: number) => `${v} КБ`],
              ["Изображения", result.perf.imgKb, (v: number) => (v >= 1024 ? `${(v / 1024).toFixed(1).replace(".", ",")} МБ` : `${v} КБ`)],
            ].map(([label, value, format]) => (
              <div key={label as string} className="dg-tile p-4">
                <div className="text-xs" style={{ color: "var(--dg-muted)" }}>
                  {label as string}
                </div>
                <div className="dg-mono mt-1 text-[20px]" style={{ color: "var(--dg-ink)" }}>
                  {value === null ? "Недостаточно данных" : (format as (v: number) => string)(value as number)}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <section className="dg-panel mt-16 p-8 md:p-10">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="text-[30px] font-bold leading-tight md:text-[36px]">
              Ваш сайт готов к рекламе на <span className={`${levelClass(result.scores.adReadiness)} dg-lvl-text`}>{result.scores.adReadiness}%</span>
            </h2>
            <p className="mt-3 text-[16px]" style={{ color: "var(--dg-body)" }}>
              {fixCount
                ? `До запуска рекомендуется исправить ${fixCount} ${plural(fixCount, ["проблему", "проблемы", "проблем"])}.`
                : "Серьёзных проблем нет — можно запускать рекламу и сравнивать стоимость заявки."}
            </p>
            <div className="mt-6">
              <Actions result={result} slug={view.slug} url={view.url} />
            </div>
          </div>
          <div>
            <h3 className="text-[16px] font-semibold">Что делать дальше?</h3>
            <ol className="mt-4 space-y-3">
              {["Исправить критичные проблемы", "Повторить аудит", "Запустить рекламную кампанию", "Сравнить результат: было → стало"].map((step, index) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="dg-mono flex h-8 w-8 flex-none items-center justify-center rounded-lg text-sm" style={{ background: "var(--bg-layer)", color: "var(--dg-ink)" }}>
                    {index + 1}
                  </span>
                  <span className="text-[15px]" style={{ color: "var(--dg-ink)" }}>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}
