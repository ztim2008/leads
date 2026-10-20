"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Send } from "lucide-react";
import { CONTACT_TELEGRAM } from "@/config/products";
import { reachGoal } from "@/lib/metrika";

type Answers = {
  niche: string;
  city: string;
  site: string;
  siteUrl: string;
  sources: string[];
  goal: string;
  budget: string;
  name: string;
  contact: string;
  comment: string;
};

const EMPTY: Answers = { niche: "", city: "", site: "", siteUrl: "", sources: [], goal: "", budget: "", name: "", contact: "", comment: "" };

const SITE = ["Есть сайт", "Сайт в разработке", "Сайта нет"];
const SOURCES = ["Сарафанное радио", "Реклама в Яндексе", "Авито и агрегаторы", "Соцсети", "Яндекс Карты", "Пока клиентов мало"];
const GOALS = ["Больше заявок и звонков", "Больше продаж в интернет-магазине", "Чтобы о нас узнали в городе", "Пока разбираюсь, нужен совет"];
const BUDGETS = ["До 30 000 ₽", "30 000 – 60 000 ₽", "60 000 – 120 000 ₽", "Больше 120 000 ₽", "Пока не знаю"];

const STEPS = ["Бизнес", "Сайт", "Клиенты", "Цель", "Бюджет", "Связь"];

function Chips({ options, value, onPick, multi }: { options: string[]; value: string | string[]; onPick: (v: string) => void; multi?: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const on = multi ? (value as string[]).includes(o) : value === o;
        return (
          <button key={o} type="button" className="seo-chip flex items-center justify-between gap-3 py-3" aria-pressed={on} onClick={() => onPick(o)}>
            {o}
            {on ? <Check size={16} style={{ color: "var(--seo-accent)", flex: "none" }} /> : null}
          </button>
        );
      })}
    </div>
  );
}

