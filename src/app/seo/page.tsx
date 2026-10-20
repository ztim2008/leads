import { ArrowRight, Check, MousePointerClick, Plus, Search, Store, X } from "lucide-react";
import KonversusNav from "@/components/konversus-nav";
import KonversusFooter from "@/components/konversus-footer";
import Factors from "@/components/seo/factors";
import GrowthChart from "@/components/seo/growth-chart";
import LossCalculator from "@/components/seo/loss-calculator";
import Quiz from "@/components/seo/quiz";

const COMPARE: [string, string, string][] = [
  ["Как платите", "За работу над сайтом, помесячно", "За каждый переход на сайт"],
  ["Когда первые клиенты", "Через 2–4 месяца", "В день запуска"],
  ["Если остановить оплату", "Сайт ещё долго остаётся в поиске", "Заявки пропадают в тот же день"],
  ["Цена одного клиента со временем", "Снижается", "Растёт вместе с конкуренцией"],
  ["Доверие людей", "Выше: многие пропускают рекламу", "Ниже: помечено словом «Реклама»"],
  ["Кому подходит", "Тем, кто строит бизнес надолго", "Тем, кому клиенты нужны завтра"],
];

const MILESTONES: [string, string, string][] = [
  ["1–2 месяц", "Подготовка", "Аудит, сбор запросов, исправление ошибок. Переходов почти не прибавляется — это нормально."],
  ["3–4 месяц", "Первые сдвиги", "Яндекс заметил изменения. Часть запросов поднимается на первую-вторую страницу."],
  ["6+ месяц", "Стабильный поток", "Сайт в топе по части запросов, заявки идут каждый день без оплаты за клик."],
];

const STEPS: [string, string, string][] = [
  ["Аудит сайта", "Находим, что мешает сайту в поиске: ошибки, медленная загрузка, пустые страницы.", "Список проблем по важности"],
  ["Сбор запросов", "Выясняем, какими словами люди ищут ваши услуги и сколько раз в месяц.", "Таблица запросов"],
  ["Структура", "Решаем, какие страницы нужны, чтобы на каждый запрос был свой ответ.", "Карта сайта"],
  ["Техника", "Исправляем ошибки, ускоряем сайт, настраиваем мобильную версию.", "Сайт без технических ошибок"],
  ["Тексты и страницы", "Пишем и правим тексты услуг, заголовки, описания для выдачи.", "Новые и обновлённые страницы"],
  ["Доверие", "Добавляем цены, отзывы, гарантии, контакты, карточку на Картах.", "Сайт, которому верят"],
  ["Ссылки и упоминания", "Размещаем компанию в справочниках и на тематических площадках.", "Внешние упоминания"],
  ["Отчёт и план", "Каждый месяц показываем позиции, переходы, заявки и план на следующий месяц.", "Ежемесячный отчёт"],
];

const METHODS: [string, string, string][] = [
  ["Полезные страницы под каждую услугу", "Работает годами", "ok"],
  ["Исправление техники и скорости", "Работает годами", "ok"],
  ["Цены, отзывы, контакты, Яндекс Карты", "Работает годами", "ok"],
  ["Упоминания на тематических сайтах", "Работает, если без спешки", "ok"],
  ["Тексты, набитые ключевыми словами", "Фильтр, сайт падает в поиске", "bad"],
  ["Покупка сотен ссылок разом", "Санкции Яндекса", "bad"],
  ["Накрутка поведения ботами", "Бан, выход занимает месяцы", "bad"],
];

const CANT: [string, string][] = [
  ["Первое место", "Порядок выдачи определяет Яндекс, и алгоритм меняется сотни раз в год. Кто обещает конкретное место — лукавит."],
  ["Точную дату выхода в топ", "Зависит от конкурентов: они тоже продвигаются. В спокойной нише это 3 месяца, в конкурентной — год."],
  ["Количество заявок", "Заявки зависят ещё от цены, предложения и того, как вы отвечаете на звонки."],
];

const CAN: [string, string][] = [
  ["План работ и сроки", "Знаете, что будет сделано в каждом месяце."],
  ["Прозрачный отчёт", "Позиции, переходы и заявки — с доступом к вашей Яндекс Метрике, а не на словах."],
  ["Рост видимости сайта", "Договариваемся о списке запросов и показываем, как он растёт."],
  ["Только безопасные методы", "Ничего, за что Яндекс может наказать сайт."],
];

const FLAGS = [
  "«Выведем в ТОП-1 за месяц»",
  "«Гарантия позиций или вернём деньги» без объяснения, по каким запросам",
  "Отчёт только своими скриншотами, без доступа к Метрике",
  "Отказываются объяснить, что конкретно делают",
  "Продвижение по запросам, которые никто не ищет",
];

