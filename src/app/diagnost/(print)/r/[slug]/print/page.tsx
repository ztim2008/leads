import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Gauge from "@/components/diagnost/gauge";
import { getAuditView } from "@/lib/diagnost/data";
import { EFFORT_WORDS, LEVEL_HEADLINES, LEVEL_LABELS, LEVEL_WORDS, levelOf, SEVERITY_LABELS, VERDICT_LABELS } from "@/lib/diagnost/levels";
import {
  BUSINESS_LABELS,
  CATEGORY_ABOUT,
  CATEGORY_LABELS,
  CATEGORY_WEIGHTS,
  type AuditResult,
  type CategoryId,
  type Check,
  type CheckStatus,
  type Priority,
  type Severity,
} from "@/lib/diagnost/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ kind?: string }> };

const STATUS_TEXT: Record<CheckStatus, string> = { pass: "Хорошо", warn: "Частично", fail: "Проблема", unknown: "Не проверено", info: "Справка" };
const STATUS_LEVEL: Record<CheckStatus, string> = { pass: "dg-l-excellent", warn: "dg-l-fair", fail: "dg-l-critical", unknown: "dg-l-none", info: "dg-l-none" };
const SEVERITY_LEVEL: Record<Severity, string> = { critical: "dg-l-critical", important: "dg-l-poor", minor: "dg-l-fair" };

function lvl(score: number | null) {
  return score === null ? "dg-l-none" : `dg-l-${levelOf(score)}`;
}

function date(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" }).format(new Date(iso));
}

