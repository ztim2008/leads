import AddPartnerForm from "@/components/admin/add-partner-form";

export default function AdminNewPartnerPage() {
  return (
    <div>
      <div
        style={{
          padding: 20,
          marginBottom: 20,
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          background: "var(--accent-soft)",
        }}
      >
        <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: 8 }}>
          Подключение нового партнёра
        </h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", lineHeight: 1.5 }}>
          Заполните форму — создастся аккаунт, лимит заявок на месяц и команда для VPS.
          Партнёр получает только вход в дашборд (заявки + Telegram).
        </p>
      </div>
      <AddPartnerForm />
    </div>
  );
}
