import Link from "next/link";

export default function DocsPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", background: "var(--bg-root)", minHeight: "100vh", color: "var(--ink-body)", fontFamily: "var(--font-sans)" }}>
      <Link href="/dashboard/admin" style={{ color: "var(--accent)", fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none" }}>← Админка</Link>
      <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: 800, marginTop: 24, marginBottom: 8, color: "var(--ink-heading)" }}>Документация</h1>
      <p style={{ color: "var(--ink-muted)", marginBottom: 40 }}>Как работает Konversus Leads AI и как начать получать заявки.</p>

      <Section title="🚀 Быстрый старт">
        <Step n={1} text="Зарегистрируйтесь на /auth (email + пароль или Яндекс ID)" />
        <Step n={2} text="Подключите Profi.ru: Источники → Подключить → ввести логин и пароль от аккаунта Profi.ru" />
        <Step n={3} text="Настройте ключевые слова в Настройках под свою специализацию" />
        <Step n={4} text="Заявки начнут приходить в течение 5–10 минут" />
      </Section>

      <Section title="🧠 AI-анализ заявок">
        <p>Каждая заявка проходит через DeepSeek Chat. AI оценивает:</p>
        <ul>
          <li><b>Рейтинг 0–100</b> — насколько заявка подходит под профиль</li>
          <li><b>Робот или человек</b> — вероятность что ТЗ написано роботом</li>
          <li><b>Прогноз бюджета</b> — реалистичная оценка стоимости</li>
          <li><b>Сложность</b> — Низкая / Средняя / Высокая</li>
          <li><b>Рекомендация</b> — Откликнуться / Подумать / Пропустить</li>
        </ul>
      </Section>

      <Section title="📝 Отклики">
        <p>Для заявок с рейтингом ≥40 генерируется 4 типа откликов:</p>
        <ul>
          <li><b>Краткий</b> — 2-3 предложения, сразу в дело</li>
          <li><b>Продающий</b> — с выгодой для клиента</li>
          <li><b>Экспертный</b> — с техническими деталями</li>
          <li><b>Технический</b> — со стеком и процессом</li>
        </ul>
        <p>Нажмите «Копировать» — текст в буфере обмена. Вставьте в форму отклика на площадке.</p>
      </Section>

      <Section title="📱 Telegram-уведомления">
        <Step n={1} text="Создайте бота в Telegram через @BotFather (команда /newbot)" />
        <Step n={2} text="Получите токен (вида 123456:ABC-DEF...) → вставьте в Настройки" />
        <Step n={3} text="Найдите @getmyid_bot в Telegram → отправьте любое сообщение → получите Chat ID" />
        <Step n={4} text="Вставьте Chat ID в Настройки" />
        <Step n={5} text="Напишите своему боту любое сообщение (активировать чат)" />
        <p style={{ marginTop: 12 }}>Готово! Заявки с рейтингом ≥70 будут приходить в Telegram с кнопками.</p>
      </Section>

      <Section title="🔌 Источники заявок">
        <p><b>Profi.ru ✅</b> — работает сейчас. Поддерживает логин/пароль из анкеты.</p>
        <p><b>Авито Услуги</b> — в разработке.</p>
        <p><b>FL.ru, Kwork</b> — в разработке.</p>
        <p>Каждый источник — отдельный коннектор. Архитектура плагинная: новые площадки добавляются без изменения ядра.</p>
      </Section>

      <Section title="⚡ Управление системой">
        <ul>
          <li><b>Глобальный ON/OFF</b> — полностью выключить сбор заявок (экономит токены AI)</li>
          <li><b>Расписание</b> — дни недели и часы работы (например Пн–Пт 09:00–21:00)</li>
          <li><b>Жёсткий сброс</b> — удалить все заявки, сохранив настройки и источники</li>
        </ul>
      </Section>

      <Section title="💰 Тарифы">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ padding: 16, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Бесплатный</h3>
            <p style={{ fontSize: "var(--text-2xl)", fontWeight: 800 }}>0 ₽</p>
            <ul style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
              <li>1 источник заявок</li>
              <li>50 заявок в день</li>
              <li>Telegram-уведомления</li>
            </ul>
          </div>
          <div style={{ padding: 16, borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "#fff" }}>
            <h3 style={{ fontWeight: 700, marginBottom: 4, color: "#fff" }}>Pro</h3>
            <p style={{ fontSize: "var(--text-2xl)", fontWeight: 800 }}>999 ₽/мес</p>
            <ul style={{ fontSize: "var(--text-sm)", opacity: 0.9 }}>
              <li>Все источники</li>
              <li>Безлимит заявок</li>
              <li>AI-анализ</li>
              <li>Генерация откликов</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="🛠 Технологии">
        <ul>
          <li><b>Фреймворк</b>: Next.js 16 + TypeScript</li>
          <li><b>База данных</b>: PostgreSQL 16 + Prisma</li>
          <li><b>AI</b>: DeepSeek Chat через OpenRouter</li>
          <li><b>Браузер</b>: Playwright (для входа на Profi.ru)</li>
          <li><b>Очереди</b>: Redis + BullMQ</li>
          <li><b>Деплой</b>: PM2 + Nginx + Docker</li>
        </ul>
      </Section>

      <p style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border)", color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
        © 2025 Konversus Leads AI. По вопросам: @bilarius в Telegram.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: 12, color: "var(--ink-heading)" }}>{title}</h2>
      <div style={{ color: "var(--ink-body)", lineHeight: "var(--leading-relaxed)", fontSize: "var(--text-sm)" }}>{children}</div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-xs)", fontWeight: 700, flexShrink: 0 }}>{n}</span>
      <span>{text}</span>
    </div>
  );
}
