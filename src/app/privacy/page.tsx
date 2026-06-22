import type { Metadata } from "next";

export const metadata: Metadata = { title: "Политика конфиденциальности — Konversus Leads AI" };

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px", fontFamily: "Inter, sans-serif", color: "#d4d4d8", background: "#09090b", minHeight: "100vh", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#fafafa", marginBottom: 8 }}>Политика конфиденциальности</h1>
      <p style={{ color: "#71717a", marginBottom: 32 }}>Последнее обновление: 22 июня 2026 г.</p>

      <Section title="1. Какие данные мы собираем">
        <p>При регистрации и использовании сервиса мы запрашиваем:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>Email — для входа в аккаунт</li>
          <li>Имя — для персонализации</li>
          <li>Логин и пароль Profi.ru — для подключения источника заявок (хранятся в зашифрованном виде)</li>
          <li>Telegram Chat ID и Bot Token — для отправки уведомлений</li>
          <li>Файлы cookie — для поддержания сессии авторизации</li>
        </ul>
      </Section>

      <Section title="2. Как мы используем данные">
        <p>Собранные данные используются исключительно для:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>Предоставления доступа к сервису</li>
          <li>Автоматического сбора заявок с указанных площадок</li>
          <li>Отправки уведомлений в Telegram</li>
          <li>Улучшения качества сервиса</li>
        </ul>
        <p>Мы не передаём данные третьим лицам и не используем их для рассылок.</p>
      </Section>

      <Section title="3. Хранение данных">
        <p>Данные хранятся на сервере в зашифрованном виде. Доступ к данным имеет только Исполнитель.</p>
      </Section>

      <Section title="4. Права пользователя">
        <p>Вы можете в любой момент запросить удаление ваших данных, обратившись по email: bilariuss@yandex.ru или Telegram: @bilarius.</p>
      </Section>

      <Section title="5. Контакты">
        <p>Тимофеев Алексей Геннадьевич</p>
        <p>Email: bilariuss@yandex.ru</p>
        <p>Telegram: @bilarius</p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fafafa", marginBottom: 12 }}>{title}</h2>
      <div style={{ fontSize: "0.9rem", color: "#a1a1aa" }}>{children}</div>
    </div>
  );
}
