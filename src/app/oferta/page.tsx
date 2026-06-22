import type { Metadata } from "next";

export const metadata: Metadata = { title: "Оферта — Konversus Leads AI", description: "Публичная оферта на оказание услуг Konversus Leads AI." };

export default function OfertaPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px", fontFamily: "Inter, sans-serif", color: "#d4d4d8", background: "#09090b", minHeight: "100vh", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#fafafa", marginBottom: 8 }}>Публичная оферта</h1>
      <p style={{ color: "#71717a", marginBottom: 32 }}>Редакция от 22 июня 2026 г.</p>

      <Section title="1. Общие положения">
        <p>1.1. Настоящий документ является официальным предложением (публичной офертой) Самозанятого Тимофеева Алексея Геннадьевича (далее — «Исполнитель») заключить договор на оказание услуг на условиях, изложенных ниже.</p>
        <p>1.2. Акцептом настоящей оферты является оплата услуг Исполнителя в порядке, предусмотренном настоящей офертой.</p>
        <p>1.3. Услуги предоставляются через сервис Konversus Leads AI, доступный по адресу: https://leads.konversus.ru</p>
      </Section>

      <Section title="2. Предмет договора">
        <p>2.1. Исполнитель обязуется предоставить Заказчику доступ к сервису автоматического поиска и анализа заявок с фриланс-площадок (Profi.ru и других), а Заказчик обязуется оплатить эти услуги.</p>
        <p>2.2. Состав услуг определяется выбранным тарифным планом: Бесплатный или Pro.</p>
      </Section>

      <Section title="3. Стоимость и порядок оплаты">
        <p>3.1. Стоимость тарифа Pro составляет 700 (семьсот) рублей за 30 календарных дней.</p>
        <p>3.2. Оплата производится через платёжную систему ЮKassa. Обязанность Заказчика по оплате считается исполненной с момента поступления денежных средств на счёт Исполнителя.</p>
      </Section>

      <Section title="4. Права и обязанности">
        <p>4.1. Исполнитель обязуется обеспечить работоспособность сервиса в соответствии с выбранным тарифным планом.</p>
        <p>4.2. Заказчик обязуется не передавать данные своего аккаунта третьим лицам.</p>
      </Section>

      <Section title="5. Ответственность">
        <p>5.1. Исполнитель не несёт ответственности за временную недоступность сервиса, вызванную техническими сбоями на стороне хостинг-провайдера или третьих лиц.</p>
      </Section>

      <Section title="6. Реквизиты Исполнителя">
        <p>Тимофеев Алексей Геннадьевич</p>
        <p>ИНН: 532002912418</p>
        <p>Email: bilariuss@yandex.ru</p>
        <p>Telegram: @bilarius</p>
        <p>Сайт: https://leads.konversus.ru</p>
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
