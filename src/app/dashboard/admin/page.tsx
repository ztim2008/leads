// Админ-панель — только для роли admin
// Просмотр пользователей, статистика, управление
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Shield, Users, CreditCard, Activity } from "lucide-react";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) return null;

  // Проверка роли
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "admin") {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <Shield size={48} style={{ color: "var(--ink-muted)", opacity: 0.3, marginBottom: 16 }} />
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 8 }}>Доступ запрещён</h1>
        <p style={{ color: "var(--ink-muted)" }}>Требуется роль администратора</p>
      </div>
    );
  }

  // Статистика
  const [totalUsers, totalWorkspaces, totalLeads, totalSources, recentActivity] = await Promise.all([
    db.user.count(),
    db.workspace.count(),
    db.lead.count(),
    db.source.count(),
    db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  // Пользователи с деталями
  const users = await db.user.findMany({
    include: {
      workspaces: {
        include: {
          _count: { select: { leads: true, sources: true } },
          settings: { select: { telegramChatId: true } },
        },
      },
      subscription: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const stats = [
    { label: "Пользователей", value: totalUsers, icon: Users },
    { label: "Пространств", value: totalWorkspaces, icon: Activity },
    { label: "Заявок всего", value: totalLeads, icon: CreditCard },
    { label: "Источников", value: totalSources, icon: Shield },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 4 }}>
          Админ-панель
        </h1>
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
          Управление пользователями и subscriptionми
        </p>
      </div>

      {/* Статистика */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        overflow: "hidden", marginBottom: 32,
      }}>
        {stats.map((s, i) => (
          <div key={s.label} style={{
            padding: "20px 24px", background: "var(--bg-surface)",
            borderRight: i < 3 ? "1px solid var(--border)" : "none",
            display: "flex", gap: 14, alignItems: "flex-start",
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: "var(--radius-sm)",
              background: "var(--accent-soft)", color: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <s.icon size={18} strokeWidth={1.75} />
            </div>
            <div>
              <p style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--ink-heading)", lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Таблица пользователей */}
      <div style={{
        border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        overflow: "hidden", background: "var(--bg-surface)",
      }}>
        <div style={{
          padding: "14px 20px", borderBottom: "1px solid var(--border)",
          fontWeight: 650, fontSize: "var(--text-sm)",
        }}>
          Пользователи ({users.length})
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={thStyle}>Пользователь</th>
              <th style={thStyle}>Роль</th>
              <th style={thStyle}>Пространств</th>
              <th style={thStyle}>Заявок</th>
              <th style={thStyle}>Источников</th>
              <th style={thStyle}>Telegram</th>
              <th style={thStyle}>Подписка</th>
              <th style={thStyle}>Дата</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const ws = u.workspaces[0];
              return (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={tdStyle}>
                    <div>
                      <p style={{ fontWeight: 650, fontSize: "var(--text-sm)", color: "var(--ink-heading)" }}>
                        {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                      </p>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{u.email}</p>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 100, fontSize: "var(--text-xs)", fontWeight: 600,
                      background: u.role === "admin" ? "#7c3aed20" : "var(--bg-hover)",
                      color: u.role === "admin" ? "#7c3aed" : "var(--ink-muted)",
                    }}>
                      {u.role === "admin" ? "Админ" : "Пользователь"}
                    </span>
                  </td>
                  <td style={tdStyle}>{u.workspaces.length}</td>
                  <td style={tdStyle}>{ws?._count.leads || 0}</td>
                  <td style={tdStyle}>{ws?._count.sources || 0}</td>
                  <td style={tdStyle}>{ws?.settings?.telegramChatId ? "✅" : "—"}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 100, fontSize: "var(--text-xs)", fontWeight: 600,
                      background: u.subscription?.plan === "pro" ? "var(--green-soft)" : "var(--bg-hover)",
                      color: u.subscription?.plan === "pro" ? "var(--green)" : "var(--ink-muted)",
                    }}>
                      {u.subscription?.plan === "pro" ? "Pro" : "Бесплатно"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                    {new Date(u.createdAt).toLocaleDateString("ru")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Документация */}
      <div style={{ marginTop: 32, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)", padding: "24px" }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 650, marginBottom: 4 }}>📖 Документация для пользователей</h2>
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 16 }}>Как работает сервис, как подключиться и получать заявки.</p>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "var(--text-sm)" }}>
          <div style={{ padding: "12px 16px", borderRadius: "var(--radius-sm)", background: "var(--bg-layer)", border: "1px solid var(--border)" }}>
            <p style={{ fontWeight: 650, marginBottom: 4 }}>🚀 Быстрый старт</p>
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>1. Регистрация на /auth<br/>2. Подключить Profi.ru в Источниках<br/>3. Заявки приходят каждые 5 мин</p>
          </div>
          <div style={{ padding: "12px 16px", borderRadius: "var(--radius-sm)", background: "var(--bg-layer)", border: "1px solid var(--border)" }}>
            <p style={{ fontWeight: 650, marginBottom: 4 }}>🧠 AI-анализ</p>
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>DeepSeek Chat оценивает заявки 0–100. Определяет: человек или робот написал ТЗ. Генерирует 4 типа откликов.</p>
          </div>
          <div style={{ padding: "12px 16px", borderRadius: "var(--radius-sm)", background: "var(--bg-layer)", border: "1px solid var(--border)" }}>
            <p style={{ fontWeight: 650, marginBottom: 4 }}>📱 Telegram-уведомления</p>
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>1. Создать бота в @BotFather<br/>2. Токен → в Настройки<br/>3. Chat ID → в Настройки<br/>4. Написать боту «Привет»</p>
          </div>
          <div style={{ padding: "12px 16px", borderRadius: "var(--radius-sm)", background: "var(--bg-layer)", border: "1px solid var(--border)" }}>
            <p style={{ fontWeight: 650, marginBottom: 4 }}>🔌 Источники</p>
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}><b>Profi.ru ✅</b> — работает сейчас.<br/>Авито, FL.ru, Kwork — в разработке.<br/>Каждый источник — отдельный коннектор.</p>
          </div>
          <div style={{ padding: "12px 16px", borderRadius: "var(--radius-sm)", background: "var(--bg-layer)", border: "1px solid var(--border)" }}>
            <p style={{ fontWeight: 650, marginBottom: 4 }}>⚡ Управление</p>
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>Глобальный ON/OFF — выключить систему.<br/>Расписание — дни и часы работы.<br/>Сброс — удалить все заявки.</p>
          </div>
          <div style={{ padding: "12px 16px", borderRadius: "var(--radius-sm)", background: "var(--bg-layer)", border: "1px solid var(--border)" }}>
            <p style={{ fontWeight: 650, marginBottom: 4 }}>💰 Тарифы</p>
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}><b>Бесплатный</b>: 1 источник, 50 заявок/день<br/><b>Pro</b> (990₽/мес): все источники, AI, отклики</p>
          </div>
        </div>
      </div>

      
      {/* Активность */}
      <div style={{ marginTop: 32, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontWeight: 650, fontSize: "var(--text-sm)" }}>
          📋 Последние события
        </div>
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {recentActivity.length === 0 ? (
            <p style={{ padding: "20px", color: "var(--ink-muted)", fontSize: "var(--text-sm)", textAlign: "center" }}>Событий пока нет</p>
          ) : (
            recentActivity.map((a: any) => (
              <div key={a.id} style={{ padding: "8px 20px", borderBottom: "1px solid var(--border-light)", display: "flex", gap: 12, alignItems: "center", fontSize: "var(--text-xs)" }}>
                <span style={{ color: a.type.includes("error") ? "var(--red)" : a.type.includes("start") ? "var(--green)" : a.type.includes("stop") ? "var(--amber)" : "var(--ink-muted)", fontWeight: 600, minWidth: 80 }}>
                  {new Date(a.createdAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span style={{ color: "var(--ink-muted)", fontSize: "0.65rem", minWidth: 70, textTransform: "uppercase" }}>{a.type}</span>
                <span style={{ color: "var(--ink-body)" }}>{a.description}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Монетизация */}
      <div style={{
        marginTop: 32, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        overflow: "hidden", background: "var(--bg-surface)", padding: "24px",
      }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 650, marginBottom: 12 }}>
          💳 Монетизация
        </h2>
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 16 }}>
          ЮKassa будет подключена для приёма платежей. Пользователи смогут оплатить подписку Pro (990 ₽/мес).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{
            padding: "14px 18px", borderRadius: "var(--radius-sm)",
            background: "var(--bg-layer)", border: "1px solid var(--border)",
          }}>
            <p style={{ fontWeight: 650, fontSize: "var(--text-sm)", marginBottom: 4 }}>Бесплатный</p>
            <p style={{ fontSize: "var(--text-2xl)", fontWeight: 800 }}>0 ₽</p>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 4 }}>
              1 источник · 50 заявок/день · Без AI
            </p>
          </div>
          <div style={{
            padding: "14px 18px", borderRadius: "var(--radius-sm)",
            background: "var(--accent-soft)", border: "1px solid var(--accent)",
          }}>
            <p style={{ fontWeight: 650, fontSize: "var(--text-sm)", marginBottom: 4, color: "var(--accent)" }}>Pro</p>
            <p style={{ fontSize: "var(--text-2xl)", fontWeight: 800 }}>990 ₽/мес</p>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 4 }}>
              Все источники · Безлимит · AI · Отклики
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 16px", textAlign: "left", fontSize: "var(--text-xs)",
  fontWeight: 600, color: "var(--ink-muted)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px", fontSize: "var(--text-sm)",
};
