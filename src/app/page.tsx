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

// ─── Mouse Trail ────────────────────────────────────────────────────────

function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return <>{children}</>;
}

function MouseTrail() {
  const [dots, setDots] = useState<{ x: number; y: number; id: number }[]>([]);
  const idRef = useRef(0);
  
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      idRef.current++;
      setDots(prev => {
        const next = [...prev, { x: e.clientX, y: e.clientY, id: idRef.current }];
        return next.length > 30 ? next.slice(-30) : next;
      });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length > 0 ? prev.slice(1) : prev);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}>
      {dots.map((dot, i) => {
        const alpha = i / dots.length;
        const size = 4 + alpha * 12;
        return (
          <div key={dot.id} style={{
            position: 'absolute', left: dot.x, top: dot.y,
            width: size, height: size, borderRadius: '50%',
            background: `radial-gradient(circle, rgba(99,102,241,${0.6 * alpha}) 0%, rgba(139,92,246,${0.3 * alpha}) 50%, transparent 70%)`,
            boxShadow: `0 0 ${size * 3}px rgba(99,102,241,${0.4 * alpha})`,
            transform: 'translate(-50%, -50%)',
            transition: 'opacity 0.3s',
          }} />
        );
      })}
    </div>
  );
}

// ─── Live Terminal ──────────────────────────────────────────────────────

const FAKE_LEADS = [
  { title: "Дизайн интерьера квартиры", score: 85, budget: "45 000 ₽", city: "Москва", name: "Ангелина", reviews: 12 },
  { title: "Ремонт ванной под ключ", score: 92, budget: "120 000 ₽", city: "СПб", name: "Дмитрий", reviews: 8 },
  { title: "Перепланировка двушки", score: 78, budget: "85 000 ₽", city: "Казань", name: "Ольга", reviews: 15 },
  { title: "Кухня на заказ", score: 88, budget: "200 000 ₽", city: "Москва", name: "Сергей", reviews: 23 },
  { title: "Отделка новостройки", score: 95, budget: "350 000 ₽", city: "Москва", name: "Марина", reviews: 31 },
  { title: "Потолки натяжные", score: 72, budget: "28 000 ₽", city: "Екб", name: "Алексей", reviews: 5 },
  { title: "Укладка плитки", score: 65, budget: "55 000 ₽", city: "Новосибирск", name: "Виктор", reviews: 3 },
  { title: "Электрика в доме", score: 80, budget: "75 000 ₽", city: "Москва", name: "Наталья", reviews: 17 },
];

function LiveTerminal() {
  // Статичный список для серверного рендеринга (избегаем hydration mismatch)
  const STATIC_LEADS = [
    { title: "Дизайн интерьера квартиры", score: 85, budget: "45 000 ₽", city: "Москва", name: "Ангелина", reviews: 12 },
    { title: "Ремонт ванной под ключ", score: 92, budget: "120 000 ₽", city: "СПб", name: "Дмитрий", reviews: 8 },
    { title: "Перепланировка двушки", score: 78, budget: "85 000 ₽", city: "Казань", name: "Ольга", reviews: 15 },
    { title: "Кухня на заказ", score: 88, budget: "200 000 ₽", city: "Москва", name: "Сергей", reviews: 23 },
    { title: "Отделка новостройки", score: 95, budget: "350 000 ₽", city: "Москва", name: "Марина", reviews: 31 },
    { title: "Потолки натяжные", score: 72, budget: "28 000 ₽", city: "Екб", name: "Алексей", reviews: 5 },
    { title: "Укладка плитки", score: 65, budget: "55 000 ₽", city: "Новосибирск", name: "Виктор", reviews: 3 },
    { title: "Электрика в доме", score: 80, budget: "75 000 ₽", city: "Москва", name: "Наталья", reviews: 17 },
    { title: "Натяжные потолки", score: 70, budget: "32 000 ₽", city: "Краснодар", name: "Игорь", reviews: 6 },
    { title: "Ламинат укладка", score: 55, budget: "18 000 ₽", city: "Воронеж", name: "Елена", reviews: 2 },
    { title: "Штукатурка стен", score: 60, budget: "40 000 ₽", city: "Ростов", name: "Павел", reviews: 9 },
    { title: "Санузел под ключ", score: 90, budget: "150 000 ₽", city: "Москва", name: "Ирина", reviews: 19 },
  ];

  // Дублируем для бесконечной прокрутки
  const STATIC_TIMES = [
    "09:01", "09:03", "09:07", "09:12", "09:15", "09:18",
    "09:22", "09:25", "09:28", "09:31", "09:34", "09:38",
    "09:41", "09:44", "09:47", "09:50", "09:53", "09:56",
    "09:59", "10:02", "10:05", "10:08", "10:11", "10:14",
  ];
  const scrollItems = [...STATIC_LEADS, ...STATIC_LEADS];

  return (
    <div style={{
      background: "#0a0a0f", borderRadius: 24, padding: "28px 28px 0", border: "1px solid #1a1a2e",
      maxWidth: 700, margin: "0 auto", position: "relative", overflow: "hidden",
      boxShadow: "0 0 80px rgba(99,102,241,0.1), inset 0 0 30px rgba(0,0,0,0.5)",
      fontFamily: "var(--font-mono)", fontSize: "0.72rem",
      height: 360,
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #6366f1, #8b5cf6, #22c55e)", zIndex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #1a1a2e", position: "relative", zIndex: 1, background: "#0a0a0f" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
        </div>
        <span style={{ color: "#666", fontSize: "0.7rem" }}>leads.konversus.ru — ждун активен</span>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", marginLeft: "auto" }} />
      </div>
      <div style={{
        height: 290, overflow: "hidden", position: "relative",
        maskImage: "linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)",
      }}>
        <div className="terminal-scroll" style={{
          animation: "terminalScroll 40s linear infinite",
        }}>
          {scrollItems.map((lead, i) => (
            <div key={i} style={{
              padding: "8px 0", borderBottom: "1px solid #15152a",
              lineHeight: 1.55,
            }}>
              <div style={{ color: "#555", fontSize: "0.6rem", marginBottom: 3 }}>
                [{STATIC_TIMES[i % STATIC_TIMES.length]}] 👀 Profi → <span style={{ color: "#22c55e" }}>новый</span>
              </div>
              <div style={{ color: "#d0d0d0", fontWeight: 600 }}>
                {lead.score >= 85 ? "🔥" : "⭐"} «{lead.title}» · {lead.score}/100 · {lead.budget}
              </div>
              <div style={{ color: "#777", fontSize: "0.65rem" }}>
                📍 {lead.city} · 👤 {lead.name} · ⭐ {lead.reviews} отз. · 📨 Telegram
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 50, background: "linear-gradient(to top, #0a0a0f, transparent)", pointerEvents: "none", zIndex: 1 }} />
    </div>
  );
}


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
            <LiveTerminal />
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

      <ClientOnly><MouseTrail /></ClientOnly>
      <KonversusFooter />

      {/* ─── Animations ──────────────────────────────────────────────── */}
      <style>{`
        @keyframes terminalScroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
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
