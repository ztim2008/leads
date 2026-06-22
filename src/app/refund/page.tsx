import type { Metadata } from "next";
import { LegalNav, LegalFooter } from "@/components/legal-layout";
import CookieBanner from "@/components/cookie-banner";

export const metadata: Metadata = { title: "Правила возврата — Konversus Leads AI" };

export default function Page() {
  return (
    <div style={{ background: "var(--bg-root, #09090b)", color: "var(--ink-body, #d4d4d8)", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <LegalNav />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "100px 24px 60px", lineHeight: 1.7 }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink-heading, #fafafa)", marginBottom: 4 }}>Правила возврата</h1>
        
        <Section title="1. Услуги надлежащего качества"><p>Возврат за тариф Pro возможен в течение 24 часов с момента платежа, если услуги не были использованы (система не собирала заявки).</p></Section><Section title="2. Порядок"><p>Обратитесь по email bilariuss@yandex.ru или Telegram @bilarius. Укажите: email регистрации, дату и сумму платежа, причину. Возврат — в течение 10 рабочих дней тем же способом.</p></Section><Section title="3. Когда возврат не производится"><ul><li>Прошло более 24 часов с оплаты</li><li>Система успешно собирала заявки в оплаченный период</li></ul></Section><Section title="4. Контакты"><p>Тимофеев Алексей Геннадьевич<br/>Email: bilariuss@yandex.ru<br/>Telegram: @bilarius</p></Section>
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


