// Главная — Konversus Leads AI
import Link from "next/link";
import { LegalFooter } from "@/components/legal-layout";
import {
  Search, Brain, FileText, MessageSquare, BarChart3, Filter,
  ArrowRight, Zap, Globe, Shield, ChevronRight, Moon, Sun, ArrowUpRight
} from "lucide-react";

const FEATURES = [
  { icon: Search, title: "Автоматический мониторинг", desc: "Profi.ru ✅ (работает) · Авито, FL.ru, Kwork — скоро. Система отслеживает заказы автоматически." },
  { icon: Brain, title: "AI-анализ каждой заявки", desc: "Искусственный интеллект оценивает заявку по 100-балльной шкале, определяет написал ли её живой человек или робот, прогнозирует бюджет." },
  { icon: FileText, title: "Готовые отклики", desc: "4 варианта отклика: краткий, продающий, экспертный и технический. Копируйте и отправляйте одним кликом." },
  { icon: MessageSquare, title: "Уведомления в Telegram", desc: "Новые заявки приходят мгновенно в Telegram с оценкой, бюджетом и описанием. Вы видите только подходящие заказы." },
  { icon: BarChart3, title: "Аналитика и воронка", desc: "Конверсия: заявки → отклики → сделки. Понимайте какие площадки приносят больше прибыли." },
  { icon: Filter, title: "Умные фильтры", desc: "Ключевые слова, минус-слова, диапазон бюджета. Система отсеивает мусор и показывает только релевантные заявки." },
];

const STEPS = [
  { num: "01", title: "Подключите площадки", desc: "Profi.ru ✅ — подключите сейчас. Авито, FL.ru, Kwork — в разработке." },
  { num: "02", title: "Получайте лучшие заявки", desc: "AI анализирует каждую заявку, отсеивает мусор, оценивает вероятность сделки. В Telegram только подходящие." },
  { num: "03", title: "Откликайтесь первым", desc: "Готовый отклик ждёт вас. Копируйте и отправляйте. Вы быстрее конкурентов." },
];

