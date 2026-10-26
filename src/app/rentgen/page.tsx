import Link from "next/link";
import { cookies } from "next/headers";
import ShotOverlay, { type OverlayItem } from "@/components/rentgen/shot-overlay";
import StartForm from "@/components/rentgen/start-form";
import { listOwnerScans, OWNER_COOKIE } from "@/lib/rentgen/data";
import demo from "@/lib/rentgen/demo.json";
import { GROUP_OF, GROUPS } from "@/lib/rentgen/groups";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { queued: "В очереди", running: "Идёт", failed: "Не получилось" };

const STEPS = [
  "Открываем страницу в настоящем браузере дважды: экран ПК 1440 px и телефон 390 px.",
  "Находим всё, на что можно нажать: ссылки, кнопки и блоки, которые только выглядят как кнопки.",
  "Нажимаем по очереди и смотрим, что произошло: переход, окно, звонок, отправка формы или ничего.",
  "Ссылки на другие страницы открываем отдельно и смотрим код ответа: 404, ошибка сервера, несуществующий домен.",
  "Слоем «Ошибки» отмечаем то, что мешает прочитать и заполнить: бледный текст, поля без подписи, картинки без описания, а на телефоне — мелкий текст и блоки шире экрана.",
  "Слой «Внимание» — прогноз, куда посмотрят в первую секунду на первом экране, и сколько взгляда достаётся каждой кнопке.",
];

const LIMITS = [
  "Проверяем одну страницу — ту, что вставили, без обхода всего сайта.",
  "Формы не заполняем, кнопку отправки внутри формы не нажимаем — отмечаем её по типу.",
  "Длинные страницы снимаем до 8000 px на ПК и 6000 px на телефоне.",
  "Взгляд реальных посетителей не записываем: «Внимание» — прогноз модели, и на тёмных сайтах он менее точен.",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
}

export default async function RentgenPage() {
  const owner = (await cookies()).get(OWNER_COOKIE)?.value;
  const history = owner ? await listOwnerScans(owner) : [];
  const items = demo.items as OverlayItem[];
  const working = items.filter((item) => GROUP_OF[item.kind] === "ok").length;

  return (
    <main className="mx-auto max-w-[1400px] px-5 md:px-8">
      <section className="grid items-center gap-12 pt-8 pb-14 lg:grid-cols-[1fr_1.1fr] lg:pt-12">
        <div>
          <h1 className="text-[38px] font-bold leading-[1.06] md:text-[54px]">
            Какие кнопки на&nbsp;сайте
            <br />
            не&nbsp;работают
          </h1>
          <p className="mt-6 max-w-[540px] text-[17px] leading-relaxed" style={{ color: "var(--rg-body)" }}>
            Вставьте адрес. Мы откроем страницу на ПК и телефоне, нажмём каждую кнопку и ссылку и покажем на снимке, что работает, что ведёт в пустоту и во что трудно попасть пальцем.
          </p>
          <div className="mt-9 max-w-[600px]">
            <StartForm />
          </div>
        </div>

        <figure className="rg-panel overflow-hidden">
          <ShotOverlay shot={demo.shot} width={demo.width} height={demo.height} items={items} eager alt={`Снимок первого экрана ${demo.host} с рамками вокруг кнопок`} />
          <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-[13px]" style={{ borderColor: "var(--rg-line)", color: "var(--rg-muted)" }}>
            <span className="rg-mono" style={{ color: "var(--rg-ink)" }}>
              {demo.host}
            </span>
            <span>
              Первый экран нашей главной: работают {working} из {items.length}
            </span>
          </figcaption>
        </figure>
      </section>

      <section aria-label="Что означают цвета рамок" className="grid gap-x-8 gap-y-5 border-y py-7 sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--rg-line)" }}>
        {GROUPS.map((group) => (
          <div key={group.id} className={`rg-g-${group.id}`}>
            <div className="flex items-center gap-2.5 text-[15px] font-semibold" style={{ color: "var(--rg-ink)" }}>
              <span className="rg-swatch" />
              {group.label}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--rg-muted)" }}>
              {group.about}
            </p>
          </div>
        ))}
      </section>

      {history.length > 0 && (
        <section id="history" className="mt-16 scroll-mt-20">
          <h2 className="text-[26px] font-bold">Мои проверки</h2>
          <div className="rg-panel mt-5 overflow-hidden">
            {history.map((row) => (
              <Link key={row.slug} href={`/rentgen/r/${row.slug}`} className="rg-row items-center" style={{ cursor: "pointer" }}>
                <span className="rg-mono min-w-0 flex-1 truncate text-sm" style={{ color: "var(--rg-ink)" }}>
                  {row.host}
                </span>
                <span className="text-sm" style={{ color: row.status === "done" && row.problems ? "var(--rg-ink)" : "var(--rg-muted)" }}>
                  {row.status === "done" ? (row.problems ? `Проблем: ${row.problems}` : "Проблем нет") : STATUS[row.status]}
                </span>
                <span className="hidden w-[130px] text-right text-[13px] sm:block" style={{ color: "var(--rg-muted)" }}>
                  {formatDate(row.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="method" className="mt-16 grid scroll-mt-20 gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 className="text-[26px] font-bold">Как проверяем</h2>
          <ol className="mt-5 space-y-4">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-4 text-[15px] leading-relaxed" style={{ color: "var(--rg-body)" }}>
                <span className="rg-mono flex-none pt-0.5 text-sm" style={{ color: "var(--rg-muted)" }}>
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="text-[26px] font-bold">Чего не делаем</h2>
          <ul className="mt-5 space-y-4">
            {LIMITS.map((limit) => (
              <li key={limit} className="text-[15px] leading-relaxed" style={{ color: "var(--rg-body)" }}>
                {limit}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-relaxed" style={{ color: "var(--rg-muted)" }}>
            Слой «Ошибки» работает на{" "}
            <a href="https://github.com/dequelabs/axe-core" target="_blank" rel="noopener noreferrer" className="rg-link">
              axe-core
            </a>{" "}
            — открытом движке проверки доступности. Слой «Внимание» — на модели{" "}
            <a href="https://github.com/khawkins98/Foveacast" target="_blank" rel="noopener noreferrer" className="rg-link">
              Foveacast
            </a>
            , обученной на наборе{" "}
            <a href="https://github.com/YueJiang-nj/UEyes-CHI2023" target="_blank" rel="noopener noreferrer" className="rg-link">
              UEyes
            </a>{" "}
            (CC BY 4.0). Это прогноз, а не запись взгляда живых людей.
          </p>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--rg-muted)" }}>
            Нужна полная проверка перед рекламой — оффер, скорость, аналитика?{" "}
            <Link href="/diagnost" className="rg-link">
              Техосмотр сайта
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
