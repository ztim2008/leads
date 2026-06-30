"use client";

import { useState, useEffect, useRef } from "react";
import {
  Zap, Shield, Bell, Clock, Sparkles, TrendingUp,
  Eye, Rocket, ChevronDown, ArrowRight, BarChart3,
  Brain, Target, Users, Cpu, Globe, MessageCircle,
  Gauge, Database, Activity,
} from "lucide-react";
import KonversusNav from "@/components/konversus-nav";
import KonversusFooter from "@/components/konversus-footer";

// ─── Animation hooks ───────────────────────────────────────────────────

function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.2) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return inView;
}

function FadeIn({ children, className = "", delay = 0, direction = "up" as "up" | "left" | "right" }: any) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, 0.15);

  const transforms: Record<string, string> = {
    up: `translateY(40px)`,
    left: `translateX(-40px)`,
    right: `translateX(40px)`,
  };

  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translate(0, 0)" : transforms[direction] || "translateY(40px)",
      transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
    }}>
      {children}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────

const h1: React.CSSProperties = {
  fontFamily: "var(--font-montserrat)", fontWeight: 800, fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1.1, letterSpacing: "-0.03em",
};
const h2: React.CSSProperties = {
  fontFamily: "var(--font-montserrat)", fontWeight: 700, fontSize: "clamp(2rem, 4vw, 3.2rem)", lineHeight: 1.15, letterSpacing: "-0.02em",
};
const h3: React.CSSProperties = {
  fontFamily: "var(--font-montserrat)", fontWeight: 700, fontSize: "clamp(1.3rem, 2vw, 1.6rem)", lineHeight: 1.25,
};
const body: React.CSSProperties = {
  fontSize: "clamp(1rem, 1.5vw, 1.25rem)", lineHeight: 1.6, color: "var(--ink-muted)", maxWidth: 600,
};
const section: React.CSSProperties = {
  padding: "clamp(80px, 12vw, 160px) 24px",
};
const container: React.CSSProperties = {
  maxWidth: 1200, margin: "0 auto",
};
const grid2: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 2,
};
const grid3: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 2,
};

// ─── Card ───────────────────────────────────────────────────────────────

