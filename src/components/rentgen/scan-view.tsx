"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Loader2, Monitor, Smartphone, XCircle } from "lucide-react";
import ShotOverlay from "@/components/rentgen/shot-overlay";
import StartForm from "@/components/rentgen/start-form";
import type { PublicView, ScanView as View } from "@/lib/rentgen/data";
import { GROUP_OF, GROUPS, type Group } from "@/lib/rentgen/groups";
import type { ViewKind } from "@/lib/rentgen/types";

const STEPS: { label: string; from: number }[] = [
  { label: "Открываем страницу на ПК", from: 5 },
  { label: "Нажимаем кнопки на ПК", from: 10 },
  { label: "Повторяем на телефоне", from: 55 },
  { label: "Проверяем ссылки на другие страницы", from: 85 },
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

function Result({ view }: { view: View }) {
  const result = view.result!;
  const [kind, setKind] = useState<ViewKind>("desktop");
  const current = (kind === "mobile" ? result.views.mobile : null) ?? result.views.desktop;
  const problems = useMemo(() => current.items.filter((item) => item.n !== null).sort((a, b) => (a.n ?? 0) - (b.n ?? 0)), [current]);
  const [film, setFilm] = useState(problems.length > 0);
  const [active, setActive] = useState<number | null>(null);
  const filmOn = film && problems.length > 0;
  const counts = countGroups(current);
  const prefix = `rg-f-${kind}`;

  function switchView(next: ViewKind) {
    setKind(next);
    setActive(null);
  }

  function pickFromList(n: number) {
    setActive(n);
    document.getElementById(`${prefix}-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function pickFromShot(n: number) {
    setActive(n);
    document.getElementById(`rg-row-${n}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <main className="mx-auto max-w-[1400px] px-5 pt-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-bold md:text-[32px]">{view.host}</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--rg-muted)" }}>
            {new Date(view.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" })} · ссылок проверено: {result.linksChecked} ·{" "}
            <a href={result.finalUrl} target="_blank" rel="noopener noreferrer" className="rg-link">
              открыть сайт
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rg-seg" role="group" aria-label="Экран">
            <button type="button" aria-pressed={kind === "desktop"} onClick={() => switchView("desktop")}>
              <Monitor size={15} /> ПК
            </button>
            <button type="button" aria-pressed={kind === "mobile"} disabled={!result.views.mobile} onClick={() => switchView("mobile")}>
              <Smartphone size={15} /> Телефон
            </button>
          </div>
          <div className="rg-seg" role="group" aria-label="Что показывать">
            <button type="button" aria-pressed={!filmOn} onClick={() => setFilm(false)}>
              Все
            </button>
            <button type="button" aria-pressed={filmOn} disabled={!problems.length} onClick={() => setFilm(true)}>
              Только проблемы
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rg-panel overflow-hidden" style={kind === "mobile" ? { maxWidth: 430, marginInline: "auto", width: "100%" } : undefined}>
          <ShotOverlay
            key={kind}
            shot={current.shot}
            width={current.width}
            height={current.height}
            items={current.items}
            film={filmOn}
            activeN={active}
            idPrefix={prefix}
            onPick={pickFromShot}
            alt={`Снимок ${view.host} на ${kind === "mobile" ? "телефоне" : "ПК"} с рамками вокруг кнопок`}
          />
          {current.truncated && (
            <p className="border-t px-4 py-3 text-[13px]" style={{ borderColor: "var(--rg-line)", color: "var(--rg-muted)" }}>
              Страница длиннее {kind === "mobile" ? "6000" : "8000"} px — ниже снимка элементы не проверяли.
            </p>
          )}
        </div>

        <aside className="rg-panel order-first overflow-hidden lg:order-none lg:sticky lg:top-[72px] lg:flex lg:max-h-[calc(100vh-88px)] lg:flex-col">
          <div className="border-b px-4 py-4" style={{ borderColor: "var(--rg-line)" }}>
            <p className="text-[15px] font-semibold" style={{ color: "var(--rg-ink)" }}>
              {problems.length ? `Проблем: ${problems.length}` : "Проблем не нашли"}
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
          </div>
          {problems.length > 0 ? (
            <ol className="lg:overflow-y-auto">
              {problems.map((item) => (
                <li key={item.n}>
                  <button type="button" id={`rg-row-${item.n}`} className={`rg-row rg-g-${GROUP_OF[item.kind]}`} data-active={item.n === active} onClick={() => pickFromList(item.n!)}>
                    <span className="rg-num">{item.n}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" style={{ color: "var(--rg-ink)" }}>
                        {item.label || "Без подписи"}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: "var(--rg-body)" }}>
                        {item.reason}
                      </span>
                      {item.href && (
                        <span className="rg-mono mt-1 block truncate text-xs" style={{ color: "var(--rg-muted)" }}>
                          {shortHref(item.href)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-4 py-5 text-sm leading-relaxed" style={{ color: "var(--rg-body)" }}>
              Все кнопки и ссылки, которые мы смогли нажать на этом экране, сработали.
            </p>
          )}
        </aside>
      </div>

      <section className="mt-14 max-w-[600px]">
        <h2 className="text-[22px] font-bold">Проверить другой сайт</h2>
        <div className="mt-4">
          <StartForm hint={false} />
        </div>
        <p className="mt-4 text-sm" style={{ color: "var(--rg-muted)" }}>
          <Link href="/rentgen#history" className="rg-link">
            Все мои проверки
          </Link>
        </p>
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

  if (view.status === "done" && view.result) return <Result view={view} />;
  return <ProgressScreen view={view} />;
}
