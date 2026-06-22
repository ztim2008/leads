import type { Metadata } from "next";

export const metadata: Metadata = { title: "Правила возврата — Konversus Leads AI" };

export default function RefundPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px", fontFamily: "Inter, sans-serif", color: "#d4d4d8", background: "#09090b", minHeight: "100vh", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#fafafa", marginBottom: 32 }}>Правила возврата</h1>

      <Section title="1. Услуги надлежащего качества">
        <p>Возврат средств за оплаченный тариф Pro возможен в течение 24 часов с момента платежа, если услуги не были использованы (система не собирала заявки).</p>
      </Section>

      <Section title="2. Порядок возврата">
        <p>Для оформления возврата обратитесь по email bilariuss@yandex.ru или Telegram @bilarius. Укажите email, использованный при регистрации, и детали платежа (дата, сумма).</p>
        <p>Возврат производится в течение 10 рабочих дней тем же способом, которым была произведена оплата.</p>
      </Section>

      <Section title="3. Когда возврат не производится">
        <p>Если прошло более 24 часов с момента оплаты, или система успешно собирала заявки в течение оплаченного периода — возврат не производится.</p>
      </Section>

      <Section title="4. Контакты">
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
