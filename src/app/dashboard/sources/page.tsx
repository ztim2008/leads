// Страница источников заявок — подключение и настройка площадок
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { listConnectors } from "@/lib/connectors/types";
import { revalidatePath } from "next/cache";
import ProfiTestButton from "@/components/profi-test-button";

import "@/lib/connectors/profi";
import "@/lib/connectors/kwork";

const PLATFORM_COLORS: Record<string, string> = {
  profi: "#22c55e",
  avito: "#3b82f6",
  fl: "#8b5cf6",
  kwork: "#f97316",
};

export default async function SourcesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    include: { sources: true },
  });
  if (!workspace) return null;

  const availableConnectors = listConnectors();

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 4 }}>Источники заявок</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 28 }}>
        Подключите площадки для автоматического сбора заказов
      </p>

      {/* Карточки коннекторов */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        {availableConnectors.map((connector) => {
          const existing = workspace.sources.find((s) => s.platform === connector.platform);
          const color = PLATFORM_COLORS[connector.platform] || "#6366f1";
          const config = (existing?.config as Record<string, unknown>) || {};
          const hasLogin = !!(config.login && config.password);
          const noLoginNeeded = connector.platform === "kwork";

          return (
            <div key={connector.platform} style={{ padding: "24px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>

              {/* Заголовок */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 42, height: 42, borderRadius: "var(--radius-sm)", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
                  {connector.platform[0].toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontWeight: 650, fontSize: "var(--text-sm)" }}>{connector.name}</h3>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                    {existing
                      ? existing.enabled
                        ? (noLoginNeeded || hasLogin) ? "🟢 Подключён и работает" : "🟡 Подключён, но не настроен логин/пароль"
                        : "⏸ Приостановлен"
                      : "Не подключён"}
                  </p>
                </div>
              </div>

              {/* Последняя проверка */}
              {existing && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 16 }}>
                  Последняя проверка:{" "}
                  {existing.lastCheckAt
                    ? new Date(existing.lastCheckAt).toLocaleString("ru")
                    : "—"}
                  {existing.status === "error" && (
                    <span style={{ color: "var(--red)", marginLeft: 8 }} title={(existing as any).lastError || ""}>
                      ⚠️ Ошибка
                    </span>
                  )}
                  {/* Protection level badge */}
                  {existing.enabled && (() => {
                    const ad = (existing.config as any)?.antiDetect || {};
                    const mode = ad.mode || 'light';
                    const levels: Record<string, {icon: string; color: string; label: string}> = {
                      light: { icon: '🛡️', color: '#22c55e', label: 'Light' },
                      balanced: { icon: '⚔️', color: '#3b82f6', label: 'Balanced' },
                      stealth: { icon: '🕵️', color: '#8b5cf6', label: 'Stealth' },
                    };
                    const lv = levels[mode] || levels.light;
                    return (
                      <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 100, fontSize: 'var(--text-xs)', fontWeight: 600, background: lv.color + '18', color: lv.color, border: '1px solid ' + lv.color + '30' }}>
                        {lv.icon} {lv.label}
                      </span>
                    );
                  })()}
                </div>
              )}

              {/* Форма логина/пароля для Profi */}
              {connector.platform === "profi" && existing && (
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    const login = formData.get("login") as string;
                    const password = formData.get("password") as string;
                    const currentSource = await db.source.findUnique({ where: { id: existing.id } });
                    const currentConfig = (currentSource?.config as Record<string, unknown>) || {};
                    await db.source.update({
                      where: { id: existing.id },
                      data: { config: { ...currentConfig, login: login || "", password: password || "" } },
                    });
                    revalidatePath("/dashboard/sources");
                  }}
                >
                  {/* Инструкция */}
                  <div style={{
                    padding: "12px 14px", borderRadius: "var(--radius-sm)",
                    background: "var(--bg-layer)", border: "1px solid var(--border)",
                    marginBottom: 14, fontSize: "var(--text-xs)", lineHeight: 1.7, color: "var(--ink-muted)",
                  }}>
                    <p style={{ fontWeight: 650, color: "var(--ink-heading)", marginBottom: 6 }}>📖 Где взять логин?</p>
                    <ol style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, margin: 0 }}>
                      <li>Войдите на <b style={{color:"var(--accent)"}}>profi.ru</b> под своим аккаунтом</li>
                      <li>Перейдите в <b>Настройки анкеты</b> (шестерёнка вверху справа)</li>
                      <li>Найдите поле <b>«Логин»</b> — выглядит как <code style={{background:"var(--bg-root)",padding:"1px 4px",borderRadius:3}}>TimofeyevAG11</code></li>
                      <li>Скопируйте логин и введите ниже вместе с паролем от аккаунта</li>
                    </ol>
                  </div>

                  {/* Поля ввода */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={lbl}>👤 Логин Profi.ru</label>
                      <input name="login" defaultValue={(config.login as string) || ""}
                        placeholder="TimofeyevAG11" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>🔐 Пароль Profi.ru</label>
                      <input name="password" type="password" defaultValue={(config.password as string) || ""}
                        placeholder="••••••••" style={inp} />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button type="submit" style={{
                        padding: "8px 18px", borderRadius: "var(--radius-sm)",
                        background: "var(--accent)", color: "#fff", border: "none",
                        fontWeight: 600, fontSize: "var(--text-xs)", cursor: "pointer",
                      }}>
                        💾 Сохранить
                      </button>
                      <ProfiTestButton
                        sourceId={existing.id}
                        currentLogin={(config.login as string) || ""}
                        currentPassword={(config.password as string) || ""}
                      />
                    </div>
                  </div>
                </form>
              )}

              {/* Для неподключенных — кнопка подключить */}
              {!existing && (
                <form action={async () => {
                  "use server";
                  await db.source.create({
                    data: { workspaceId: workspace.id, platform: connector.platform, name: connector.name, color, enabled: true, config: { antiDetect: { mode: 'light' } } },
                  });
                  revalidatePath("/dashboard/sources");
                }}>
                  <button type="submit" style={{
                    padding: "10px 20px", borderRadius: "var(--radius-sm)",
                    background: color, color: "#fff", border: "none",
                    fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer",
                  }}>
                    Подключить {connector.name}
                  </button>
                </form>
              )}

              {/* Кнопка вкл/выкл */}
              {existing && (
                <form action={async () => {
                  "use server";
                  await db.source.update({ where: { id: existing.id }, data: { enabled: !existing.enabled } });
                  revalidatePath("/dashboard/sources");
                }} style={{ marginTop: 16 }}>
                  <button type="submit" style={{
                    padding: "6px 14px", borderRadius: "var(--radius-sm)",
                    background: existing.enabled ? "var(--red-soft)" : "var(--green-soft)",
                    color: existing.enabled ? "var(--red)" : "var(--green)",
                    border: `1px solid ${existing.enabled ? "var(--red)" : "var(--green)"}`,
                    fontWeight: 600, fontSize: "var(--text-xs)", cursor: "pointer",
                  }}>
                    {existing.enabled ? "⏸ Отключить" : "▶ Включить"}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {/* Плагинная архитектура */}
      <div style={{
        marginTop: 24, padding: "20px 24px", borderRadius: "var(--radius-lg)",
        background: "var(--bg-surface)", border: "1px solid var(--border)",
      }}>
        <p style={{ fontWeight: 650, fontSize: "var(--text-sm)", marginBottom: 6 }}>🔌 Плагинная архитектура</p>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", lineHeight: 1.6 }}>
          Каждый источник — отдельный коннектор. Новые площадки добавляются как модули без изменения ядра.
          В планах: Авито Услуги, FL.ru, Kwork, Telegram-каналы, VK Услуги, HH.ru.
        </p>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: "block", fontSize: "var(--text-xs)", color: "var(--ink-muted)",
  marginBottom: 4, fontWeight: 500,
};

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)", background: "var(--bg-root)",
  color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none",
  boxSizing: "border-box",
};