const FAQ: [string, string][] = [
  ["Можно обойтись только рекламой?", "Можно, но вы платите за каждый переход, и как только бюджет заканчивается — заявки прекращаются. Лучше всего работает связка: реклама даёт клиентов сразу, SEO — снижает их цену через полгода."],
  ["Почему переходы есть, а заявок нет?", "Обычно проблема на самом сайте: непонятное предложение, нет цен, неудобная форма, сайт плохо открывается с телефона. Поэтому в SEO мы занимаемся и удобством сайта, а не только позициями."],
  ["Что нужно от меня?", "Доступ к сайту и Яндекс Метрике, ответы на вопросы о вашем бизнесе, фото работ, цены и отзывы. Около часа в неделю в первый месяц, дальше меньше."],
  ["Мой сайт сделан на конструкторе — его можно продвигать?", "Да, на Тильде, Битриксе, WordPress и других. Иногда у конструктора есть ограничения — скажем о них на аудите."],
  ["Что будет, если прекратить продвижение?", "Сайт не исчезнет из поиска сразу. Позиции держатся месяцами, но постепенно конкуренты обойдут — так же, как магазин без обновлений теряет покупателей."],
  ["Сколько стоит SEO?", "Зависит от ниши, города и состояния сайта. Пройдите опрос ниже — после разбора назовём точную сумму и что в неё входит."],
];

const GLOSSARY: [string, string][] = [
  ["Поисковая выдача", "Страница с результатами, которую показывает Яндекс после запроса."],
  ["Запрос", "Слова, которые человек вводит в поиск: «купить диван в Казани»."],
  ["Позиция", "Место сайта в выдаче. Первые 3–5 мест получают большинство переходов."],
  ["Топ-10", "Первая страница выдачи. Дальше неё листают редко."],
  ["Индексация", "Яндекс нашёл и прочитал страницу. Без этого её нет в поиске."],
  ["Сниппет", "Заголовок и описание сайта в выдаче — по ним человек решает, кликнуть ли."],
  ["Конверсия", "Доля посетителей, которые оставили заявку или купили."],
  ["Яндекс Метрика", "Бесплатный счётчик: сколько людей пришло, откуда и что делали на сайте."],
];

function SectionHead({ n, title, lead }: { n: string; title: string; lead?: string }) {
  return (
    <>
      <span className="seo-num">{n}</span>
      <h2 className="seo-h2">{title}</h2>
      {lead ? <p className="seo-lead">{lead}</p> : null}
    </>
  );
}

function Serp() {
  return (
    <div className="seo-panel p-4 md:p-5" aria-label="Пример страницы поиска Яндекса">
      <div className="seo-tile flex items-center gap-3 px-4 py-3">
        <Search size={18} className="seo-muted" />
        <span style={{ color: "var(--seo-ink)" }}>ремонт квартир казань</span>
      </div>
      <div className="mt-4">
        {[0, 1].map((i) => (
          <div key={i} className="seo-serp-row seo-serp-ad">
            <span className="seo-tag seo-tag-ad">Реклама</span>
            <div className="seo-serp-line mt-3" style={{ width: i ? "62%" : "74%" }} />
            <div className="seo-serp-line mt-2" style={{ width: "88%", opacity: 0.6 }} />
          </div>
        ))}
        <div className="seo-serp-row seo-serp-you">
          <span className="seo-tag seo-tag-you">Ваш сайт · 1 место</span>
          <p className="mt-2 font-semibold" style={{ color: "var(--seo-ink)" }}>Ремонт квартир под ключ в Казани — от 6 900 ₽/м²</p>
          <p className="mt-1 text-sm seo-muted">Смета за 1 день, гарантия 3 года, 240 отзывов</p>
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="seo-serp-row">
            <span className="seo-tag">{i + 2} место</span>
            <div className="seo-serp-line mt-3" style={{ width: i ? "58%" : "70%" }} />
            <div className="seo-serp-line mt-2" style={{ width: "80%", opacity: 0.6 }} />
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm seo-muted">
        Сверху — реклама, за неё платят за каждый клик. Ниже — обычные результаты: их Яндекс выбирает сам, клик бесплатный.
      </p>
    </div>
  );
}

