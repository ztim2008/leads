"use client";

type Props = {
  collecting: boolean;
  paused: boolean;
  hasError: boolean;
  lastLeadAt?: string | null;
  todayCount: number;
};

export default function HowCollectorWorks({ collecting, paused, hasError, lastLeadAt, todayCount }: Props) {
  const tone = hasError ? "bad" : paused ? "off" : collecting ? "ok" : "warn";
  const statusText =
    hasError ? "Нужна проверка администратора" : paused ? "Сбор на паузе" : collecting ? "Сбор идёт" : "Ожидание первой проверки";
  const color = tone === "ok" ? "var(--green)" : tone === "bad" ? "var(--red)" : tone === "off" ? "var(--ink-muted)" : "var(--amber)";

  const steps = [
    { n: "1", t: "Ваш сервер", d: "Отдельный IP, как обычный компьютер" },
    { n: "2", t: "Кабинет Profi", d: "Смотрим новые заказы, как специалист" },
    { n: "3", t: "Фильтр", d: "Только то, что подходит под ваши слова" },
    { n: "4", t: "Telegram", d: "Заявка приходит вам в бот" },
  ];

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-surface)",
        padding: 20,
        marginBottom: 28,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: 4 }}>Как работает сбор</h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", maxWidth: 520 }}>
            На вашем сервере спокойно открывается лента Profi. Подходящие заказы приходят в Telegram. Ничего настраивать не нужно.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
            <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color }}>{statusText}</span>
          </div>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 4 }}>
            Сегодня: {todayCount}
            {lastLeadAt
              ? ` · последняя ${new Date(lastLeadAt).toLocaleString("ru", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginTop: 16,
        }}
      >
        {steps.map((s, i) => (
          <div
            key={s.n}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-layer)",
              position: "relative",
            }}
          >
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>
              Шаг {s.n}
              {i < steps.length - 1 ? " →" : ""}
            </div>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>{s.t}</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 4 }}>{s.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
