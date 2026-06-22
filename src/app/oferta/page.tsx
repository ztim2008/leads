import type { Metadata } from "next";
import { LegalNav, LegalFooter } from "@/components/legal-layout";

export const metadata: Metadata = { title: "Оферта — Konversus Leads AI" };

export default function Page() {
  return (
    <div style={{ background: "var(--bg-root, #09090b)", color: "var(--ink-body, #d4d4d8)", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <LegalNav />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "100px 24px 60px", lineHeight: 1.7 }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink-heading, #fafafa)", marginBottom: 4 }}>Оферта</h1>
        <p style={{ color: "var(--ink-muted, #71717a)", marginBottom: 28 }}>Редакция от 22 июня 2026 г.</p>
        <Section title="1. Общие положения"><p>1.1. Настоящий документ является официальным предложением (публичной офертой) Самозанятого Тимофеева Алексея Геннадьевича (далее — «Исполнитель») заключить договор на оказание услуг на условиях, изложенных ниже.</p><p>1.2. Акцептом настоящей оферты является оплата услуг в порядке, предусмотренном настоящей офертой.</p><p>1.3. Услуги предоставляются через сервис Konversus Leads AI: https://leads.konversus.ru</p></Section><Section title="2. Предмет договора"><p>2.1. Исполнитель предоставляет доступ к сервису автоматического поиска и анализа заявок с фриланс-площадок (Profi.ru и других), Заказчик оплачивает эти услуги.</p><p>2.2. Состав услуг определяется тарифным планом: Бесплатный или Pro.</p></Section><Section title="3. Стоимость"><p>3.1. Тариф Pro — 700 (семьсот) рублей за 30 календарных дней.</p><p>3.2. Оплата через ЮKassa. Обязанность Заказчика считается исполненной с момента поступления средств на счёт Исполнителя.</p></Section><Section title="4. Права и обязанности"><p>4.1. Исполнитель обеспечивает работоспособность сервиса согласно тарифу.</p><p>4.2. Заказчик не передаёт данные аккаунта третьим лицам.</p></Section><Section title="5. Ответственность"><p>5.1. Исполнитель не несёт ответственности за сбои на стороне хостинг-провайдера или третьих лиц.</p></Section><Section title="6. Реквизиты Исполнителя"><p>Тимофеев Алексей Геннадьевич<br/>ИНН: 532002912418<br/>Email: bilariuss@yandex.ru<br/>Telegram: @bilarius<br/>Сайт: https://leads.konversus.ru</p></Section>
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


