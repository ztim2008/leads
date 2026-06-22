import type { Metadata } from "next";
import { LegalNav, LegalFooter } from "@/components/legal-layout";
import CookieBanner from "@/components/cookie-banner";

export const metadata: Metadata = { title: "Контакты — Konversus Leads AI" };

export default function Page() {
  return (
    <div style={{ background: "var(--bg-root, #09090b)", color: "var(--ink-body, #d4d4d8)", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <LegalNav />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "100px 24px 60px", lineHeight: 1.7 }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink-heading, #fafafa)", marginBottom: 4 }}>Контакты</h1>
        
        <Section title="Исполнитель"><div style={{display:"flex",flexDirection:"column",gap:6}}><ContactRow label="ФИО" value="Тимофеев Алексей Геннадьевич" /><ContactRow label="Статус" value="Самозанятый" /><ContactRow label="ИНН" value="532002912418" /><ContactRow label="Email" value="bilariuss@yandex.ru" /><ContactRow label="Telegram" value="@bilarius" /><ContactRow label="Сайт" value="leads.konversus.ru" /></div></Section><Section title="Поддержка"><p>По вопросам работы: Telegram @bilarius или bilariuss@yandex.ru.</p></Section>
      </div>
      <CookieBanner />
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

function ContactRow({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", gap: 12 }}><span style={{ color: "var(--ink-muted, #71717a)", minWidth: 100 }}>{label}:</span><span style={{ color: "var(--ink-heading, #fafafa)", fontWeight: 500 }}>{value}</span></div>;
}