function Status({ status }: { status: CheckStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${STATUS_LEVEL[status]}`}>
      <span className="dg-dot" />
      {STATUS_TEXT[status]}
    </span>
  );
}

function Footer({ host, label }: { host: string; label: string }) {
  return (
    <div className="dgp-footer">
      <span>{label}</span>
      <span>{host} · Техосмотр сайта · Konversus</span>
    </div>
  );
}

function SectionHead({ num, title }: { num: string; title: string }) {
  return (
    <>
      <div className="dgp-num">{num}</div>
      <h2 className="dgp-h2">{title}</h2>
    </>
  );
}

function ScoreRow({ result }: { result: AuditResult }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {result.categories.map((category) => (
        <div key={category.id} className={`dgp-box text-center ${lvl(category.score)}`} style={{ padding: "10px 6px" }}>
          <div className="text-[10px]" style={{ color: "var(--dg-muted)" }}>
            {CATEGORY_LABELS[category.id]}
          </div>
          <div className="dg-mono mt-1 text-[20px] font-semibold" style={{ color: "var(--dg-ink)" }}>
            {category.score ?? "—"}
          </div>
          <div className="mt-1 flex items-center justify-center gap-1 text-[9.5px] dg-lvl-text">
            <span className="dg-dot" />
            {category.level ? LEVEL_LABELS[category.level] : "Нет данных"}
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryBlock({ result, ids, full }: { result: AuditResult; ids: CategoryId[]; full: boolean }) {
  return (
    <>
      {ids.map((id) => {
        const category = result.categories.find((item) => item.id === id);
        if (!category) return null;
        const checks = full ? category.checks : category.checks.filter((item) => item.status !== "unknown" && item.weight > 0);
        return (
          <section key={id} className="mb-6">
            <div className={`flex items-baseline justify-between ${lvl(category.score)}`}>
              <h3 className="text-[16px] font-bold">{CATEGORY_LABELS[id]}</h3>
              <span className="dg-mono text-[14px] font-semibold dg-lvl-text">{category.score === null ? "Недостаточно данных" : `${category.score}/100`}</span>
            </div>
            <p className="mb-2 text-[11.5px]" style={{ color: "var(--dg-muted)" }}>
              {CATEGORY_ABOUT[id]} Вес — {CATEGORY_WEIGHTS[id]}%.
            </p>
            {id === "offer" && result.offer.conclusion && <p className="mb-2">{result.offer.conclusion}</p>}
            <table className="dgp-table">
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Проверка</th>
                  <th style={{ width: "12%" }}>Итог</th>
                  <th>Что найдено</th>
                  {full && <th style={{ width: "28%" }}>Что сделать</th>}
                </tr>
              </thead>
              <tbody>
                {checks.map((item) => (
                  <tr key={item.id}>
                    <td style={{ color: "var(--dg-ink)", fontWeight: 600 }}>{item.title}</td>
                    <td>
                      <Status status={item.status} />
                    </td>
                    <td>
                      {item.evidence}
                      {full && item.url && (
                        <div className="dg-mono mt-1 text-[10px] break-all" style={{ color: "var(--dg-muted)" }}>
                          {item.url}
                        </div>
                      )}
                    </td>
                    {full && <td>{item.status === "pass" ? "—" : item.fix}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </>
  );
}

function plan(priorities: Priority[], checks: Check[]) {
  const now = priorities.filter((item) => item.severity === "critical" || (item.severity === "important" && item.effort === "low"));
  const after = priorities.filter((item) => !now.includes(item) && item.severity === "important");
  const usedIds = new Set([...now, ...after].map((item) => item.checkId));
  const month = checks.filter((item) => (item.status === "fail" || item.status === "warn") && item.weight > 0 && !usedIds.has(item.id)).slice(0, 6);
  return { now, after, month };
}

function ClientReport({ result, createdAt }: { result: AuditResult; createdAt: string }) {
  const level = levelOf(result.scores.overall);
  const allChecks = result.categories.flatMap((category) => category.checks);
  const problems = allChecks.filter((item) => item.status === "fail" && item.weight > 0).sort((a, b) => (a.severity === b.severity ? b.weight - a.weight : a.severity === "critical" ? -1 : b.severity === "critical" ? 1 : a.severity === "important" ? -1 : 1));
  const steps = plan(result.priorities, allChecks);
  const label = "Аудит сайта · отчёт для клиента";

  return (
    <>
      <div className="dgp-page flex flex-col" style={{ background: "linear-gradient(160deg, color-mix(in oklab, var(--green) 10%, white), white 55%)" }}>
        <div className="dgp-num">ТЕХОСМОТР САЙТА ПЕРЕД РЕКЛАМОЙ</div>
        <div className="mt-auto mb-auto">
          <div className="dg-mono text-[15px]" style={{ color: "var(--dg-accent)" }}>
            {result.site.host}
          </div>
          <h1 className="mt-3 text-[54px] leading-[1.02] font-extrabold">Аудит сайта</h1>
          <p className="mt-4 max-w-[130mm] text-[16px]" style={{ color: "var(--dg-body)" }}>
            Насколько сайт готов принимать рекламный трафик и превращать его в заявки
          </p>
          <div className="mt-10 flex gap-10">
            <div>
              <div className="text-[11px]" style={{ color: "var(--dg-muted)" }}>
                Website Score
              </div>
              <div className={`dg-mono text-[34px] font-semibold ${lvl(result.scores.overall)}`}>
                <span className="dg-lvl-text">{result.scores.overall}</span>
                <span className="text-[14px]" style={{ color: "var(--dg-muted)" }}>
                  /100
                </span>
              </div>
            </div>
            <div>
              <div className="text-[11px]" style={{ color: "var(--dg-muted)" }}>
                Готовность к рекламе
              </div>
              <div className={`dg-mono text-[34px] font-semibold ${lvl(result.scores.adReadiness)}`}>
                <span className="dg-lvl-text">{result.scores.adReadiness}%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between text-[11px]" style={{ color: "var(--dg-muted)" }}>
          <span>{date(createdAt)}</span>
          <span>Konversus · leads.konversus.ru/diagnost</span>
        </div>
      </div>

      <div className="dgp-page">
        <SectionHead num="01" title="Итог" />
        <div className={`flex flex-col items-center dg-l-${level}`}>
          <Gauge value={result.scores.overall} size={420} animate={false} />
          <div className="mt-1 text-[11px]" style={{ color: "var(--dg-muted)" }}>
            Website Readiness
          </div>
          <h3 className="mt-3 text-center text-[22px] font-bold">{LEVEL_HEADLINES[level]}</h3>
          <div className="mt-2 flex items-center gap-2 text-[13px] dg-lvl-text">
            <span className="dg-dot" />
            {LEVEL_LABELS[level]}
          </div>
        </div>
        <div className="dgp-rule" />
        <ScoreRow result={result} />
        <div className="dgp-box mt-6">
          <div className="text-[11px]" style={{ color: "var(--dg-muted)" }}>
            Готовность к рекламе
          </div>
          <div className="mt-1 flex items-baseline gap-4">
            <span className={`dg-mono text-[28px] font-semibold ${lvl(result.scores.adReadiness)}`}>
              <span className="dg-lvl-text">{result.scores.adReadiness}%</span>
            </span>
            <span className="text-[14px] font-semibold" style={{ color: "var(--dg-ink)" }}>
              {result.ads.verdictText}
            </span>
          </div>
        </div>

        <div className="dgp-rule" />
        <SectionHead num="02" title="Ключевые выводы" />
        <p className="text-[14px] leading-relaxed" style={{ color: "var(--dg-ink)" }}>
          {result.summary}
        </p>
        <ul className="mt-3 space-y-1.5">
          {result.priorities.slice(0, 4).map((item) => (
            <li key={item.checkId} className="flex items-start gap-2">
              <span className={`mt-1.5 ${SEVERITY_LEVEL[item.severity]}`}>
                <span className="dg-dot" />
              </span>
              <span>
                <b style={{ color: "var(--dg-ink)" }}>{item.title}.</b> {item.evidence}
              </span>
            </li>
          ))}
        </ul>
        <Footer host={result.site.host} label={label} />
      </div>

      <div className="dgp-flow">
        <section className="mb-8">
          <SectionHead num="03" title="Что хорошо" />
          <div className="grid grid-cols-2 gap-2.5">
            {result.strengths.slice(0, 6).map((item) => (
              <div key={item.id} className="dgp-box dg-l-excellent">
                <div className="flex items-center gap-2 font-semibold" style={{ color: "var(--dg-ink)" }}>
                  <span className="dg-dot" />
                  {item.title}
                </div>
                <div className="mt-1 text-[11.5px]">{item.evidence}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <SectionHead num="04" title="Что мешает росту" />
          <div className="space-y-2.5">
            {problems.slice(0, 5).map((item) => (
              <div key={item.id} className={`dgp-box ${SEVERITY_LEVEL[item.severity]}`}>
                <div className="flex items-center gap-2 font-semibold" style={{ color: "var(--dg-ink)" }}>
                  <span className="dg-dot" />
                  {item.title}
                  <span className="text-[10.5px] font-normal dg-lvl-text">· {SEVERITY_LABELS[item.severity]}</span>
                </div>
                <div className="mt-1 text-[11.5px]">{item.evidence}</div>
                <div className="mt-1 text-[11.5px]" style={{ color: "var(--dg-muted)" }}>
                  {item.why}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <SectionHead num="05" title="Приоритетные рекомендации" />
          <table className="dgp-table">
            <thead>
              <tr>
                <th style={{ width: "26%" }}>Проблема</th>
                <th style={{ width: "13%" }}>Приоритет</th>
                <th>Рекомендация</th>
                <th style={{ width: "14%" }}>Потенциальный эффект</th>
              </tr>
            </thead>
            <tbody>
              {result.priorities.map((item) => (
                <tr key={item.checkId}>
                  <td style={{ color: "var(--dg-ink)", fontWeight: 600 }}>{item.title}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 ${SEVERITY_LEVEL[item.severity]}`}>
                      <span className="dg-dot" />
                      {SEVERITY_LABELS[item.severity]}
                    </span>
                  </td>
                  <td>{item.fix}</td>
                  <td>{item.ice >= 2.5 ? "Высокий" : item.ice >= 1.2 ? "Средний" : "Умеренный"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mb-2">
          <SectionHead num="06" title="UX и конверсия" />
        </section>
        <CategoryBlock result={result} ids={["conversion", "offer", "ux"]} full={false} />
        <section className="mb-2">
          <SectionHead num="07" title="SEO" />
        </section>
        <CategoryBlock result={result} ids={["seo"]} full={false} />
        <section className="mb-2">
          <SectionHead num="08" title="Скорость" />
        </section>
        <CategoryBlock result={result} ids={["performance"]} full={false} />
        <section className="mb-2">
          <SectionHead num="09" title="Доверие" />
        </section>
        <CategoryBlock result={result} ids={["trust"]} full={false} />

        <section className="mt-4">
          <SectionHead num="10" title="План действий" />
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Сейчас", "до запуска рекламы", steps.now],
              ["После запуска", "первые 1–2 недели", steps.after],
              ["В течение месяца", "системные улучшения", steps.month],
            ].map(([title, sub, items]) => (
              <div key={title as string} className="dgp-box">
                <div className="text-[14px] font-bold" style={{ color: "var(--dg-ink)" }}>
                  {title as string}
                </div>
                <div className="mb-2 text-[10.5px]" style={{ color: "var(--dg-muted)" }}>
                  {sub as string}
                </div>
                <ul className="space-y-1.5 text-[11.5px]">
                  {(items as (Priority | Check)[]).length ? (
                    (items as (Priority | Check)[]).map((item) => <li key={"checkId" in item ? item.checkId : item.id}>— {item.fix.split(".")[0]}</li>)
                  ) : (
                    <li style={{ color: "var(--dg-muted)" }}>Пунктов нет</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[10.5px]" style={{ color: "var(--dg-muted)" }}>
            Отчёт собран автоматически: ответ сервера, HTML, скриншоты в браузере и замеры скорости. Оценки оффера и первого экрана сделаны AI только по скриншотам и тексту страницы. Если показатель не удалось измерить, он помечен «Недостаточно данных».
          </p>
        </section>
      </div>
    </>
  );
}

function ProReport({ result, createdAt, slug }: { result: AuditResult; createdAt: string; slug: string }) {
  const allChecks = result.categories.flatMap((category) => category.checks);
  const perf = result.perf;
  const checklist = [
    result.categories.find((c) => c.id === "analytics")?.checks.find((c) => c.id === "an.metrika")?.status === "pass" ? "Проверить Метрику: счётчик на всех страницах" : "Установить Яндекс.Метрику",
    "Настроить цели: форма, звонок, мессенджер, корзина",
    "Проверить формы: отправка, письмо, страница благодарности",
    "Проверить мобильную версию на реальном телефоне",
    "Исправить CTA на первом экране",
    "Проверить UTM-метки в ссылках объявлений",
    "Проверить страницы входа под каждую группу объявлений",
    "Проверить скорость главной и посадочных страниц",
    "Проверить robots.txt и sitemap.xml",
  ];
  return (
    <div className="dgp-flow">
      <section>
        <div className="dgp-num">INTERNAL · ДЛЯ ДИРЕКТОЛОГА</div>
        <h1 className="mt-1 text-[30px] font-extrabold">Website Audit — Internal Report</h1>
        <div className="dg-mono mt-1 text-[12px]" style={{ color: "var(--dg-accent)" }}>
          {result.site.finalUrl}
        </div>
        <div className="mt-1 text-[11px]" style={{ color: "var(--dg-muted)" }}>
          {date(createdAt)} · страниц проверено: {result.pages.length} · AI: {result.ai.model || `нет (${result.ai.error || "недоступен"})`} · отчёт /diagnost/r/{slug}
        </div>
        {result.ai.usage && (
          <div className="mt-0.5 text-[11px]" style={{ color: "var(--dg-muted)" }}>
            Токены AI: {(result.ai.usage.promptTokens + result.ai.usage.completionTokens).toLocaleString("ru-RU")} (вход {result.ai.usage.promptTokens.toLocaleString("ru-RU")}, ответ{" "}
            {result.ai.usage.completionTokens.toLocaleString("ru-RU")}, из них размышления {result.ai.usage.reasoningTokens.toLocaleString("ru-RU")}) · ≈ ${result.ai.usage.costUsd.toFixed(4)}
            {result.ai.reused?.vision ? " · анализ скриншотов взят из прошлого аудита" : ""}
            {result.ai.reused?.summary ? " · сводка взята из прошлого аудита" : ""}
          </div>
        )}
      </section>

      <section className="mt-5 grid grid-cols-[1fr_1.2fr] gap-5">
        <div className={`dgp-box flex flex-col items-center ${lvl(result.scores.overall)}`}>
          <Gauge value={result.scores.overall} size={250} animate={false} />
          <div className="text-[11px]" style={{ color: "var(--dg-muted)" }}>
            Website Score
          </div>
        </div>
        <div className="space-y-3">
          <div className="dgp-box">
            <div className="text-[11px]" style={{ color: "var(--dg-muted)" }}>
              Ad Readiness
            </div>
            <div className={`dg-mono text-[26px] font-semibold ${lvl(result.scores.adReadiness)}`}>
              <span className="dg-lvl-text">{result.scores.adReadiness}%</span>
              <span className="ml-3 text-[13px]" style={{ color: "var(--dg-ink)", fontFamily: "var(--font-sans)" }}>
                {VERDICT_LABELS[result.verdict]}
              </span>
            </div>
            <div className="mt-1 text-[11.5px]">{result.ads.verdictText}. Критичных проблем: {result.criticalCount}.</div>
          </div>
          <div className="dgp-box text-[11.5px]">
            <div>
              <b style={{ color: "var(--dg-ink)" }}>Тип:</b> {BUSINESS_LABELS[result.site.businessType]} ({result.site.businessSource === "user" ? "указан" : result.site.businessSource === "ai" ? "AI" : "эвристика"})
            </div>
            <div>
              <b style={{ color: "var(--dg-ink)" }}>Ниша:</b> {result.site.niche || "—"} · <b style={{ color: "var(--dg-ink)" }}>Аудитория:</b> {result.site.audience || "—"}
            </div>
            <div>
              <b style={{ color: "var(--dg-ink)" }}>Целевое действие:</b> {result.site.targetAction || "—"}
            </div>
            <div>
              <b style={{ color: "var(--dg-ink)" }}>Title:</b> {result.site.title || "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <ScoreRow result={result} />
      </section>

      <section className="mt-6">
        <h2 className="dgp-h2">Резюме и рекламные риски</h2>
        <p style={{ color: "var(--dg-ink)" }}>{result.summary}</p>
        <p className="mt-2">{result.ads.comment}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="dgp-box">
            <div className="font-semibold" style={{ color: "var(--dg-ink)" }}>
              Риски
            </div>
            <ol className="mt-1 list-decimal pl-4">
              {result.ads.risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ol>
          </div>
          <div className="dgp-box">
            <div className="font-semibold" style={{ color: "var(--dg-ink)" }}>
              До запуска
            </div>
            <ul className="mt-1 space-y-0.5">
              {result.ads.beforeLaunch.map((step) => (
                <li key={step}>— {step}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="dgp-h2">Приоритеты (Impact × Confidence ÷ Effort)</h2>
        <table className="dgp-table">
          <thead>
            <tr>
              <th style={{ width: "4%" }}>#</th>
              <th style={{ width: "22%" }}>Проблема</th>
              <th style={{ width: "11%" }}>Приоритет</th>
              <th>Evidence</th>
              <th style={{ width: "9%" }}>Impact</th>
              <th style={{ width: "9%" }}>Effort</th>
              <th style={{ width: "7%" }}>ICE</th>
            </tr>
          </thead>
          <tbody>
            {result.priorities.map((item, index) => (
              <tr key={item.checkId}>
                <td className="dg-mono">{index + 1}</td>
                <td style={{ color: "var(--dg-ink)", fontWeight: 600 }}>
                  {item.title}
                  <div className="text-[10px] font-normal" style={{ color: "var(--dg-muted)" }}>
                    {CATEGORY_LABELS[item.category]}
                    {item.confidence < 1 ? " · AI" : ""}
                  </div>
                </td>
                <td>
                  <span className={`inline-flex items-center gap-1.5 ${SEVERITY_LEVEL[item.severity]}`}>
                    <span className="dg-dot" />
                    {SEVERITY_LABELS[item.severity]}
                  </span>
                </td>
                <td>
                  {item.evidence}
                  <div className="mt-0.5 text-[10.5px]" style={{ color: "var(--dg-muted)" }}>
                    → {item.fix}
                  </div>
                </td>
                <td>{LEVEL_WORDS[item.impact]}</td>
                <td>{EFFORT_WORDS[item.effort]}</td>
                <td className="dg-mono">{item.ice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {result.shots.desktop && (
        <section className="mt-6">
          <h2 className="dgp-h2">Первый экран — {result.scores.firstScreen === null ? "без оценки AI" : `${result.scores.firstScreen}/100`}</h2>
          <div className="grid grid-cols-[1.6fr_1fr] gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/diagnost/${slug}/shot/desktop`} alt="" style={{ width: "100%", border: "1px solid var(--dg-line)", borderRadius: 8 }} />
            <div className="text-[11.5px]">
              {(
                [
                  ["Понимание предложения", result.firstScreen.understanding],
                  ["CTA", result.firstScreen.cta],
                  ["Доверие", result.firstScreen.trust],
                  ["Визуальная иерархия", result.firstScreen.hierarchy],
                ] as [string, number | null][]
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between border-b py-1" style={{ borderColor: "var(--dg-line)" }}>
                  <span>{label}</span>
                  <b className="dg-mono">{value === null ? "—" : `${value}/10`}</b>
                </div>
              ))}
              {result.firstScreen.comment && <p className="mt-2">{result.firstScreen.comment}</p>}
              <p className="mt-2" style={{ color: "var(--dg-muted)" }}>
                Найдено на первом экране: {result.marks.desktop.map((mark) => mark.kind.toUpperCase()).join(", ") || "ничего из CTA, формы, телефона"}.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="dgp-h2">Все проверки</h2>
      </section>
      <CategoryBlock result={result} ids={["conversion", "offer", "ux", "seo", "performance", "trust", "analytics"]} full />

      {perf && (
        <section className="mt-2">
          <h2 className="dgp-h2">Performance — лабораторный замер</h2>
          <table className="dgp-table">
            <tbody>
              {(
                [
                  ["LCP", perf.lcpMs, "мс"],
                  ["FCP", perf.fcpMs, "мс"],
                  ["CLS", perf.cls, ""],
                  ["TTFB", perf.ttfbMs, "мс"],
                  ["Load", perf.loadMs, "мс"],
                  ["Запросов", perf.requests, ""],
                  ["Передано", perf.transferKb, "КБ"],
                  ["JS / CSS / IMG / Fonts", null, ""],
                ] as [string, number | null, string][]
              ).map(([label, value, unit]) => (
                <tr key={label}>
                  <td style={{ width: "30%" }}>{label}</td>
                  <td className="dg-mono">
                    {label.startsWith("JS") ? `${perf.jsKb} / ${perf.cssKb} / ${perf.imgKb} / ${perf.fontKb} КБ` : value === null ? "Недостаточно данных" : `${value} ${unit}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-6">
        <h2 className="dgp-h2">Проверенные страницы</h2>
        <table className="dgp-table">
          <thead>
            <tr>
              <th>URL</th>
              <th style={{ width: "8%" }}>Код</th>
              <th style={{ width: "34%" }}>Title / H1</th>
            </tr>
          </thead>
          <tbody>
            {result.pages.map((page) => (
              <tr key={page.url}>
                <td className="dg-mono text-[10.5px] break-all">{page.url}</td>
                <td className="dg-mono">{page.status || "—"}</td>
                <td className="text-[11px]">
                  {page.title || "—"}
                  {page.h1 && <div style={{ color: "var(--dg-muted)" }}>H1: {page.h1}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="dgp-h2">Pre-launch checklist</h2>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px]">
          {checklist.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className="dgp-check" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[10.5px]" style={{ color: "var(--dg-muted)" }}>
          Методика: 7 категорий с весами (конверсия 25, оффер 20, UX 15, SEO 15, скорость 10, доверие 10, аналитика 5). Проверка: да = 1, частично = 0,5, нет = 0; непроверенное исключается из знаменателя. Ad Readiness: конверсия 35, аналитика 25, оффер 15, UX 15, скорость 10, с ограничением блокерами. Всего проверок: {allChecks.length}.
        </p>
      </section>
    </div>
  );
}

export default async function PrintPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { kind } = await searchParams;
  const view = await getAuditView(slug);
  if (!view?.result) notFound();
  return kind === "pro" ? <ProReport result={view.result} createdAt={view.createdAt} slug={slug} /> : <ClientReport result={view.result} createdAt={view.createdAt} />;
}