export default function SeoPage() {
  return (
    <div className="seo">
      <KonversusNav />
      <main>
        <section className="seo-wrap grid items-center gap-12 pt-28 pb-20 lg:grid-cols-[1.1fr_0.9fr] lg:pt-36">
          <div>
            <h1 className="text-[32px] font-extrabold sm:text-[40px] md:text-[56px]">
              Как сделать, чтобы клиенты <span className="seo-accent">находили вас в Яндексе</span> сами
            </h1>
            <p className="mt-6 max-w-[580px] text-lg">
              Объясняем, что такое SEO, без технических слов: как Яндекс выбирает сайты, сколько ждать результата и что на самом деле можно гарантировать. Чтение на 7 минут.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#how" className="seo-btn seo-btn-primary">
                Разобраться, как это работает
                <ArrowRight size={18} />
              </a>
              <a href="#quiz" className="seo-btn seo-btn-ghost">Сразу к опросу</a>
            </div>
          </div>
          <Serp />
        </section>

        <section id="how" className="seo-section">
          <div className="seo-wrap">
            <SectionHead
              n="01"
              title="SEO — это работа над сайтом, чтобы Яндекс показывал его выше"
              lead="Представьте огромный торговый центр, где миллион магазинов. Яндекс — навигатор у входа: человек говорит, что ему нужно, и навигатор отправляет его в три-пять лучших магазинов. SEO — это обустройство вашего магазина так, чтобы навигатор отправлял людей к вам."
            />

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                [Search, "Человек спрашивает", "Вводит в поиск «ремонт квартир казань». В месяц такой запрос вводят тысячи людей."],
                [Store, "Яндекс ищет лучший ответ", "Перебирает все подходящие сайты и оценивает их по сотням признаков."],
                [MousePointerClick, "Показывает лучших сверху", "Первые места получают больше половины всех переходов. Дальше первой страницы почти не листают."],
              ].map(([Icon, title, text], i) => {
                const I = Icon as typeof Search;
                return (
                  <div key={i} className="seo-panel p-6">
                    <div className="flex items-center gap-3">
                      <span className="seo-step-n">{i + 1}</span>
                      <I size={20} strokeWidth={1.75} className="seo-muted" />
                    </div>
                    <h3 className="mt-5 text-xl font-bold">{title as string}</h3>
                    <p className="mt-2">{text as string}</p>
                  </div>
                );
              })}
            </div>

            <h3 className="mt-16 text-2xl font-bold">Чем SEO отличается от рекламы</h3>
            <p className="mt-2 seo-muted">Реклама — аренда места у входа в торговый центр. SEO — своя хорошая точка внутри.</p>
            <div className="seo-panel seo-scroll mt-6">
              <table className="seo-table min-w-[640px]">
                <thead>
                  <tr>
                    <th />
                    <th><span className="seo-accent">SEO</span></th>
                    <th><span style={{ color: "var(--seo-ads)" }}>Реклама в Яндексе</span></th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map(([k, seo, ads]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{seo}</td>
                      <td>{ads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="seo-section">
          <div className="seo-wrap">
            <SectionHead
              n="02"
              title="Как Яндекс решает, кого поставить выше"
              lead="Признаков сотни, но все они отвечают на четыре простых вопроса. Нажмите на каждый, чтобы увидеть пример."
            />
            <Factors />
          </div>
        </section>

        <section className="seo-section">
          <div className="seo-wrap">
            <SectionHead
              n="03"
              title="Почему SEO — это не быстро, но надолго"
              lead="Реклама включается за день и выключается вместе с бюджетом. SEO разгоняется месяцами, зато потом приводит клиентов без оплаты за каждый клик."
            />
            <div className="mt-10">
              <GrowthChart />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {MILESTONES.map(([when, title, text]) => (
                <div key={when} className="seo-tile p-5">
                  <span className="seo-mono text-sm seo-accent">{when}</span>
                  <h3 className="mt-2 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-[15px]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="seo-section">
          <div className="seo-wrap">
            <SectionHead
              n="04"
              title="Что мы делаем — по шагам"
              lead="Первые четыре шага — фундамент, их делаем в первые 1–2 месяца. Остальные идут постоянно, каждый месяц."
            />
            <div className="seo-steps mt-10">
              {STEPS.map(([title, text, result], i) => (
                <div key={title} className="seo-panel seo-step">
                  <span className="seo-step-n">{i + 1}</span>
                  <h3 className="mt-2 text-lg font-bold">{title}</h3>
                  <p className="text-[15px]">{text}</p>
                  <p className="mt-auto pt-3 text-sm seo-muted">
                    Вы получаете: <span style={{ color: "var(--seo-ink)" }}>{result}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="seo-section">
          <div className="seo-wrap">
            <SectionHead
              n="05"
              title="Методы: что работает, а за что Яндекс наказывает"
              lead="Быстрые трюки дают рост на пару месяцев, а потом сайт попадает под фильтр и выпадает из поиска. Мы работаем только честными методами."
            />
            <div className="seo-panel seo-scroll mt-10">
              <table className="seo-table min-w-[560px]">
                <thead>
                  <tr>
                    <th>Метод</th>
                    <th>Результат</th>
                  </tr>
                </thead>
                <tbody>
                  {METHODS.map(([method, result, kind]) => (
                    <tr key={method}>
                      <td style={{ color: "var(--seo-ink)", width: "55%" }}>
                        <span className="flex items-center gap-3">
                          {kind === "ok" ? (
                            <Check size={18} style={{ color: "var(--seo-accent)", flex: "none" }} />
                          ) : (
                            <X size={18} style={{ color: "var(--red)", flex: "none" }} />
                          )}
                          {method}
                        </span>
                      </td>
                      <td style={{ color: kind === "ok" ? "var(--seo-body)" : "var(--red)" }}>{result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="seo-section">
          <div className="seo-wrap">
            <SectionHead
              n="06"
              title="Есть ли гарантии? Честно"
              lead="Никто, кроме самого Яндекса, не управляет выдачей. Поэтому гарантировать место нельзя — но можно гарантировать работу и прозрачность."
            />
            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              <div className="seo-panel p-6 md:p-8">
                <h3 className="text-xl font-bold">Что гарантировать нельзя</h3>
                <ul className="mt-5 grid gap-5">
                  {CANT.map(([t, d]) => (
                    <li key={t} className="flex gap-3">
                      <X size={20} style={{ color: "var(--red)", flex: "none", marginTop: 3 }} />
                      <span>
                        <span className="font-semibold" style={{ color: "var(--seo-ink)" }}>{t}.</span> {d}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="seo-panel p-6 md:p-8">
                <h3 className="text-xl font-bold">Что гарантируем мы</h3>
                <ul className="mt-5 grid gap-5">
                  {CAN.map(([t, d]) => (
                    <li key={t} className="flex gap-3">
                      <Check size={20} style={{ color: "var(--seo-accent)", flex: "none", marginTop: 3 }} />
                      <span>
                        <span className="font-semibold" style={{ color: "var(--seo-ink)" }}>{t}.</span> {d}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="seo-tile mt-4 p-6 md:p-8">
              <h3 className="text-lg font-bold">Если подрядчик говорит так — стоит насторожиться</h3>
              <ul className="mt-4 grid gap-2 md:grid-cols-2">
                {FLAGS.map((f) => (
                  <li key={f} className="flex gap-3">
                    <span style={{ color: "var(--amber)" }}>!</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="seo-section">
          <div className="seo-wrap">
            <SectionHead
              n="07"
              title="Сколько клиентов вы можете терять прямо сейчас"
              lead="Подвигайте ползунки под свой бизнес. Это клиенты, которые ищут вашу услугу в Яндексе, но уходят к тем, кто выше."
            />
            <LossCalculator />
            <p className="mt-6">
              Хотите узнать, что мешает вашему сайту прямо сейчас?{" "}
              <a href="/diagnost" className="seo-accent">Проверьте его в Техосмотре</a> — балл, причины и план исправлений.
            </p>
          </div>
        </section>

        <section className="seo-section">
          <div className="seo-wrap grid gap-14 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <SectionHead n="08" title="Частые вопросы" />
              <div className="mt-8">
                {FAQ.map(([q, a]) => (
                  <details key={q} className="seo-faq">
                    <summary>
                      {q}
                      <Plus size={20} />
                    </summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold lg:mt-[42px]">Словарик</h3>
              <p className="mt-2 seo-muted">Если подрядчик говорит непонятными словами.</p>
              <dl className="mt-6 grid gap-3">
                {GLOSSARY.map(([term, def]) => (
                  <div key={term} className="border-b pb-3" style={{ borderColor: "var(--seo-line-soft)" }}>
                    <dt className="font-semibold" style={{ color: "var(--seo-ink)" }}>{term}</dt>
                    <dd className="mt-1 text-[15px]">{def}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section id="quiz" className="seo-section">
          <div className="seo-wrap">
            <SectionHead
              n="09"
              title="Узнайте, подойдёт ли SEO вашему бизнесу"
              lead="Шесть коротких вопросов — около двух минут. Мы посмотрим ваш сайт и нишу и бесплатно напишем, с чего начать и сколько это будет стоить."
            />
            <Quiz />
          </div>
        </section>
      </main>
      <KonversusFooter />
    </div>
  );
}