export default function Quiz() {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((prev) => ({ ...prev, [k]: v }));

  const canNext = [
    a.niche.trim().length > 1,
    a.site !== "",
    a.sources.length > 0,
    a.goal !== "",
    a.budget !== "",
    a.name.trim().length > 0 && a.contact.trim().length > 3 && consent,
  ][step];

  const pickAndNext = (k: "site" | "goal" | "budget", v: string) => {
    set(k, v);
    if (k !== "site" || v !== "Есть сайт") setTimeout(() => setStep((s) => s + 1), 180);
  };

  async function submit() {
    if (busy || !canNext) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/seo-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...a, website: trap }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Не получилось отправить");
      reachGoal("seo_quiz_sent", { budget: a.budget, goal: a.goal });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не получилось отправить");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="seo-panel seo-fade mt-10 p-6 md:p-10">
        <h3 className="text-2xl font-bold">Спасибо, {a.name.trim()}! Ответы у нас.</h3>
        <p className="mt-4 max-w-[620px] text-[17px]">
          Посмотрим ваш сайт и нишу и напишем в течение рабочего дня: что можно улучшить и с чего начать. Не хотите ждать — напишите нам в Telegram прямо сейчас.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={CONTACT_TELEGRAM} target="_blank" rel="noopener" className="seo-btn seo-btn-primary" onClick={() => reachGoal("seo_quiz_telegram")}>
            <Send size={18} />
            Написать в Telegram
          </a>
          <a href="/diagnost" className="seo-btn seo-btn-ghost">
            Проверить сайт в Техосмотре
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="seo-panel mt-10 p-6 md:p-10">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="seo-muted">
          Шаг <span className="seo-mono" style={{ color: "var(--seo-ink)" }}>{step + 1}</span> из {STEPS.length} · {STEPS[step]}
        </span>
        <span className="seo-mono seo-muted">{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
      </div>
      <div className="seo-bar mt-3">
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div key={step} className="seo-fade mt-8 min-h-[260px]">
        {step === 0 && (
          <div className="grid gap-5">
            <h3 className="text-2xl font-bold">Чем занимается ваш бизнес?</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="seo-label">Услуга или товар</span>
                <input className="seo-field" placeholder="Например, ремонт квартир" value={a.niche} maxLength={120} onChange={(e) => set("niche", e.target.value)} />
              </label>
              <label>
                <span className="seo-label">Город или регион</span>
                <input className="seo-field" placeholder="Например, Казань" value={a.city} maxLength={80} onChange={(e) => set("city", e.target.value)} />
              </label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5">
            <h3 className="text-2xl font-bold">У вас есть сайт?</h3>
            <Chips options={SITE} value={a.site} onPick={(v) => pickAndNext("site", v)} />
            {a.site === "Есть сайт" && (
              <label className="seo-fade">
                <span className="seo-label">Адрес сайта — посмотрим его перед ответом</span>
                <input className="seo-field seo-mono" inputMode="url" placeholder="https://example.ru" value={a.siteUrl} maxLength={200} onChange={(e) => set("siteUrl", e.target.value)} />
              </label>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5">
            <h3 className="text-2xl font-bold">Откуда сейчас приходят клиенты?</h3>
            <p className="seo-muted -mt-2">Можно выбрать несколько вариантов.</p>
            <Chips
              multi
              options={SOURCES}
              value={a.sources}
              onPick={(v) => set("sources", a.sources.includes(v) ? a.sources.filter((s) => s !== v) : [...a.sources, v])}
            />
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-5">
            <h3 className="text-2xl font-bold">Чего хотите добиться?</h3>
            <Chips options={GOALS} value={a.goal} onPick={(v) => pickAndNext("goal", v)} />
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-5">
            <h3 className="text-2xl font-bold">Сколько готовы вкладывать в продвижение в месяц?</h3>
            <p className="seo-muted -mt-2">Это поможет предложить реальный план, а не «всё и сразу».</p>
            <Chips options={BUDGETS} value={a.budget} onPick={(v) => pickAndNext("budget", v)} />
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-5">
            <h3 className="text-2xl font-bold">Куда прислать ответ?</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="seo-label">Как к вам обращаться</span>
                <input className="seo-field" autoComplete="given-name" value={a.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />
              </label>
              <label>
                <span className="seo-label">Telegram или телефон</span>
                <input className="seo-field" placeholder="@username или +7…" value={a.contact} maxLength={60} onChange={(e) => set("contact", e.target.value)} />
              </label>
            </div>
            <label>
              <span className="seo-label">Что ещё важно знать (необязательно)</span>
              <input className="seo-field" value={a.comment} maxLength={500} onChange={(e) => set("comment", e.target.value)} />
            </label>
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" value={trap} onChange={(e) => setTrap(e.target.value)} />
            <label className="flex items-start gap-3 text-sm seo-muted">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ accentColor: "var(--seo-accent)" }} />
              <span>
                Согласен на обработку персональных данных по{" "}
                <a href="/privacy" target="_blank" className="seo-accent">политике конфиденциальности</a>
              </span>
            </label>
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-4 text-sm" style={{ color: "var(--red)" }}>
          {error}. Можно написать нам напрямую:{" "}
          <a href={CONTACT_TELEGRAM} target="_blank" rel="noopener" className="seo-accent">Telegram @bilarius</a>
        </p>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-3">
        <button type="button" className="seo-btn seo-btn-ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || busy} style={{ visibility: step === 0 ? "hidden" : "visible" }}>
          <ArrowLeft size={18} />
          Назад
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="seo-btn seo-btn-primary"
            onClick={() => {
              if (step === 0) reachGoal("seo_quiz_start");
              setStep((s) => s + 1);
            }}
            disabled={!canNext}
          >
            Дальше
            <ArrowRight size={18} />
          </button>
        ) : (
          <button type="button" className="seo-btn seo-btn-primary" onClick={submit} disabled={!canNext || busy}>
            {busy ? <Loader2 size={18} className="seo-spin" /> : <Send size={18} />}
            {busy ? "Отправляем" : "Отправить"}
          </button>
        )}
      </div>
    </div>
  );
}
