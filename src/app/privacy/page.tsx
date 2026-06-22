import type { Metadata } from "next";
import { LegalNav, LegalFooter } from "@/components/legal-layout";

export const metadata: Metadata = { title: "Политика конфиденциальности — Konversus Leads AI" };

export default function Page() {
  return (
    <div style={{ background: "var(--bg-root, #09090b)", color: "var(--ink-body, #d4d4d8)", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <LegalNav />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "100px 24px 60px", lineHeight: 1.7 }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink-heading, #fafafa)", marginBottom: 4 }}>Политика конфиденциальности</h1>
        <p style={{ color: "var(--ink-muted, #71717a)", marginBottom: 28 }}>Последнее обновление: 22 июня 2026 г.</p>
        <Section title="1. Какие данные мы собираем"><ul><li>Email — для входа в аккаунт</li><li>Имя — персонализация</li><li>Логин и пароль Profi.ru — подключение источника заявок (хранятся зашифрованно)</li><li>Telegram Chat ID и Bot Token — уведомления</li><li>Файлы cookie — сессия авторизации</li></ul></Section><Section title="2. Как используем"><p>Только для: доступа к сервису, сбора заявок, уведомлений в Telegram, улучшения качества. Не передаём третьим лицам.</p></Section><Section title="3. Хранение"><p>Данные на сервере в зашифрованном виде. Доступ только у Исполнителя.</p></Section><Section title="4. Права пользователя"><p>Запросите удаление данных: bilariuss@yandex.ru или Telegram @bilarius.</p></Section><Section title="5. Контакты"><p>Тимофеев Алексей Геннадьевич<br/>Email: bilariuss@yandex.ru<br/>Telegram: @bilarius</p></Section>
      </div>
      <LegalFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink-heading, #fafafa)", marginBottom: 12 }}>{title}</h2>
      <div style={{ fontSize: "0.9rem", color: "var(--ink-muted, #a1a1aa)" }}>{children}</div>
    </div>
  );
}


