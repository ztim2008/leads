"use client";

import { useState } from "react";

const TOP3_SHARE = 0.15;

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

function Slider({ label, value, min, max, step, onChange, suffix }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-4">
        <span className="seo-muted text-sm">{label}</span>
        <span className="seo-mono whitespace-nowrap text-lg font-semibold" style={{ color: "var(--seo-ink)" }}>
          {fmt(value)} {suffix}
        </span>
      </span>
      <input
        type="range"
        className="seo-range mt-2"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function LossCalculator() {
  const [searches, setSearches] = useState(3000);
  const [conversion, setConversion] = useState(3);
  const [check, setCheck] = useState(15000);

  const visits = searches * TOP3_SHARE;
  const clients = visits * (conversion / 100);
  const revenue = clients * check;

  return (
    <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="seo-panel grid gap-7 p-6 md:p-8">
        <Slider label="Сколько раз в месяц ищут вашу услугу в вашем городе" value={searches} min={200} max={30000} step={100} onChange={setSearches} suffix="запросов" />
        <Slider label="Сколько посетителей становятся клиентами" value={conversion} min={1} max={10} step={0.5} onChange={setConversion} suffix="%" />
        <Slider label="Средний чек" value={check} min={1000} max={300000} step={1000} onChange={setCheck} suffix="₽" />
        <p className="text-sm seo-muted">
          Не знаете, сколько ищут? Это видно в сервисе Яндекс Вордстат — мы посчитаем за вас при разборе.
        </p>
      </div>

      <div className="seo-panel flex flex-col justify-between p-6 md:p-8">
        <div>
          <p className="seo-muted">Если ваш сайт в первой тройке, к вам каждый месяц могут переходить</p>
          <p className="seo-figure mt-1 text-3xl font-bold" style={{ color: "var(--seo-ink)" }}>≈ {fmt(visits)} человек</p>

          <p className="mt-6 seo-muted">Из них станут клиентами</p>
          <p className="seo-figure mt-1 text-3xl font-bold" style={{ color: "var(--seo-ink)" }}>≈ {fmt(clients)} в месяц</p>

          <p className="mt-6 seo-muted">Это выручка, которая сейчас может уходить конкурентам</p>
          <p className="seo-figure mt-1 text-4xl font-bold seo-accent md:text-5xl">≈ {fmt(revenue)} ₽</p>
        </div>
        <p className="mt-8 text-sm seo-muted">
          Оценка грубая: считаем, что сайты на первых трёх местах получают около 15% всех, кто ищет. В реальности доля зависит от рекламы над выдачей, карт и вашего сниппета.
        </p>
      </div>
    </div>
  );
}
