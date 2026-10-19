import Link from "next/link";
import { cookies } from "next/headers";
import { Info } from "lucide-react";
import Gauge from "@/components/diagnost/gauge";
import StartForm from "@/components/diagnost/start-form";
import { formatDate, LevelBadge, levelClass, ScoreText, verdictClass } from "@/components/diagnost/bits";
import { listOwnerAudits, OWNER_COOKIE } from "@/lib/diagnost/data";
import { VERDICT_LABELS } from "@/lib/diagnost/levels";
import { CATEGORY_ABOUT, CATEGORY_LABELS, CATEGORY_WEIGHTS, type CategoryId, type Verdict } from "@/lib/diagnost/types";

export const dynamic = "force-dynamic";

const SAMPLE: [string, number][] = [
  ["Конверсия", 82],
  ["Оффер", 71],
  ["UX", 78],
  ["SEO", 64],
  ["Доверие", 88],
  ["Реклама", 42],
];

const PRINCIPLES = [
  ["Диагностика, а не гадание", "Сначала собираются объективные сигналы страницы в настоящем браузере, и только потом они превращаются в выводы и рекомендации."],
  ["Вес каждого показателя известен", "Общая оценка складывается из семи категорий с фиксированными весами, поэтому её можно объяснить клиенту."],
  ["Понятно без терминов", "Главный экран говорит на языке бизнеса, а технические детали и доказательства остаются в разделе проверок."],
];

const SCALE: [string, string, number][] = [
  ["0–39", "Критично", 20],
  ["40–59", "Требует доработки", 50],
  ["60–74", "Приемлемо", 67],
  ["75–89", "Хорошо", 82],
  ["90–100", "Отлично", 95],
];

