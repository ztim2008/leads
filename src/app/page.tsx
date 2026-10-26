import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Briefcase, Building2, Send, UserRound } from "lucide-react";
import KonversusNav from "@/components/konversus-nav";
import KonversusFooter from "@/components/konversus-footer";
import Gauge from "@/components/diagnost/gauge";
import SeoMiniChart from "@/components/seo/mini-chart";
import PokazDevicesArt from "@/components/pokaz/devices-art";
import { CONTACT_TELEGRAM, PRODUCTS, STATUS_LABELS, type Product, type ProductStatus } from "@/config/products";
import "./diagnost/diagnost.css";

const TITLE = "Konversus — сервисы для бизнеса: аудит сайта, заявки, чат";
const DESCRIPTION =
  "Хаб инструментов Konversus: проверка сайта перед рекламой, заявки из Profi в Telegram, чат на сайте и быстрый прототип. Каждый сервис решает одну задачу и сразу показывает результат.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: "https://leads.konversus.ru/", siteName: "Konversus", locale: "ru_RU", type: "website" },
};

const STATUS_LEVEL: Record<ProductStatus, string> = { live: "dg-l-excellent", new: "dg-l-good", soon: "dg-l-none" };

const AUDIENCES = [
  {
    icon: Briefcase,
    title: "Директологам и агентствам",
    text: "Проверить сайт клиента до запуска рекламы, показать причины и план исправлений, найти новых клиентов.",
    products: ["diagnost", "rentgen", "pokaz", "secret-shopper", "architect"],
  },
  {
    icon: Building2,
    title: "Владельцам бизнеса",
    text: "Быстро получить сайт, не терять обращения с него и понимать, что мешает заявкам.",
    products: ["seo-promo", "nordic", "chat", "diagnost"],
  },
  {
    icon: UserRound,
    title: "Специалистам на Profi",
    text: "Видеть новые заказы раньше конкурентов и отвечать первым прямо из Telegram.",
    products: ["lovec", "chat"],
  },
];

const byId = (id: string) => PRODUCTS.find((product) => product.id === id)!;
const featured = byId("diagnost");
const seoPromo = byId("seo-promo");
const pokaz = byId("pokaz");
const liveCount = PRODUCTS.filter((product) => product.status !== "soon").length;

