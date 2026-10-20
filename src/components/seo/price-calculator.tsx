"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";

type Bill = "once" | "month";

type Service = {
  id: string;
  title: string;
  note: string;
  price: number;
  bill: Bill;
  unit?: string;
  step?: number;
  max?: number;
  competitive?: boolean;
};

type Group = { title: string; items: Service[] };

const GROUPS: Group[] = [
  {
    title: "Сайт",
    items: [
      { id: "audit", title: "Аудит сайта и план работ", note: "Что мешает сайту в поиске и в каком порядке это чинить", price: 12000, bill: "once" },
      { id: "semantics", title: "Сбор запросов и структура сайта", note: "Как люди ищут ваши услуги и какие страницы для этого нужны", price: 10000, bill: "once", competitive: true },
      { id: "tech", title: "Технические исправления и ускорение", note: "Ошибки, скорость, мобильная версия, карта сайта для Яндекса", price: 8000, bill: "once" },
      { id: "page", title: "Новая страница услуги или категории", note: "Текст, заголовки, фото, цены и добавление в карту сайта", price: 4000, bill: "once", unit: "стр.", max: 50, competitive: true },
      { id: "schema", title: "Микроразметка для выдачи", note: "Цена, рейтинг и ответы на вопросы прямо в результатах поиска", price: 5000, bill: "once" },
    ],
  },
  {
    title: "Контент",
    items: [
      { id: "article", title: "Статья в блог или на Дзен", note: "Отвечает на вопросы клиентов и приводит людей из поиска", price: 3500, bill: "month", unit: "шт./мес", max: 20 },
      { id: "products", title: "Карточки товаров для магазина", note: "Описание, характеристики, фото — под запросы покупателей", price: 300, bill: "once", unit: "шт.", step: 10, max: 2000 },
      { id: "video", title: "Видеоролик до 60 секунд", note: "Для сайта, Яндекса и VK Видео: о компании, товаре или процессе работы", price: 8000, bill: "once", unit: "шт.", max: 20 },
      { id: "pins", title: "Картинки для Pinterest и Яндекс Картинок", note: "До 30 изображений в месяц со ссылками на товары и услуги", price: 6000, bill: "month" },
    ],
  },
  {
    title: "Ссылки и упоминания",
    items: [
      { id: "catalogs", title: "Справочники и каталоги", note: "Размещение компании на 20+ проверенных площадках", price: 6000, bill: "once" },
      { id: "linkSite", title: "Статья со ссылкой на тематическом сайте", note: "Публикация на сайте вашей отрасли, а не на случайной площадке", price: 2500, bill: "month", unit: "шт./мес", max: 20, competitive: true },
      { id: "linkForum", title: "Упоминание на форуме или в отзовике", note: "Живой полезный ответ от реального аккаунта, без спама", price: 600, bill: "month", unit: "шт./мес", max: 50, competitive: true },
    ],
  },
  {
    title: "Карты",
    items: [
      { id: "yamaps", title: "Яндекс Бизнес и Карты", note: "Создание и полное заполнение карточки: фото, услуги, цены, часы работы", price: 5000, bill: "once" },
      { id: "gis", title: "2ГИС и Google Карты", note: "Карточки компании ещё в двух картах", price: 4000, bill: "once" },
      { id: "mapsCare", title: "Ведение карточек на картах", note: "Новые фото, публикации, ответы на отзывы", price: 4000, bill: "month" },
    ],
  },
  {
    title: "Сопровождение",
    items: [
      { id: "monthly", title: "Ежемесячная SEO-работа", note: "Позиции, правки, новые задачи и отчёт с доступом к Метрике", price: 20000, bill: "month", competitive: true },
      { id: "direct", title: "Запуск Яндекс Директа на старт", note: "Чтобы заявки шли, пока SEO набирает силу", price: 15000, bill: "once" },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

const COMPETITION = [
  { id: "low", label: "Низкая", hint: "Ремонт обуви в небольшом городе", k: 1 },
  { id: "mid", label: "Средняя", hint: "Стоматология в областном центре", k: 1.3 },
  { id: "high", label: "Высокая", hint: "Пластиковые окна в Москве", k: 1.7 },
];

type Picked = Record<string, number>;

const PRESETS: { id: string; label: string; picked: Picked }[] = [
  { id: "min", label: "Минимальный старт", picked: { audit: 1, yamaps: 1, catalogs: 1, page: 3 } },
  { id: "local", label: "Услуги в городе", picked: { audit: 1, semantics: 1, tech: 1, page: 5, yamaps: 1, gis: 1, mapsCare: 1, catalogs: 1, linkForum: 10, monthly: 1 } },
  { id: "shop", label: "Интернет-магазин", picked: { audit: 1, semantics: 1, tech: 1, schema: 1, products: 100, pins: 1, linkSite: 4, article: 2, monthly: 1 } },
];

const fmt = (n: number) => Math.round(n / 100) * 100;
const rub = (n: number) => `${fmt(n).toLocaleString("ru-RU")} ₽`;

export default function PriceCalculator() {
  const [picked, setPicked] = useState<Picked>(PRESETS[1].picked);
  const [preset, setPreset] = useState<string | null>(PRESETS[1].id);
  const [comp, setComp] = useState("mid");

  const k = COMPETITION.find((c) => c.id === comp)?.k ?? 1;

  const totals = useMemo(() => {
    let once = 0;
    let month = 0;
    for (const s of ALL) {
      const qty = picked[s.id];
      if (!qty) continue;
      const sum = s.price * qty * (s.competitive ? k : 1);
      if (s.bill === "once") once += sum;
      else month += sum;
    }
    return { once, month, half: once + month * 6 };
  }, [picked, k]);

  const toggle = (s: Service) => {
    setPreset(null);
    setPicked((p) => {
      const next = { ...p };
      if (next[s.id]) delete next[s.id];
      else next[s.id] = s.step ? s.step * 5 : 1;
      return next;
    });
  };

  const changeQty = (s: Service, dir: 1 | -1) => {
    setPreset(null);
    setPicked((p) => {
      const step = s.step ?? 1;
      const qty = Math.min(s.max ?? 99, Math.max(0, (p[s.id] ?? 0) + dir * step));
      const next = { ...p };
      if (qty === 0) delete next[s.id];
      else next[s.id] = qty;
      return next;
    });
  };

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm seo-muted">Готовые наборы:</span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="seo-chip"
            aria-pressed={preset === p.id}
            onClick={() => {
              setPreset(p.id);
              setPicked(p.picked);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          {GROUPS.map((g) => (
            <div key={g.title} className="seo-panel p-2 md:p-3">
              <h3 className="px-3 pt-2 pb-1 text-lg font-bold">{g.title}</h3>
              {g.items.map((s) => {
                const qty = picked[s.id] ?? 0;
                const on = qty > 0;
                const price = s.price * (s.competitive ? k : 1);
                return (
                  <div key={s.id} className="seo-price-row" data-on={on}>
                    <button type="button" className="seo-price-main" aria-pressed={on} onClick={() => toggle(s)}>
                      <span className="seo-check" aria-hidden="true">{on ? <Check size={14} strokeWidth={3} /> : null}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold" style={{ color: "var(--seo-ink)" }}>{s.title}</span>
                        <span className="mt-0.5 block text-sm seo-muted">{s.note}</span>
                      </span>
                    </button>
                    <div className="seo-price-side">
                      <span className="seo-mono whitespace-nowrap text-sm" style={{ color: "var(--seo-ink)" }}>
                        от {rub(price)}
                        <span className="seo-muted">{s.unit ? ` / ${s.unit.replace("/мес", "")}` : ""}{s.bill === "month" ? " в мес" : ""}</span>
                      </span>
                      {s.unit && on ? (
                        <span className="seo-stepper">
                          <button type="button" aria-label="Меньше" onClick={() => changeQty(s, -1)}><Minus size={14} /></button>
                          <span className="seo-mono">{qty}</span>
                          <button type="button" aria-label="Больше" onClick={() => changeQty(s, 1)}><Plus size={14} /></button>
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <aside className="seo-panel p-6 lg:sticky lg:top-20">
          <p className="font-semibold" style={{ color: "var(--seo-ink)" }}>Конкуренция в нише</p>
          <div className="mt-3 grid gap-2">
            {COMPETITION.map((c) => (
              <button key={c.id} type="button" className="seo-chip" aria-pressed={comp === c.id} onClick={() => setComp(c.id)}>
                <span className="block">{c.label}</span>
                <span className="block text-sm seo-muted">{c.hint}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 border-t pt-6" style={{ borderColor: "var(--seo-line)" }}>
            <div>
              <p className="text-sm seo-muted">Разово, на старте</p>
              <p className="seo-figure mt-1 text-3xl font-bold" style={{ color: "var(--seo-ink)" }}>от {rub(totals.once)}</p>
            </div>
            <div>
              <p className="text-sm seo-muted">Каждый месяц</p>
              <p className="seo-figure mt-1 text-3xl font-bold" style={{ color: "var(--seo-ink)" }}>от {rub(totals.month)}</p>
            </div>
            <div>
              <p className="text-sm seo-muted">За первые полгода</p>
              <p className="seo-figure mt-1 text-3xl font-bold seo-accent">от {rub(totals.half)}</p>
            </div>
          </div>

          <a href="#quiz" className="seo-btn seo-btn-primary mt-6 w-full">
            Получить точную смету
            <ArrowRight size={18} />
          </a>
          <p className="mt-4 text-sm seo-muted">
            Цены — средние по России. Всё обсуждается под конкретный заказ: итог зависит от состояния сайта, ниши и того, что у вас уже есть.
          </p>
        </aside>
      </div>
    </div>
  );
}