export default async function DiagnostPage() {
  const owner = (await cookies()).get(OWNER_COOKIE)?.value;
  const history = owner ? await listOwnerAudits(owner) : [];

  return (
    <main className="mx-auto max-w-[1240px] px-5 md:px-8">
      <section className="grid items-center gap-12 pt-8 pb-16 lg:grid-cols-[1.15fr_0.85fr] lg:pt-14">
        <div className="dg-fade">
          <span className="dg-tile inline-flex items-center gap-2 px-3 py-1.5 text-xs" style={{ color: "var(--dg-body)", borderRadius: 999 }}>
            <span className="dg-dot dg-l-excellent" />
            Техосмотр сайта перед рекламным трафиком
          </span>
          <h1 className="mt-6 text-[40px] font-bold leading-[1.05] md:text-[58px]">
            Проверьте готовность
            <br />
            сайта <span style={{ color: "var(--dg-accent)" }}>к рекламе</span>
          </h1>
          <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed" style={{ color: "var(--dg-body)" }}>
            Вводите адрес — сервис открывает сайт в браузере, проверяет оффер, CTA, мобильную версию, скорость, доверие и аналитику. На выходе: процент готовности, причины каждого балла и план исправлений с PDF для клиента.
          </p>
          <div className="mt-9 max-w-[620px]">
            <StartForm />
          </div>
        </div>

        <aside className="dg-panel p-6 dg-fade" style={{ animationDelay: "120ms" }} aria-label="Пример отчёта">
          <div className="flex items-center justify-between">
            <span className="dg-eyebrow">Пример отчёта</span>
            <span className="text-xs" style={{ color: "var(--dg-muted)" }}>
              иллюстрация
            </span>
          </div>
          <div className="dg-mono mt-2 text-sm" style={{ color: "var(--dg-ink)" }}>
            client.ru
          </div>
          <div className="mt-2 flex justify-center">
            <Gauge value={74} size={300} />
          </div>
          <div className="mt-1 flex justify-center">
            <LevelBadge score={74} />
          </div>
          <p className="mx-auto mt-3 max-w-[300px] text-center text-sm" style={{ color: "var(--dg-body)" }}>
            Сайт можно запускать, но сначала стоит закрыть критичные пробелы
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {SAMPLE.map(([label, score]) => (
              <div key={label} className={`dg-tile px-3.5 py-3 ${levelClass(score)}`}>
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--dg-muted)" }}>
                  <span className="dg-dot" />
                  {label}
                </div>
                <div className="mt-1">
                  <ScoreText score={score} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs" style={{ color: "var(--dg-muted)" }}>
            <Info size={14} className="mt-0.5 flex-none" />
            Цифры в карточке — пример интерфейса, а не результат вашего аудита
          </p>
        </aside>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {PRINCIPLES.map(([title, text]) => (
          <div key={title} className="dg-panel p-6">
            <h3 className="text-[16px] font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--dg-body)" }}>
              {text}
            </p>
          </div>
        ))}
      </section>

      <section id="history" className="mt-20 scroll-mt-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-[28px] font-bold">Мои аудиты</h2>
          <span className="text-xs" style={{ color: "var(--dg-muted)" }}>
            Хранятся в этом браузере, без регистрации
          </span>
        </div>
        {history.length === 0 ? (
          <div className="dg-panel mt-5 p-8 text-sm" style={{ color: "var(--dg-muted)" }}>
            Здесь появятся ваши проверки. Повторный аудит того же сайта покажет, как изменились баллы: было → стало.
          </div>
        ) : (
          <div className="dg-panel mt-5 overflow-x-auto">
            <table className="dg-table">
              <thead>
                <tr>
                  <th>Сайт</th>
                  <th>Дата</th>
                  <th className="text-right">Оценка</th>
                  <th className="text-right">Готовность к рекламе</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.slug}>
                    <td>
                      <Link href={`/diagnost/r/${row.slug}`} className="dg-mono" style={{ color: "var(--dg-ink)" }}>
                        {row.host}
                      </Link>
                    </td>
                    <td className="dg-mono" style={{ color: "var(--dg-muted)" }}>
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="dg-mono text-right" style={{ color: "var(--dg-ink)" }}>
                      {row.overall ?? "—"}
                    </td>
                    <td className="dg-mono text-right" style={{ color: "var(--dg-ink)" }}>
                      {row.adReadiness === null ? "—" : `${row.adReadiness}%`}
                    </td>
                    <td>
                      {row.status === "done" && row.verdict ? (
                        <span className={`inline-flex items-center gap-2 ${verdictClass(row.verdict)}`}>
                          <span className="dg-dot" />
                          {VERDICT_LABELS[row.verdict as Verdict]}
                        </span>
                      ) : (
                        <span style={{ color: "var(--dg-muted)" }}>{row.status === "failed" ? "Не удалось" : "Идёт проверка"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="method" className="mt-20 scroll-mt-8">
        <h2 className="text-[28px] font-bold">Как считается оценка</h2>
        <p className="mt-3 max-w-[760px] text-[15px] leading-relaxed" style={{ color: "var(--dg-body)" }}>
          Оценка не придумывается нейросетью. Сначала сервис собирает факты: ответ сервера, HTML, скриншоты компьютера и телефона, замеры скорости в браузере. Каждая проверка получает «да», «частично» или «нет» и имеет свой вес. AI (DeepSeek) оценивает только то, что нельзя измерить формулой: понятность оффера и иерархию первого экрана — и только по присланным скриншотам и тексту страницы.
        </p>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="dg-panel overflow-x-auto">
            <table className="dg-table">
              <thead>
                <tr>
                  <th>Категория</th>
                  <th className="text-right">Вес</th>
                  <th>Что проверяем</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(CATEGORY_WEIGHTS) as CategoryId[]).map((id) => (
                  <tr key={id}>
                    <td style={{ color: "var(--dg-ink)" }} className="whitespace-nowrap font-medium">
                      {CATEGORY_LABELS[id]}
                    </td>
                    <td className="dg-mono text-right" style={{ color: "var(--dg-ink)" }}>
                      {CATEGORY_WEIGHTS[id]}%
                    </td>
                    <td className="text-[13px]" style={{ color: "var(--dg-body)" }}>
                      {CATEGORY_ABOUT[id]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-4">
            <div className="dg-panel p-6">
              <h3 className="text-[16px] font-semibold">Шкала</h3>
              <ul className="mt-4 space-y-2.5">
                {SCALE.map(([range, label, sample]) => (
                  <li key={range} className={`flex items-center gap-3 text-sm ${levelClass(sample)}`}>
                    <span className="dg-dot" />
                    <span className="dg-mono w-16" style={{ color: "var(--dg-ink)" }}>
                      {range}
                    </span>
                    <span style={{ color: "var(--dg-body)" }}>{label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="dg-panel p-6 text-sm leading-relaxed" style={{ color: "var(--dg-body)" }}>
              <h3 className="text-[16px] font-semibold">Готовность к рекламе</h3>
              <p className="mt-2">
                Отдельный показатель для директолога: конверсия 35%, аналитика 25%, оффер 15%, UX 15%, скорость 10%. Блокеры ограничивают балл сверху: без формы и телефона — не выше 35%, без Метрики — не выше 60%.
              </p>
              <p className="mt-2">Если показатель нельзя измерить, пишем «Недостаточно данных», а не подставляем число.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
