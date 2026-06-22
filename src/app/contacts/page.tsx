import type { Metadata } from "next";

export const metadata: Metadata = { title: "Контакты — Konversus Leads AI" };

export default function ContactsPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px", fontFamily: "Inter, sans-serif", color: "#d4d4d8", background: "#09090b", minHeight: "100vh", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#fafafa", marginBottom: 32 }}>Контакты</h1>

      <Section title="Исполнитель">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Row label="ФИО" value="Тимофеев Алексей Геннадьевич" />
          <Row label="Статус" value="Самозанятый" />
          <Row label="ИНН" value="532002912418" />
          <Row label="Email" value="bilariuss@yandex.ru" />
          <Row label="Telegram" value="@bilarius" />
          <Row label="Сайт" value="leads.konversus.ru" />
        </div>
      </Section>

      <Section title="Поддержка">
        <p>По вопросам работы сервиса пишите в Telegram @bilarius или на почту bilariuss@yandex.ru.</p>
      </Section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span style={{ color: "#71717a", minWidth: 100 }}>{label}:</span>
      <span style={{ color: "#fafafa", fontWeight: 500 }}>{value}</span>
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
