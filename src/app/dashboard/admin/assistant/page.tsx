import OperatorAssistant from "@/components/admin/operator-assistant";

export default function AdminAssistantPage() {
  return (
    <div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginBottom: 16, lineHeight: 1.5 }}>
        Секретарь оператора: создаёт партнёров, продлевает лимиты, проверяет статус — через подтверждение.
        SSH-пароли не сохраняются и не отправляются в ИИ.
      </p>
      <OperatorAssistant />
    </div>
  );
}