function Navbar() {
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: "var(--bg-surface)", borderBottom: "1px solid var(--border)",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
        {/* Логотип — всегда видимый */}
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "1.1rem", color: "#fafafa", textDecoration: "none", letterSpacing: "-0.02em" }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6,
            background: "var(--accent)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, flexShrink: 0,
          }}>◈</div>
          <span className="nav-logo-text" style={{ display: "inline" }}>Leads AI</span>
        </a>

        {/* Десктопное меню */}
        <div className="nav-desktop" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="#how" style={{ padding: "6px 10px", borderRadius: 6, fontSize: "0.85rem", color: "var(--ink-muted)", textDecoration: "none", fontWeight: 500 }}>Как работает</a>
          <a href="/docs" style={{ padding: "6px 10px", borderRadius: 6, fontSize: "0.85rem", color: "var(--ink-muted)", textDecoration: "none", fontWeight: 500 }}>Документация</a>
          <a href="https://konversus.ru" style={{ fontSize: "0.8rem", color: "var(--ink-muted)", textDecoration: "none", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
            <ArrowUpRight size={12} /> konversus.ru
          </a>
          <a href="/auth" style={{ padding: "8px 16px", borderRadius: 6, background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none" }}>Войти</a>
        </div>


      </div>

      {/* Мобильное меню (скрыто по умолчанию) */}
      <input type="checkbox" id="mobile-menu-toggle" style={{ display: "none" }} />
      <label htmlFor="mobile-menu-toggle" className="nav-mobile-btn" style={{
        display: "none", background: "none", border: "1px solid var(--border)",
        borderRadius: 6, padding: "6px 10px", color: "var(--ink-body)", cursor: "pointer",
        fontSize: "1.3rem", position: "absolute", right: 20, top: 12,
      }}>☰</label>
      <div id="mobile-menu" style={{
        display: "none", flexDirection: "column", gap: 4,
        padding: "12px 20px 16px", background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
      }}>
        <a href="#how" style={mobileLinkStyle}>Как работает</a>
        <a href="/docs" style={mobileLinkStyle}>Документация</a>
        <a href="https://konversus.ru" style={mobileLinkStyle}>← konversus.ru</a>
        <a href="/auth" style={{ ...mobileLinkStyle, color: "var(--accent)", fontWeight: 600 }}>Войти</a>
      </div>

      {/* Медиа-запросы для мобильной версии */}
      <style>{`
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-btn { display: flex !important; align-items: center; justify-content: center; }
        }
        #mobile-menu-toggle:checked ~ #mobile-menu { display: flex !important; }
        @media (min-width: 769px) {
          #mobile-menu, .nav-mobile-btn { display: none !important; }
        }
      `}</style>
    </nav>
  );
}

const mobileLinkStyle: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 6,
  fontSize: "0.9rem", color: "var(--ink-body)",
  textDecoration: "none", fontWeight: 500,
};

export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg-root)", color: "var(--ink-body)" }}>
      {/* ─── Навбар ──────────────────────────────────────────── */}
      <Navbar />

      {/* ─── Hero ──────────────────────────────────────────── */}
      <header style={{
        background: "var(--bg-layer)",
        borderBottom: "1px solid var(--border)",
        padding: "176px 0 100px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ maxWidth: 720 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "var(--accent-soft)", color: "var(--accent)",
              borderRadius: "var(--radius-sm)", padding: "6px 16px",
              fontSize: "var(--text-sm)", fontWeight: 600,
              marginBottom: 32,
            }}>
              <Zap size={16} />
              Автоматический поиск заказов
            </div>

            <h1 style={{
              fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              color: "var(--ink-heading)",
              marginBottom: 24,
            }}>
              Не ищите заказы —<br />
              <span style={{ color: "var(--accent)" }}>они найдут вас</span>
            </h1>

            <p style={{
              fontSize: "var(--text-lg)",
              lineHeight: "var(--leading-relaxed)",
              color: "var(--ink-muted)",
              maxWidth: 560,
              marginBottom: 40,
            }}>
              Konversus Leads AI мониторит фриланс-площадки. Сейчас работает Profi.ru,
              Авито, FL.ru и Kwork — в разработке. Анализ через ИИ, уведомления в Telegram.
            </p>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <Link href="/dashboard" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "var(--accent)", color: "#fff",
                borderRadius: "var(--radius-sm)", padding: "14px 28px",
                fontSize: "var(--text-base)", fontWeight: 600,
                transition: "background 0.15s",
              }}>
                Начать бесплатно
                <ArrowRight size={18} />
              </Link>
              <Link href="#how" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "var(--bg-surface)", color: "var(--ink-body)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", padding: "14px 28px",
                fontSize: "var(--text-base)", fontWeight: 500,
              }}>
                Как работает
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Как работает ──────────────────────────────────── */}
      <section id="how" style={{ padding: "100px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ marginBottom: 64 }}>
            <p style={{
              fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--accent)",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12,
            }}>
              Как это работает
            </p>
            <h2 style={{ fontSize: "var(--text-3xl)", fontWeight: 700, marginBottom: 16 }}>
              Три шага от хаоса к системе
            </h2>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}>
            {STEPS.map((step, i) => (
              <div key={step.num} style={{
                display: "flex", gap: 24, padding: "40px 36px",
                borderRight: i < 2 ? "1px solid var(--border)" : "none",
                background: "var(--bg-surface)",
              }}>
                <span style={{
                  fontSize: "var(--text-3xl)", fontWeight: 800,
                  color: "var(--accent)", lineHeight: 0.9, opacity: 0.3,
                  flexShrink: 0,
                }}>
                  {step.num}
                </span>
                <div>
                  <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 650, marginBottom: 8 }}>
                    {step.title}
                  </h3>
                  <p style={{ color: "var(--ink-muted)", lineHeight: "var(--leading-relaxed)" }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Возможности ──────────────────────────────────── */}
      <section style={{ background: "var(--bg-layer)", padding: "100px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ marginBottom: 64 }}>
            <p style={{
              fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--accent)",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12,
            }}>
              Возможности
            </p>
            <h2 style={{ fontSize: "var(--text-3xl)", fontWeight: 700 }}>
              Всё для работы с&nbsp;заказами
            </h2>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} style={{
                padding: "36px",
                background: "var(--bg-surface)",
                borderRight: i % 2 === 0 ? "1px solid var(--border)" : "none",
                borderBottom: i < 4 ? "1px solid var(--border)" : "none",
                display: "flex", gap: 20,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "var(--radius-sm)",
                  background: "var(--accent-soft)", color: "var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <f.icon size={22} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 650, marginBottom: 6 }}>
                    {f.title}
                  </h3>
                  <p style={{ color: "var(--ink-muted)", lineHeight: "var(--leading-relaxed)", fontSize: "var(--text-sm)" }}>
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Тарифы ───────────────────────────────────────── */}
      <section style={{ padding: "100px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{
              fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--accent)",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12,
            }}>
              Тарифы
            </p>
            <h2 style={{ fontSize: "var(--text-3xl)", fontWeight: 700 }}>
              Начните бесплатно
            </h2>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
            overflow: "hidden", maxWidth: 800, margin: "0 auto",
          }}>
            {/* Бесплатный */}
            <div style={{
              padding: "44px 40px", background: "var(--bg-surface)",
              borderRight: "1px solid var(--border)",
            }}>
              <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: 4 }}>
                Бесплатный
              </h3>
              <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 24 }}>
                Для старта
              </p>
              <p style={{ fontSize: "3rem", fontWeight: 800, color: "var(--ink-heading)", marginBottom: 28 }}>
                0&nbsp;₽
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {["1 источник заявок", "50 заявок в день", "Telegram-уведомления", "Базовые фильтры"].map(t => (
                  <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--text-sm)", color: "var(--ink-body)" }}>
                    <span style={{ color: "var(--green)", fontWeight: 700 }}>✓</span> {t}
                  </li>
                ))}
                {["AI-анализ", "Генерация откликов"].map(t => (
                  <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
                    <span style={{ opacity: 0.3 }}>✗</span> {t}
                  </li>
                ))}
              </ul>
              <Link href="/dashboard" style={{
                display: "block", textAlign: "center", marginTop: 32,
                border: "1px solid var(--accent)", color: "var(--accent)",
                borderRadius: "var(--radius-sm)", padding: "12px 24px",
                fontWeight: 600, fontSize: "var(--text-sm)",
              }}>
                Начать
              </Link>
            </div>

            {/* Pro */}
            <div style={{
              padding: "44px 40px", background: "var(--accent)", color: "#fff",
            }}>
              <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: 4, color: "#fff" }}>
                Pro
              </h3>
              <p style={{ opacity: 0.7, fontSize: "var(--text-sm)", marginBottom: 24 }}>
                Для профессионалов
              </p>
              <p style={{ fontSize: "3rem", fontWeight: 800, marginBottom: 28, color: "#fff" }}>
                990&nbsp;₽/мес
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {["Все источники заявок", "Без лимита заявок", "AI-анализ каждой заявки", "4 типа откликов", "Аналитика и воронка", "Приоритетная поддержка"].map(t => (
                  <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--text-sm)", opacity: 0.9 }}>
                    <span style={{ fontWeight: 700 }}>✓</span> {t}
                  </li>
                ))}
              </ul>
              <Link href="/dashboard" style={{
                display: "block", textAlign: "center", marginTop: 32,
                background: "#fff", color: "var(--accent)",
                borderRadius: "var(--radius-sm)", padding: "12px 24px",
                fontWeight: 600, fontSize: "var(--text-sm)",
              }}>
                Попробовать
              </Link>
            </div>
          </div>
        </div>
      </section>

<LegalFooter />
    </div>
  );
}