function Card({ icon: Icon, title, text, color = "var(--accent)" }: any) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, 0.2);
  return (
    <div ref={ref} style={{
      padding: "40px 32px", borderRadius: 20, background: "var(--bg-surface)", border: "1px solid var(--border)",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(30px)",
      transition: "opacity 0.6s ease, transform 0.6s ease",
      transitionDelay: "0.1s",
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <Icon size={24} style={{ color }} strokeWidth={1.75} />
      </div>
      <h3 style={{ ...h3, marginBottom: 12, fontSize: "1.2rem" }}>{title}</h3>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.95rem", lineHeight: 1.7 }}>{text}</p>
    </div>
  );
}

// ─── Metric ─────────────────────────────────────────────────────────────

function Metric({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, 0.3);
  const [num, setNum] = useState(0);
  const target = parseInt(value) || 0;

  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const duration = 1500;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setNum(target); clearInterval(timer); }
      else setNum(start);
    }, 16);
    return () => clearInterval(timer);
  }, [visible, target]);

  return (
    <div ref={ref} style={{ textAlign: "center", padding: "32px 16px" }}>
      <div style={{ fontFamily: "var(--font-montserrat)", fontWeight: 800, fontSize: "clamp(2.5rem, 4vw, 3.5rem)", lineHeight: 1, color: "var(--accent)" }}>
        {value.includes("%") ? num + "%" : value.includes("ч") ? value : num.toLocaleString() + (value.includes("+") ? "+" : "")}
      </div>
      <p style={{ color: "var(--ink-muted)", marginTop: 8, fontSize: "0.95rem" }}>{label}</p>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div style={{ background: "var(--bg-root)", color: "var(--ink-body)", overflow: "hidden" }}>
      <KonversusNav />

      {/* ══════════ HERO — Dark ═══════════════════════════════════════ */}
      <section style={{ ...section, textAlign: "center", paddingTop: "clamp(120px, 16vw, 200px)", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <FadeIn>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 100, background: "var(--accent-soft)", color: "var(--accent)", fontSize: "0.85rem", fontWeight: 600, marginBottom: 32 }}>
            <Zap size={14} /> Лиды в Telegram за секунды
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h1 style={{ ...h1, maxWidth: 800, margin: "0 auto", color: "var(--ink-heading)" }}>
            Ваши клиенты —<br />прямо в Telegram
          </h1>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p style={{ ...body, maxWidth: 600, margin: "24px auto 0", fontSize: "clamp(1.1rem, 1.8vw, 1.35rem)" }}>
            Искусственный интеллект находит заказы на Profi, анализирует и мгновенно присылает в Telegram. Вы первым откликаетесь — конкуренты даже не видят заявку.
          </p>
        </FadeIn>
        <FadeIn delay={0.3}>
          <div style={{ marginTop: 40, display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/auth" style={{
              display: "inline-flex", alignItems: "center", gap: 10, padding: "16px 36px", borderRadius: 14,
              background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: "1.05rem", textDecoration: "none",
              boxShadow: "0 0 40px rgba(99,102,241,0.4), 0 0 80px rgba(99,102,241,0.2)",
              animation: "pulseGlow 2s ease-in-out infinite",
            }}>
              <Rocket size={20} /> Подключить для своего бизнеса
            </a>
            <a href="#how" style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 32px", borderRadius: 14,
              background: "transparent", color: "var(--ink-body)", border: "1px solid var(--border)", fontWeight: 600, fontSize: "1rem", textDecoration: "none",
            }}>
              Как это работает <ArrowRight size={16} />
            </a>
          </div>
        </FadeIn>
      </section>

      {/* ══════════ METRICS — Light ═════════════════════════════════════ */}
      <section style={{ ...section, background: "var(--bg-surface)", padding: "clamp(60px, 8vw, 100px) 24px" }}>
        <div className="metrics" style={{ ...container, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <Metric value="96" label="Реальность заявки" />
          <Metric value="17000" label="Заказов в день на Profi" />
          <Metric value="15" label="Секунд до уведомления" />
          <Metric value="3" label="Уровня защиты от бана" />
        </div>
      </section>

      {/* ══════════ HOW — Dark ═══════════════════════════════════════ */}
      <section id="how" style={{ ...section, background: "var(--bg-root)" }}>
        <div style={container}>
          <FadeIn>
            <h2 style={{ ...h2, textAlign: "center", color: "var(--ink-heading)", marginBottom: 16 }}>Как это работает</h2>
            <p style={{ ...body, textAlign: "center", margin: "0 auto 64px" }}>Три шага — и заявки сами приходят в ваш Telegram.</p>
          </FadeIn>
          <div style={{ ...grid3, gap: "40px 24px" }}>
            {[
              { icon: Eye, title: "1. Подключаем Profi", text: "Вы даёте логин от аккаунта. Система заходит как обычный человек — скроллит ленту, читает сообщения, смотрит заказы. Profi не видит робота.", color: "#6366f1" },
              { icon: Brain, title: "2. AI анализирует", text: "Нейросеть оценивает заказчика: реальный ли он, сколько отзывов, какой бюджет. Сразу видно — горячий лид или пустышка.", color: "#8b5cf6" },
              { icon: Bell, title: "3. Telegram-уведомление", text: "Заявка приходит в Telegram с готовой карточкой: имя клиента, бюджет, сроки. Вы первым пишете отклик — пока другие только открыли Profi.", color: "#22c55e" },
            ].map((s, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <Card icon={s.icon} title={s.title} text={s.text} color={s.color} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ WATCHER — Light ═══════════════════════════════════ */}
      <section style={{ ...section, background: "var(--bg-surface)" }}>
        <div style={container}>
          <FadeIn>
            <h2 style={{ ...h2, textAlign: "center", color: "var(--ink-heading)", marginBottom: 16 }}>Ждун, который не спит</h2>
            <p style={{ ...body, textAlign: "center", margin: "0 auto 64px" }}>Никаких опросов каждые 5 минут. Одна сессия браузера — заказы ловятся в реальном времени.</p>
          </FadeIn>
          <FadeIn direction="up" delay={0.1}>
            <div style={{ background: "var(--bg-root)", borderRadius: 24, padding: "48px 40px", border: "1px solid var(--border)", maxWidth: 700, margin: "0 auto", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #6366f1, #8b5cf6, #22c55e)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
                <span style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>Ждун активен</span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--ink-muted)", lineHeight: 1.8 }}>
                <div>👀 Profi заказ №91234 → <span style={{ color: "var(--green)" }}>новый!</span></div>
                <div>⭐ «Дизайн интерьера» · 85/100 · 45 000 ₽</div>
                <div>📍 Москва · 👤 Ангелина · ⭐ 12 отзывов</div>
                <div style={{ marginTop: 12, color: "var(--accent)" }}>📨 Отправлено в Telegram →</div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════ FEATURES — Dark ═══════════════════════════════════ */}
      <section style={{ ...section, background: "var(--bg-root)" }}>
        <div style={container}>
          <FadeIn>
            <h2 style={{ ...h2, textAlign: "center", color: "var(--ink-heading)", marginBottom: 16 }}>Всё что нужно для охоты</h2>
            <p style={{ ...body, textAlign: "center", margin: "0 auto 64px" }}>Продуманная система, а не просто парсер. Каждая деталь работает на результат.</p>
          </FadeIn>
          <div className="features" style={{ ...grid3, gap: "2px" }}>
            {[
              { icon: Shield, title: "Анти-детект", text: "Три уровня маскировки. Ротация User-Agent, человеческое поведение, случайные паузы. Profi не видит робота." },
              { icon: Clock, title: "Расписание", text: "Сбор только в рабочие часы. Ночью система спит. Вы сами настраиваете когда и как часто проверять." },
              { icon: MessageCircle, title: "Rich-карточки", text: "Имя клиента, отзывы, стаж на Profi, город, сроки, цена отклика. Вся информация в одном сообщении." },
              { icon: Target, title: "AI-скоринг", text: "Нейросеть оценивает заявку 0–100. Отделяет живых людей от ботов. Приоритетные лиды — первыми." },
              { icon: Users, title: "Мульти-партнёр", text: "Каждый партнёр в своём браузере. Изолированные сессии, свой IP, свой уровень защиты." },
              { icon: Database, title: "История заявок", text: "Все заказы сохраняются. Поиск, фильтры, аналитика. Ничего не теряется." },
            ].map((s, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <Card icon={s.icon} title={s.title} text={s.text} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ SAFETY — Light ═══════════════════════════════════ */}
      <section style={{ ...section, background: "var(--bg-surface)" }}>
        <div style={container}>
          <FadeIn>
            <h2 style={{ ...h2, textAlign: "center", color: "var(--ink-heading)", marginBottom: 16 }}>Безопасность — не функция, а фундамент</h2>
            <p style={{ ...body, textAlign: "center", margin: "0 auto 64px" }}>Profi банит парсеры. Мы строили защиту с первого дня.</p>
          </FadeIn>
          <div className="safety" style={{ ...grid2, gap: "2px" }}>
            {[
              { icon: Gauge, title: "Случайные интервалы", text: "Проверка не каждые 5 минут, а случайно: 3, 7, 11, 15, 25 минут. Дважды подряд интервал не повторяется." },
              { icon: Eye, title: "Человеческое поведение", text: "Браузер скроллит ленту, заходит в сообщения, кликает случайные заказы. 20% проверок пропускается — «занят»." },
              { icon: Globe, title: "Изолированные сессии", text: "У каждого партнёра свой браузер, свои куки, свой IP. Profi видит разных людей из разных городов." },
              { icon: Cpu, title: "3 уровня защиты", text: "Light — ротация браузера. Balanced — симуляция мыши. Stealth — 60% пропусков, глубокое скрытие." },
            ].map((s, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <Card icon={s.icon} title={s.title} text={s.text} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CTA — Dark ═══════════════════════════════════════ */}
      <section style={{ ...section, textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.15) 0%, transparent 60%)", pointerEvents: "none" }} />
        <FadeIn>
          <h2 style={{ ...h2, color: "var(--ink-heading)", maxWidth: 700, margin: "0 auto 20px" }}>
            Первыми узнавайте о новых заказах
          </h2>
          <p style={{ ...body, maxWidth: 500, margin: "0 auto 40px", textAlign: "center" }}>
            Пока конкуренты обновляют страницу, ваш телефон уже вибрирует с новым лидом.
          </p>
        </FadeIn>
        <FadeIn delay={0.2}>
          <a href="/auth" style={{
            display: "inline-flex", alignItems: "center", gap: 12, padding: "20px 44px", borderRadius: 16,
            background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: "1.15rem", textDecoration: "none",
            boxShadow: "0 0 60px rgba(99,102,241,0.5), 0 0 120px rgba(99,102,241,0.25)",
            animation: "pulseGlow 2s ease-in-out infinite", position: "relative", overflow: "hidden",
          }}>
            <span style={{ position: "absolute", top: 0, left: "-100%", width: "100%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)", animation: "shimmer 2s infinite" }} />
            <Rocket size={22} /> Подключить для своего бизнеса
          </a>
        </FadeIn>
      </section>

      <KonversusFooter />

      {/* ─── Animations ──────────────────────────────────────────────── */}
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 40px rgba(99,102,241,0.4), 0 0 80px rgba(99,102,241,0.2); }
          50% { box-shadow: 0 0 60px rgba(99,102,241,0.6), 0 0 100px rgba(99,102,241,0.3); }
        }
        @keyframes shimmer {
          0% { left: -100%; } 100% { left: 200%; }
        }
      `}</style>
    </div>
  );
}