function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-medium ${STATUS_LEVEL[status]}`} style={{ color: "var(--dg-muted)" }}>
      <span className="dg-dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

function ProductLink({ product, children, className, style }: { product: Product; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  if (!product.href) return null;
  if (product.external) {
    return (
      <a href={product.href} target="_blank" rel="noopener" className={className} style={style}>
        {children}
      </a>
    );
  }
  if (product.staticPage) {
    return (
      <a href={product.href} className={className} style={style}>
        {children}
      </a>
    );
  }
  return (
    <Link href={product.href} className={className} style={style}>
      {children}
    </Link>
  );
}

function ProductCard({ product }: { product: Product }) {
  const soon = product.status === "soon";
  return (
    <article className="dg-panel flex flex-col p-6" style={soon ? { opacity: 0.7 } : undefined}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "var(--bg-hover)", color: soon ? "var(--dg-muted)" : "var(--dg-accent)" }}>
          <product.icon size={22} strokeWidth={1.75} />
        </div>
        <StatusBadge status={product.status} />
      </div>
      <h3 className="mt-5 text-xl font-bold">{product.name}</h3>
      <p className="mt-1 text-sm font-medium" style={{ color: "var(--dg-ink)" }}>
        {product.tagline}
      </p>
      <p className="mt-3 text-sm leading-relaxed">{product.description}</p>
      <ul className="mt-4 space-y-1.5 text-sm" style={{ color: "var(--dg-muted)" }}>
        {product.benefits.map((benefit) => (
          <li key={benefit} className="flex gap-2">
            <span aria-hidden style={{ color: soon ? "var(--dg-muted)" : "var(--dg-accent)" }}>—</span>
            {benefit}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        {soon ? (
          <span className="text-sm" style={{ color: "var(--dg-muted)" }}>
            В разработке
          </span>
        ) : (
          <ProductLink product={product} className="dg-btn dg-btn-ghost" style={{ height: 40 }}>
            Открыть
            {product.external ? <ArrowUpRight size={16} /> : <ArrowRight size={16} />}
          </ProductLink>
        )}
      </div>
    </article>
  );
}

export default function HubHome() {
  return (
    <div className="dark dg">
      <KonversusNav />

      <main className="mx-auto max-w-6xl px-5 pb-24 sm:px-8" style={{ paddingTop: 56 }}>
        <section className="grid items-center gap-12 py-16 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div className="min-w-0">
            <div className="dg-eyebrow">Konversus · сервисы для бизнеса</div>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl">
              Сервисы, которые приводят бизнесу <span style={{ color: "var(--dg-accent)" }}>клиентов</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed">{DESCRIPTION}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/diagnost" className="dg-btn dg-btn-primary" style={{ height: "auto", minHeight: 52, padding: "12px 22px", whiteSpace: "normal" }}>
                Проверить сайт перед рекламой
                <ArrowRight size={18} className="shrink-0" />
              </Link>
              <a href="#services" className="dg-btn dg-btn-ghost" style={{ height: 52, padding: "0 22px" }}>
                Все сервисы
              </a>
            </div>
          </div>

          <aside className="dg-panel min-w-0 p-2" aria-label="Сервисы хаба">
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <span className="dg-eyebrow">В хабе</span>
              <span className="dg-mono text-xs" style={{ color: "var(--dg-muted)" }}>
                {liveCount} работают · {PRODUCTS.length - liveCount} скоро
              </span>
            </div>
            <ul>
              {PRODUCTS.map((product) => (
                <li key={product.id} className="border-t px-4 py-3" style={{ borderColor: "var(--dg-line-soft)" }}>
                  <div className="flex items-center gap-3">
                    <product.icon size={18} strokeWidth={1.75} style={{ color: product.status === "soon" ? "var(--dg-muted)" : "var(--dg-accent)", flex: "none" }} />
                    <div className="min-w-0 flex-1">
                      {product.href ? (
                        <ProductLink product={product} className="text-sm font-semibold hover:underline" style={{ color: "var(--dg-ink)" }}>
                          {product.name}
                        </ProductLink>
                      ) : (
                        <span className="text-sm font-semibold" style={{ color: "var(--dg-muted)" }}>
                          {product.name}
                        </span>
                      )}
                      <p className="truncate text-xs" style={{ color: "var(--dg-muted)" }}>
                        {product.tagline}
                      </p>
                    </div>
                    <StatusBadge status={product.status} />
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        <section className="dg-panel grid items-center gap-10 p-8 md:grid-cols-[auto_1fr] md:p-10">
          <div className="mx-auto">
            <Gauge value={74} size={260} animate={false} caption="пример оценки" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="dg-eyebrow">Новый сервис</span>
              <StatusBadge status={featured.status} />
            </div>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{featured.name}: готов ли сайт к рекламе</h2>
            <p className="mt-4 max-w-2xl leading-relaxed">{featured.description}</p>
            <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
              {featured.benefits.map((benefit) => (
                <li key={benefit} className="dg-tile px-4 py-3" style={{ color: "var(--dg-ink)" }}>
                  {benefit}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link href="/diagnost" className="dg-btn dg-btn-primary">
                Открыть Техосмотр
                <ArrowRight size={16} />
              </Link>
              <span className="text-sm" style={{ color: "var(--dg-muted)" }}>
                Отчёты открываются по ссылке без регистрации
              </span>
            </div>
          </div>
        </section>

        <section className="dg-panel mt-6 grid items-center gap-10 p-8 md:grid-cols-[1fr_auto] md:p-10">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="dg-eyebrow">Для владельцев бизнеса</span>
              <StatusBadge status={seoPromo.status} />
            </div>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{seoPromo.name}: как клиенты находят вас в Яндексе</h2>
            <p className="mt-4 max-w-2xl leading-relaxed">{seoPromo.description}</p>
            <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
              {seoPromo.benefits.map((benefit) => (
                <li key={benefit} className="dg-tile px-4 py-3" style={{ color: "var(--dg-ink)" }}>
                  {benefit}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/seo" className="dg-btn dg-btn-primary">
                Разобраться в SEO
                <ArrowRight size={16} />
              </Link>
              <Link href="/seo#price" className="dg-btn dg-btn-ghost">
                Посчитать стоимость
              </Link>
            </div>
          </div>
          <div className="mx-auto">
            <SeoMiniChart />
          </div>
        </section>

        <section className="dg-panel mt-6 grid items-center gap-10 p-8 md:grid-cols-[auto_1fr] md:p-10">
          <div className="mx-auto">
            <PokazDevicesArt />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="dg-eyebrow">Бесплатный инструмент</span>
              <StatusBadge status={pokaz.status} />
            </div>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{pokaz.name}: сайт на всех экранах за минуту</h2>
            <p className="mt-4 max-w-2xl leading-relaxed">{pokaz.description}</p>
            <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
              {pokaz.benefits.map((benefit) => (
                <li key={benefit} className="dg-tile px-4 py-3" style={{ color: "var(--dg-ink)" }}>
                  {benefit}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <a href="/pokaz" className="dg-btn dg-btn-primary">
                Открыть Показ
                <ArrowRight size={16} />
              </a>
              <span className="text-sm" style={{ color: "var(--dg-muted)" }}>
                Работает в браузере, без регистрации
              </span>
            </div>
          </div>
        </section>

        <section id="services" className="scroll-mt-20 pt-24">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold sm:text-4xl">Все сервисы</h2>
            <p className="mt-3 leading-relaxed">Каждый сервис решает одну задачу: проверить сайт, получить заявку, ответить клиенту или быстро запустить сайт.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        <section className="pt-24">
          <h2 className="text-3xl font-bold sm:text-4xl">Для кого</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {AUDIENCES.map((audience) => (
              <div key={audience.title} className="dg-tile p-6">
                <audience.icon size={22} strokeWidth={1.75} style={{ color: "var(--dg-accent)" }} />
                <h3 className="mt-4 text-lg font-bold">{audience.title}</h3>
                <p className="mt-2 text-sm leading-relaxed">{audience.text}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {audience.products.map(byId).map((product) => (
                    <li key={product.id}>
                      <ProductLink product={product} className="dg-link inline-flex items-center gap-1 underline-offset-2 hover:underline">
                        {product.name}
                        {product.external ? <ArrowUpRight size={14} /> : <ArrowRight size={14} />}
                      </ProductLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="dg-panel mt-24 flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Нужен сервис под вашу задачу?</h2>
            <p className="mt-2 max-w-xl leading-relaxed">Расскажите, что хотите автоматизировать. Новые сервисы хаба появляются из реальных задач клиентов.</p>
          </div>
          <a href={CONTACT_TELEGRAM} target="_blank" rel="noopener" className="dg-btn dg-btn-primary" style={{ height: 52, padding: "0 22px" }}>
            <Send size={18} />
            Написать в Telegram
          </a>
        </section>
      </main>

      <KonversusFooter />
    </div>
  );
}
