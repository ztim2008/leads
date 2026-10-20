"use client";

import { useState } from "react";
import { BadgeCheck, FileText, Link2, Users, type LucideIcon } from "lucide-react";

type Factor = {
  id: string;
  icon: LucideIcon;
  title: string;
  question: string;
  life: string;
  checks: string[];
  work: string[];
};

const FACTORS: Factor[] = [
  {
    id: "text",
    icon: FileText,
    title: "Есть ли ответ",
    question: "Отвечает ли страница на то, что спросил человек?",
    life: "Вы ищете «ремонт ванной под ключ». Одна компания пишет «Делаем всё», другая — показывает цены, сроки, фото работ и что входит в «под ключ». Яндекс поставит выше вторую.",
    checks: ["Под каждую услугу — своя страница", "В заголовках и тексте есть слова, которыми люди ищут", "Текст полезный, а не набит ключевыми словами"],
    work: ["Собираем, как люди реально ищут ваши услуги", "Раскладываем запросы по страницам", "Пишем и правим тексты, заголовки, описания"],
  },
  {
    id: "business",
    icon: BadgeCheck,
    title: "Настоящий ли бизнес",
    question: "Можно ли этой компании доверять и купить у неё?",
    life: "Вы бы не зашли в магазин без вывески и ценников. Яндекс тоже: если на сайте нет цен, адреса, телефона и условий, он считает, что покупателю здесь неудобно.",
    checks: ["Цены или «от …» на услуги", "Телефон, адрес, карта, реквизиты", "Отзывы, гарантии, способы оплаты и доставки"],
    work: ["Проверяем сайт по списку того, что важно покупателю", "Добавляем цены, контакты, условия, отзывы", "Оформляем карточку в Яндекс Бизнесе и на Картах"],
  },
  {
    id: "people",
    icon: Users,
    title: "Понравилось ли людям",
    question: "Нашёл ли человек, что искал, или сразу ушёл обратно?",
    life: "Если люди открывают ваш сайт и через 5 секунд возвращаются в поиск — для Яндекса это знак, что ответа здесь нет. Если читают, листают и звонят — сайт хороший.",
    checks: ["Сайт быстро открывается и удобен с телефона", "С первого экрана понятно, что вы предлагаете", "Легко позвонить, написать, оставить заявку"],
    work: ["Ускоряем сайт и правим мобильную версию", "Переделываем первый экран и кнопки", "Смотрим записи визитов в Яндекс Метрике и убираем то, что мешает"],
  },
  {
    id: "links",
    icon: Link2,
    title: "Рекомендуют ли другие",
    question: "Упоминают ли вас другие сайты и справочники?",
    life: "Как с рекомендациями знакомых: если о мастере пишут на форумах, в справочниках и отраслевых каталогах, ему больше доверяют. Ссылки на ваш сайт работают так же.",
    checks: ["Вы есть в справочниках и на картах", "О вас пишут тематические сайты", "Ссылки появляются постепенно и естественно"],
    work: ["Размещаем компанию в справочниках и каталогах", "Договариваемся о публикациях на тематических площадках", "Не покупаем ссылки пачками — это риск санкций"],
  },
];

export default function Factors() {
  const [active, setActive] = useState(FACTORS[0].id);
  const f = FACTORS.find((item) => item.id === active) ?? FACTORS[0];

  return (
    <div className="mt-10 grid gap-4 lg:grid-cols-[320px_1fr]">
      <div role="tablist" aria-label="Что оценивает Яндекс" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {FACTORS.map((item, i) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={item.id === active}
            className="seo-chip flex items-center gap-3 py-3"
            onClick={() => setActive(item.id)}
          >
            <item.icon size={20} strokeWidth={1.75} style={{ color: "var(--seo-accent)", flex: "none" }} />
            <span>
              <span className="seo-mono mr-2 text-sm seo-muted">{i + 1}</span>
              {item.title}
            </span>
          </button>
        ))}
      </div>

      <div key={f.id} role="tabpanel" className="seo-panel seo-fade p-6 md:p-8">
        <h3 className="text-2xl font-bold">{f.question}</h3>
        <p className="mt-4 text-[17px]">{f.life}</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div>
            <p className="font-semibold" style={{ color: "var(--seo-ink)" }}>На что смотрит Яндекс</p>
            <ul className="mt-3 grid gap-2">
              {f.checks.map((c) => (
                <li key={c} className="flex gap-3">
                  <span className="seo-mono seo-muted">—</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold" style={{ color: "var(--seo-ink)" }}>Что мы делаем</p>
            <ul className="mt-3 grid gap-2">
              {f.work.map((c) => (
                <li key={c} className="flex gap-3">
                  <span className="seo-accent">+</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
