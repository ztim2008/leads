"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Download, Loader2, Monitor, Smartphone } from "lucide-react";
import { exportShot } from "@/components/rentgen/export-shot";
import ShotOverlay, { type OverlayGroup, type OverlayItem } from "@/components/rentgen/shot-overlay";
import { reachGoal } from "@/lib/metrika";
import StartForm from "@/components/rentgen/start-form";
import type { PublicView, ScanView as View } from "@/lib/rentgen/data";
import { GROUP_OF, GROUPS, ISSUE_RULES, MINOR_RULES, type Group } from "@/lib/rentgen/groups";
import type { ViewKind } from "@/lib/rentgen/types";

const STEPS: { label: string; from: number }[] = [
  { label: "Открываем страницу на ПК", from: 5 },
  { label: "Нажимаем кнопки на ПК", from: 10 },
  { label: "Повторяем на телефоне", from: 55 },
  { label: "Проверяем ссылки на другие страницы", from: 85 },
  { label: "Прогнозируем, куда посмотрят", from: 95 },
];

function ProgressScreen({ view }: { view: View }) {
  const failed = view.status === "failed";
  const current = STEPS.reduce((index, step, i) => (view.progress >= step.from ? i : index), -1);
  return (
    <main className="mx-auto max-w-[560px] px-5 pt-10 md:px-8">
      <div className="rg-mono truncate text-sm" style={{ color: "var(--rg-muted)" }}>
        {view.url}
      </div>
      <h1 className="mt-3 text-[28px] font-bold">{failed ? "Проверка не получилась" : view.status === "queued" ? "Ждём очереди" : "Просвечиваем сайт"}</h1>
      <p className="mt-2 text-[15px] leading-relaxed" style={{ color: failed ? "var(--rg-dead)" : "var(--rg-body)" }}>
        {failed
          ? view.error || "Сайт не открылся"
          : view.status === "queued"
            ? view.queueAhead > 0
              ? `Перед вами проверок: ${view.queueAhead}. Обычно это около минуты на каждую.`
              : "Начнём через пару секунд."
            : "Это занимает около минуты. Страницу можно не обновлять."}
      </p>
      {!failed && (
        <>
          <div className="rg-bar mt-7" role="progressbar" aria-valuenow={view.progress} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${Math.max(3, view.progress)}%` }} />
          </div>
          <ol className="mt-6 space-y-3" aria-live="polite">
            {STEPS.map((step, index) => {
              const state = view.status === "queued" || index > current ? "wait" : index < current ? "done" : "now";
              return (
                <li key={step.label} className="flex items-center gap-3 text-[15px]" style={{ color: state === "wait" ? "var(--rg-muted)" : "var(--rg-ink)" }}>
                  {state === "done" ? <CheckCircle2 size={18} /> : state === "now" ? <Loader2 size={18} className="rg-spin" /> : <Circle size={18} style={{ opacity: 0.5 }} />}
                  {step.label}
                </li>
              );
            })}
          </ol>
        </>
      )}
      {failed && (
        <div className="mt-8">
          <StartForm initialUrl={view.url} hint={false} />
        </div>
      )}
    </main>
  );
}

function countGroups(view: PublicView): Record<Group, number> {
  const counts: Record<Group, number> = { ok: 0, dead: 0, check: 0, unknown: 0 };
  for (const item of view.items) counts[GROUP_OF[item.kind]] += 1;
  return counts;
}

function shortHref(href: string) {
  return href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

type Layer = "clicks" | "issues" | "attention";

type Row = { n: number; group: OverlayGroup; label: string; reason: string; href?: string };

const LAYER_LABEL: Record<Layer, string> = { clicks: "клики", issues: "ошибки", attention: "внимание" };

const percent = (share: number) => `${(share * 100).toFixed(share < 0.1 ? 1 : 0).replace(".", ",")}%`;

function focusVerdict(focus: number) {
  if (focus >= 0.6) return "Взгляд собран: у экрана есть явная точка входа.";
  if (focus >= 0.45) return "Взгляд делится между несколькими местами.";
  return "Взгляд рассеян: на экране нет явного центра.";
}

function Result({ view }: { view: View }) {
  const result = view.result!;
  const [kind, setKind] = useState<ViewKind>("desktop");
  const [layer, setLayer] = useState<Layer>("clicks");
  const current = (kind === "mobile" ? result.views.mobile : null) ?? result.views.desktop;
  const hasIssues = Array.isArray(current.issues);
  const [showMinor, setShowMinor] = useState(false);
  const allIssues = useMemo(() => current.issues ?? [], [current]);
  const minorCount = allIssues.filter((issue) => MINOR_RULES.has(issue.rule)).length;
  const issues = useMemo(
    () => (showMinor ? allIssues : allIssues.filter((issue) => !MINOR_RULES.has(issue.rule)).map((issue, index) => ({ ...issue, n: index + 1 }))),
    [allIssues, showMinor],
  );
  const deadLinks = current.items.filter((item) => item.kind === "dead").length;
  const attention = current.attention;
  const heatOn = layer === "attention" && !!attention;

  const overlay: OverlayItem[] = useMemo(
    () =>
      layer === "attention"
        ? (attention?.items ?? []).map((item, index) => ({ n: index + 1, kind: "ok", group: "attn", label: item.label, reason: `${percent(item.share)} внимания`, box: item.box }))
        : layer === "issues"
          ? issues.map((issue) => ({ n: issue.n, kind: issue.severity === "error" ? "dead" : "fake", label: issue.label, reason: issue.reason, box: issue.box }))
          : current.items,
    [layer, issues, current, attention],
  );
  const rows: Row[] = useMemo(
    () =>
      layer === "attention"
        ? (attention?.items ?? []).map((item, index) => ({
            n: index + 1,
            group: "attn",
            label: item.label,
            reason: `${percent(item.share)} внимания первого экрана${item.lift >= 1.5 ? ` · заметнее среднего в ${String(item.lift).replace(".", ",")} раза` : item.lift < 0.8 ? " · заметен слабее фона" : ""}`,
          }))
        : layer === "issues"
          ? issues.map((issue) => ({ n: issue.n, group: issue.severity === "error" ? "dead" : "check", label: issue.label, reason: issue.reason }))
          : current.items
              .filter((item) => item.n !== null)
              .sort((a, b) => (a.n ?? 0) - (b.n ?? 0))
              .map((item) => ({ n: item.n!, group: GROUP_OF[item.kind], label: item.label, reason: item.reason, href: item.href })),
    [layer, issues, current, attention],
  );

  const [film, setFilm] = useState(rows.length > 0);
  const [active, setActive] = useState<number | null>(null);
  const filmOn = film && rows.length > 0 && layer !== "attention";
  const counts = countGroups(current);
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const prefix = `rg-f-${layer}-${kind}`;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dateLabel = new Date(view.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

  const legend: { label: string; group: OverlayGroup; count?: number }[] =
    layer === "attention"
      ? attention
        ? [{ label: `${percent(attention.focus)} внимания — на 10% первого экрана`, group: "attn" }]
        : []
      : layer === "issues"
        ? [
            { label: "Мешает", group: "dead", count: errors },
            { label: "Стоит поправить", group: "check", count: issues.length - errors },
          ]
        : GROUPS.map((group) => ({ label: group.label, group: group.id, count: counts[group.id] }));

  async function download() {
    const root = document.querySelector<HTMLElement>(".rg");
    if (!root || saving) return;
    setSaving(true);
    setSaveError(null);
    reachGoal("rentgen_png", { view: kind, layer });
    try {
      await exportShot({
        root,
        shot: current.shot,
        width: current.width,
        height: heatOn ? attention!.height : current.height,
        heat: heatOn ? attention!.map : undefined,
        items: overlay,
        legend,
        film: filmOn,
        host: view.host,
        subtitle: `${kind === "mobile" ? "Телефон" : "ПК"} · ${LAYER_LABEL[layer]} · ${dateLabel}${heatOn ? " · прогноз первой секунды" : ` · находок: ${rows.length}`}`,
        fileName: `rentgen-${view.host}-${kind === "mobile" ? "phone" : "pc"}-${layer}.jpg`,
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Не удалось собрать картинку");
    } finally {
      setSaving(false);
    }
  }

  function switchView(next: ViewKind) {
    const target = (next === "mobile" ? result.views.mobile : null) ?? result.views.desktop;
    if ((layer === "issues" && !target.issues) || (layer === "attention" && !target.attention)) setLayer("clicks");
    setKind(next);
    setActive(null);
  }

  function switchLayer(next: Layer) {
    setLayer(next);
    setActive(null);
  }

  function pickFromList(n: number) {
    setActive(n);
    document.getElementById(`${prefix}-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function pickFromShot(n: number) {
    setActive(n);
    document.getElementById(`rg-row-${layer}-${n}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderRow(row: Row) {
    return (
      <li key={row.n}>
        <button type="button" id={`rg-row-${layer}-${row.n}`} className={`rg-row rg-g-${row.group}`} data-active={row.n === active} onClick={() => pickFromList(row.n)}>
          <span className="rg-num">{row.n}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium" style={{ color: "var(--rg-ink)" }}>
              {row.label || "Без подписи"}
            </span>
            <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: "var(--rg-body)" }}>
              {row.reason}
            </span>
            {row.href && (
              <span className="rg-mono mt-1 block truncate text-xs" style={{ color: "var(--rg-muted)" }}>
                {shortHref(row.href)}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-5 pt-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-bold md:text-[32px]">{view.host}</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--rg-muted)" }}>
            {dateLabel} · ссылок проверено: {result.linksChecked} ·{" "}
            <a href={result.finalUrl} target="_blank" rel="noopener noreferrer" className="rg-link">
              открыть сайт
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rg-seg" role="group" aria-label="Слой">
            <button type="button" aria-pressed={layer === "clicks"} onClick={() => switchLayer("clicks")}>
              Клики
            </button>
            <button type="button" aria-pressed={layer === "issues"} disabled={!hasIssues} title={hasIssues ? undefined : "Есть в проверках с 26 октября 2026 — запустите заново"} onClick={() => switchLayer("issues")}>
              Ошибки
            </button>
            <button type="button" aria-pressed={layer === "attention"} disabled={!attention} title={attention ? "Куда посмотрят в первую секунду — прогноз модели" : "Есть в проверках с 26 октября 2026 — запустите заново"} onClick={() => switchLayer("attention")}>
              Внимание
            </button>
          </div>
          <div className="rg-seg" role="group" aria-label="Экран">
            <button type="button" aria-pressed={kind === "desktop"} onClick={() => switchView("desktop")}>
              <Monitor size={15} /> ПК
            </button>
            <button type="button" aria-pressed={kind === "mobile"} disabled={!result.views.mobile} onClick={() => switchView("mobile")}>
              <Smartphone size={15} /> Телефон
            </button>
          </div>
          {layer !== "attention" && (
            <div className="rg-seg" role="group" aria-label="Что показывать">
              <button type="button" aria-pressed={!filmOn} onClick={() => setFilm(false)}>
                Все
              </button>
              <button type="button" aria-pressed={filmOn} disabled={!rows.length} onClick={() => setFilm(true)}>
                Только проблемы
              </button>
            </div>
          )}
          <button type="button" className="rg-btn rg-btn-ghost" onClick={download} disabled={saving} title="Картинка с рамками и сводкой — для клиента или подрядчика">
            {saving ? <Loader2 size={15} className="rg-spin" /> : <Download size={15} />}
            Скачать картинку
          </button>
        </div>
      </div>
      {saveError && (
        <p className="mt-2 text-right text-sm" style={{ color: "var(--rg-dead)" }} role="alert">
          {saveError}
        </p>
      )}

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rg-panel overflow-hidden" style={kind === "mobile" ? { maxWidth: 430, marginInline: "auto", width: "100%" } : undefined}>
          <ShotOverlay
            key={`${layer}-${kind}`}
            shot={current.shot}
            width={current.width}
            height={heatOn ? attention!.height : current.height}
            heat={heatOn ? attention!.map : undefined}
            items={overlay}
            film={filmOn}
            activeN={active}
            idPrefix={prefix}
            onPick={pickFromShot}
            alt={heatOn ? `Первый экран ${view.host} с тепловой картой внимания` : `Снимок ${view.host} на ${kind === "mobile" ? "телефоне" : "ПК"} с рамками`}
          />
          {heatOn ? (
            <p className="border-t px-4 py-3 text-[13px] leading-snug" style={{ borderColor: "var(--rg-line)", color: "var(--rg-muted)" }}>
              Первый экран {current.width}×{attention!.height}. Светлее — туда посмотрят в первую секунду.
            </p>
          ) : current.truncated && (
            <p className="border-t px-4 py-3 text-[13px]" style={{ borderColor: "var(--rg-line)", color: "var(--rg-muted)" }}>
              Страница длиннее {kind === "mobile" ? "6000" : "8000"} px — ниже снимка не проверяли.
            </p>
          )}
        </div>

        <aside className="rg-panel order-first overflow-hidden lg:order-none lg:sticky lg:top-[72px] lg:flex lg:max-h-[calc(100vh-88px)] lg:flex-col">
          <div className="border-b px-4 py-4" style={{ borderColor: "var(--rg-line)" }}>
            {layer === "attention" && attention ? (
              <>
                <p className="text-[15px] font-semibold" style={{ color: "var(--rg-ink)" }}>
                  {percent(attention.focus)} внимания — на 10% экрана
                </p>
                <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--rg-body)" }}>
                  {focusVerdict(attention.focus)} Ниже — кнопки и ссылки первого экрана по доле внимания.
                </p>
                <p className="mt-3 text-[13px] leading-snug" style={{ color: "var(--rg-muted)" }}>
                  Прогноз модели, а не запись взгляда живых людей. Хуже работает на тёмных сайтах и плотных таблицах. Модель{" "}
                  <a href="https://github.com/alexanderkroner/saliency" target="_blank" rel="noopener noreferrer" className="rg-link">
                    MSI-Net
                  </a>
                  , обучение{" "}
                  <a href="https://github.com/khawkins98/Foveacast" target="_blank" rel="noopener noreferrer" className="rg-link">
                    Foveacast
                  </a>{" "}
                  на наборе{" "}
                  <a href="https://github.com/YueJiang-nj/UEyes-CHI2023" target="_blank" rel="noopener noreferrer" className="rg-link">
                    UEyes
                  </a>{" "}
                  (CC BY 4.0).
                </p>
              </>
            ) : layer === "issues" ? (
              <>
                <p className="text-[15px] font-semibold" style={{ color: "var(--rg-ink)" }}>
                  {issues.length ? `Находок: ${issues.length}` : minorCount ? "Серьёзных ошибок не нашли" : "Ошибок не нашли"}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[13px]" style={{ color: "var(--rg-body)" }}>
                  {legend.map((entry) => (
                    <span key={entry.label} className={`rg-g-${entry.group} inline-flex items-center gap-1.5`}>
                      <span className="rg-swatch" style={{ width: 12, height: 12 }} />
                      {entry.label} <span className="rg-mono">{entry.count}</span>
                    </span>
                  ))}
                </div>
                {deadLinks > 0 && (
                  <p className="mt-3 text-[13px] leading-snug" style={{ color: "var(--rg-body)" }}>
                    Битых ссылок: <span className="rg-mono">{deadLinks}</span> —{" "}
                    <button type="button" className="rg-link underline underline-offset-[3px]" style={{ color: "var(--rg-ink)" }} onClick={() => switchLayer("clicks")}>
                      смотрите слой «Клики»
                    </button>
                  </p>
                )}
                {minorCount > 0 && (
                  <p className="mt-3 text-[13px] leading-snug" style={{ color: "var(--rg-muted)" }}>
                    Мелочи для SEO и доступности: <span className="rg-mono">{minorCount}</span> — иконки и картинки без названия. Посетителю не мешают.{" "}
                    <button type="button" className="underline underline-offset-[3px]" style={{ color: "var(--rg-ink)" }} aria-pressed={showMinor} onClick={() => { setShowMinor((value) => !value); setActive(null); }}>
                      {showMinor ? "Скрыть" : "Показать"}
                    </button>
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold" style={{ color: "var(--rg-ink)" }}>
                  {rows.length ? `Проблем: ${rows.length}` : "Проблем не нашли"}
                  <span className="font-normal" style={{ color: "var(--rg-muted)" }}>
                    {" "}
                    из {current.items.length} элементов
                  </span>
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[13px]" style={{ color: "var(--rg-body)" }}>
                  {GROUPS.map((group) => (
                    <span key={group.id} className={`rg-g-${group.id} inline-flex items-center gap-1.5`} title={group.about}>
                      <span className="rg-swatch" style={{ width: 12, height: 12 }} />
                      {group.label} <span className="rg-mono">{counts[group.id]}</span>
                    </span>
                  ))}
                </div>
                {current.unprobed > 0 && (
                  <p className="mt-3 text-[13px]" style={{ color: "var(--rg-muted)" }}>
                    Не успели нажать: {current.unprobed} — они в «Не проверяли».
                  </p>
                )}
              </>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-5 text-sm leading-relaxed" style={{ color: "var(--rg-body)" }}>
              {layer === "attention"
                ? "В первую секунду кнопки и ссылки почти не получают внимания — взгляд уходит на заголовок и картинки."
                : layer === "issues"
                  ? "Ничего, что мешает прочитать страницу или заполнить форму, не нашли."
                  : "Все кнопки и ссылки, которые мы смогли нажать на этом экране, сработали."}
            </p>
          ) : layer === "issues" ? (
            <div className="lg:overflow-y-auto">
              {ISSUE_RULES.map((rule) => {
                const ruleRows = issues.filter((issue) => issue.rule === rule.id).map((issue) => rows.find((row) => row.n === issue.n)!);
                if (!ruleRows.length) return null;
                return (
                  <section key={rule.id}>
                    <div className="flex items-center justify-between border-b px-4 pt-4 pb-2 text-[13px] font-semibold" style={{ borderColor: "var(--rg-line-soft)", color: "var(--rg-muted)" }}>
                      {rule.label}
                      <span className="rg-mono">{ruleRows.length}</span>
                    </div>
                    <ol>{ruleRows.map(renderRow)}</ol>
                  </section>
                );
              })}
            </div>
          ) : (
            <ol className="lg:overflow-y-auto">{rows.map(renderRow)}</ol>
          )}
        </aside>
      </div>

      <section className="mt-14 grid gap-10 lg:grid-cols-2">
        <div className="rg-panel p-6">
          <h2 className="text-[22px] font-bold">Кнопки — только часть картины</h2>
          <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--rg-body)" }}>
            Техосмотр проверит сайт перед рекламой целиком: оффер, первый экран, скорость, доверие и аналитику — с оценкой готовности и планом правок.
          </p>
          <Link href={`/diagnost?url=${encodeURIComponent(view.url)}`} className="rg-btn rg-btn-ghost mt-5" onClick={() => reachGoal("rentgen_to_diagnost")}>
            Полный разбор в Техосмотре <ArrowRight size={16} />
          </Link>
        </div>
        <div>
          <h2 className="text-[22px] font-bold">Проверить другой сайт</h2>
          <div className="mt-4">
            <StartForm hint={false} />
          </div>
          <p className="mt-4 text-sm" style={{ color: "var(--rg-muted)" }}>
            <Link href="/rentgen#history" className="rg-link">
              Все мои проверки
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default function ScanView({ initial }: { initial: View }) {
  const [view, setView] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (view.status === "done" || view.status === "failed") return;
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/rentgen/${view.slug}`, { cache: "no-store" });
        setView(response.ok ? ((await response.json()) as View) : (current) => ({ ...current }));
      } catch {
        setView((current) => ({ ...current }));
      }
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [view]);

  // Цель — только когда скан завершился на глазах, а не при повторном открытии готовой ссылки
  const waited = useRef(initial.status !== "done");
  useEffect(() => {
    if (!waited.current || view.status !== "done" || !view.result) return;
    waited.current = false;
    const { desktop, mobile } = view.result.views;
    const problems = [desktop, mobile].reduce((sum, item) => sum + (item ? item.items.filter((row) => row.n !== null).length : 0), 0);
    reachGoal("rentgen_done", { problems });
  }, [view]);

  if (view.status === "done" && view.result) return <Result view={view} />;
  return <ProgressScreen view={view} />;
}
