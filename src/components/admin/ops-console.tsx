"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PartnerAccessCardModal from "@/components/admin/partner-access-card";
import type { PartnerAccessCard } from "@/lib/admin/access-card";
import {
  CollectorFlowMap,
  ageShort,
  clock,
  type FlowEvent,
  type FlowNode,
  type FlowTone,
} from "@/components/admin/collector-flow-map";
import SystemDoctor from "@/components/admin/system-doctor";

type PartnerRow = {
  id: string;
  email: string;
  name?: string | null;
  subscription?: {
    leadsPerMonth?: number;
    leadsUsedMonth?: number;
    collectionEnabled?: boolean;
    expiresAt?: string | null;
  } | null;
  workspace?: {
    leadsCount?: number;
    leadsToday?: number;
    leadsYesterday?: number;
    lastLead?: {
      title?: string | null;
      createdAt?: string | null;
    } | null;
    telegramAttemptedToday?: number;
    telegramDeliveredToday?: number;
    settings?: { telegramChatId?: string | null };
    sources?: Array<{
      id: string;
      enabled: boolean;
      lastError?: string | null;
      lastErrorArchived?: string | null;
      config?: {
        login?: string | null;
        _vpsIp?: string | null;
        workHoursStart?: string;
        workHoursEnd?: string;
        pollPreset?: string;
        pollMinMinutes?: number;
        pollMaxMinutes?: number;
        _lastLoginAt?: string | null;
      };
      agentStatus?: {
        online?: boolean;
        lastHeartbeat?: string | null;
        lastError?: string | null;
        lastErrorArchived?: string | null;
        lastErrorTime?: string | null;
        lifecycle?: string;
        circuitBreaker?: { state?: string } | null;
        errors?: number;
        checkIntervalLabel?: string;
      };
    }>;
  } | null;
};

function ageLabel(iso?: string | null): string {
  if (!iso) return "нет";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "сейчас";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "<1 мин";
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} д`;
}

function light(ok: boolean | undefined, warn?: boolean): string {
  if (warn) return "var(--amber)";
  if (ok) return "var(--green)";
  return "var(--red)";
}

function buildFlow(p: PartnerRow | undefined): { nodes: FlowNode[]; events: FlowEvent[] } {
  if (!p) return { nodes: [], events: [] };
  const src = p.workspace?.sources?.[0];
  const a = src?.agentStatus;
  const cb = a?.circuitBreaker?.state || "";
  const cbBad = cb === "OPEN" || cb === "BLOCKED";
  const online = !!a?.online;
  const hasTg = !!p.workspace?.settings?.telegramChatId;
  const leadsToday = p.workspace?.leadsToday ?? 0;
  const tgAttempted = p.workspace?.telegramAttemptedToday ?? 0;
  const tgToday = p.workspace?.telegramDeliveredToday ?? 0;
  const tgMismatch = hasTg && tgToday < tgAttempted;
  const tgTrackingPartial = tgAttempted < leadsToday;
  const err = a?.lastError || src?.lastError || null;
  const archived = a?.lastErrorArchived || src?.lastErrorArchived || null;

  const agentTone: FlowTone = !src ? "off" : cbBad ? "bad" : !src.enabled ? "off" : online ? "ok" : "warn";
  const profiTone: FlowTone = cbBad ? "bad" : err && /login_failed/i.test(err) ? "bad" : online ? "ok" : "warn";
  const tgTone: FlowTone = !hasTg ? "warn" : tgMismatch ? "warn" : "ok";
  const vpsTone: FlowTone = src?.config?._vpsIp ? (online ? "ok" : "warn") : "off";

  return {
    nodes: [
      {
        id: "vps",
        title: "VPS",
        subtitle: src?.config?._vpsIp || "нет IP",
        meta: src?.enabled ? "сбор вкл" : "сбор выкл",
        tone: vpsTone,
      },
      {
        id: "agent",
        title: "Agent v2",
        subtitle: online ? "online" : src ? "offline" : "не установлен",
        meta: `${a?.lifecycle || "—"} · HB ${ageShort(a?.lastHeartbeat)}`,
        tone: agentTone,
      },
      {
        id: "profi",
        title: "Profi",
        subtitle: src?.config?.login || "нет логина",
        meta: cb ? `CB ${cb}` : "CB —",
        tone: profiTone,
      },
      {
        id: "hub",
        title: "Хаб",
        subtitle: `сегодня ${leadsToday}`,
        meta: `квота ${p.subscription?.leadsUsedMonth ?? 0}/${p.subscription?.leadsPerMonth ?? "—"}`,
        tone: "ok",
      },
      {
        id: "tg",
        title: "Telegram",
        subtitle: hasTg ? `${tgToday} из ${tgAttempted} попыток` : "не привязан",
        meta: !hasTg
          ? "нужен /start"
          : tgMismatch
            ? "есть ошибка доставки"
            : tgTrackingPartial
              ? "учёт включён сегодня"
              : "доставка подтверждена",
        tone: tgTone,
      },
    ],
    events: [
      { at: clock(a?.lastHeartbeat), label: `Heartbeat ${online ? "ok" : "нет / старше 15 мин"}`, tone: online ? "ok" : "warn" },
      {
        at: clock(src?.config?._lastLoginAt),
        label: src?.config?._lastLoginAt ? "Последний вход Profi (хаб)" : "Вход Profi: нет метки (норма, если сессия с кук)",
        tone: "ok",
      },
      {
        at: clock(a?.lastErrorTime),
        label: err
          ? `Ошибка: ${err}`
          : archived
            ? `Архив: ${archived} (вход потом ок, не сейчас)`
            : "Ошибок нет",
        tone: err ? "bad" : "ok",
      },
      {
        at: "сегодня",
        label: `Заявок: ${leadsToday} в БД · ${tgToday}/${tgAttempted} доставлено в TG${tgTrackingPartial ? " (учёт включён сегодня)" : ""} · интервал ${a?.checkIntervalLabel || "3–7 мин"} · часы ${src?.config?.workHoursStart || "08:00"}–${src?.config?.workHoursEnd || "22:00"} МСК`,
        tone: tgMismatch ? "warn" : "ok",
      },
    ],
  };
}

export default function OpsConsole() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [accessCard, setAccessCard] = useState<PartnerAccessCard | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/partners");
      const d = await r.json();
      setPartners(d.partners || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!selected && partners[0]?.id) setSelected(partners[0].id);
  }, [partners, selected]);

  const fleet = useMemo(() => {
    let online = 0;
    let offline = 0;
    let cbOpen = 0;
    let leadsToday = 0;
    let leadsYesterday = 0;
    let telegramAttemptedToday = 0;
    let telegramDeliveredToday = 0;
    let errors = 0;
    for (const p of partners) {
      const src = p.workspace?.sources?.[0];
      const a = src?.agentStatus;
      if (a?.online) online += 1;
      else offline += 1;
      const cb = a?.circuitBreaker?.state;
      if (cb && cb !== "CLOSED") cbOpen += 1;
      leadsToday += p.workspace?.leadsToday || 0;
      leadsYesterday += p.workspace?.leadsYesterday || 0;
      telegramAttemptedToday += p.workspace?.telegramAttemptedToday || 0;
      telegramDeliveredToday += p.workspace?.telegramDeliveredToday || 0;
      if (a?.lastError || src?.lastError) errors += 1;
    }
    return { online, offline, cbOpen, leadsToday, leadsYesterday, telegramAttemptedToday, telegramDeliveredToday, errors, total: partners.length };
  }, [partners]);

  const focus = partners.find((p) => p.id === selected) || partners[0];
  const flow = useMemo(() => buildFlow(focus), [focus]);

  async function openAccess(partnerId: string) {
    const r = await fetch(`/api/admin/partners/${partnerId}/secrets`);
    const d = await r.json();
    if (d.ok && d.accessCard) setAccessCard(d.accessCard);
  }

  if (loading) {
    return <p style={{ color: "var(--ink-muted)" }}>Загрузка пульта…</p>;
  }

  return (
    <div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginBottom: 16 }}>
        Диспетчерская. Схема питается с `/api/admin/partners`, без n8n. Сборщик = agent v2. Пароли — только «Доступ».
      </p>

      <SystemDoctor />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 20 }}>
        <Stat label="Партнёры" value={String(fleet.total)} />
        <Stat label="Online" value={String(fleet.online)} color="var(--green)" />
        <Stat label="Offline" value={String(fleet.offline)} color={fleet.offline ? "var(--amber)" : undefined} />
        <Stat label="CB ≠ CLOSED" value={String(fleet.cbOpen)} color={fleet.cbOpen ? "var(--red)" : undefined} />
        <Stat label="Заявок сегодня" value={String(fleet.leadsToday)} />
        <Stat label="Заявок вчера" value={String(fleet.leadsYesterday)} />
        <Stat
          label="Доставлено в TG"
          value={String(fleet.telegramDeliveredToday)}
          color={fleet.telegramDeliveredToday < fleet.telegramAttemptedToday ? "var(--amber)" : "var(--green)"}
        />
        <Stat label="Ошибки агентов" value={String(fleet.errors)} color={fleet.errors ? "var(--amber)" : undefined} />
      </div>

      {focus && <DailyProduction partner={focus} />}

      {focus && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-surface)",
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <strong style={{ fontSize: "var(--text-sm)" }}>
              Поток: {focus.name || focus.email}
            </strong>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>клик по строке ниже — другой партнёр</span>
          </div>
          <CollectorFlowMap
            caption="VPS → Agent v2 → Profi → Хаб → Telegram. Цвет = живой статус, не скрипт."
            nodes={flow.nodes}
            events={flow.events}
          />
        </div>
      )}

      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={th}></th>
              <th style={th}>Партнёр</th>
              <th style={th}>Агент</th>
              <th style={th}>CB</th>
              <th style={th}>Heartbeat</th>
              <th style={th}>Сегодня / вчера / TG</th>
              <th style={th}>Интервал</th>
              <th style={th}>Часы / IP</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => {
              const src = p.workspace?.sources?.[0];
              const a = src?.agentStatus;
              const cb = a?.circuitBreaker?.state || "—";
              const cbBad = cb !== "CLOSED" && cb !== "—";
              const open = selected === p.id;
              const used = p.subscription?.leadsUsedMonth ?? 0;
              const limit = p.subscription?.leadsPerMonth ?? 0;
              const dbToday = p.workspace?.leadsToday ?? 0;
              const dbYesterday = p.workspace?.leadsYesterday ?? 0;
              const tgAttempted = p.workspace?.telegramAttemptedToday ?? 0;
              const tgToday = p.workspace?.telegramDeliveredToday ?? 0;
              const tgMismatch = tgToday < tgAttempted;
              const tgTrackingPartial = tgAttempted < dbToday;
              return (
                <tbody key={p.id} style={{ display: "table-row-group" }}>
                  <tr
                    style={{ borderBottom: "1px solid var(--border-light)", cursor: "pointer" }}
                    onClick={() => setSelected(open ? null : p.id)}
                  >
                    <td style={td}>
                      <span
                        title={a?.online ? "online" : "offline"}
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: light(a?.online, !src),
                        }}
                      />
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 650 }}>{p.name || p.email}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{p.email}</div>
                    </td>
                    <td style={td}>
                      <span style={{ color: a?.online ? "var(--green)" : "var(--ink-muted)", fontSize: "var(--text-xs)", fontWeight: 600 }}>
                        {a?.online ? "online" : src ? "offline" : "нет source"}
                      </span>
                      <div style={{ fontSize: "0.65rem", color: "var(--ink-muted)" }}>{a?.lifecycle || ""}</div>
                    </td>
                    <td style={{ ...td, color: cbBad ? "var(--red)" : "var(--ink-body)", fontWeight: 650, fontSize: "var(--text-xs)" }}>
                      {cb}
                    </td>
                    <td style={{ ...td, fontSize: "var(--text-xs)" }}>{ageLabel(a?.lastHeartbeat)}</td>
                    <td style={td}>
                      <span style={{ fontWeight: 650 }}>{dbToday}</span>
                      <span style={{ color: "var(--ink-muted)" }}> / {dbYesterday}</span>
                      <span style={{ color: tgMismatch ? "var(--amber)" : "var(--green)", fontWeight: 650 }}>
                        {" "}/ {tgToday}
                      </span>
                      <div style={{ color: "var(--ink-muted)", fontSize: "0.65rem" }}>
                        квота {used}/{limit || "—"} · последняя {ageLabel(p.workspace?.lastLead?.createdAt)}
                      </div>
                      {tgMismatch && (
                        <div style={{ color: "var(--amber)", fontSize: "0.65rem" }}>⚠ TG не дошло</div>
                      )}
                      {!tgMismatch && tgTrackingPartial && (
                        <div style={{ color: "var(--ink-muted)", fontSize: "0.65rem" }}>
                          TG {tgToday}/{tgAttempted}, учёт включён сегодня
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, fontSize: "var(--text-xs)" }}>{a?.checkIntervalLabel || "3–7 мин"}</td>
                    <td style={{ ...td, fontSize: "var(--text-xs)" }}>
                      {src?.config?.workHoursStart || "08:00"}–{src?.config?.workHoursEnd || "22:00"}
                      <div style={{ color: "var(--ink-muted)" }}>{src?.config?._vpsIp || "IP —"}</div>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={8} style={{ padding: "14px 20px", background: "var(--bg-layer)", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: "var(--text-sm)" }}>
                          <div>
                            <p style={{ fontWeight: 650, marginBottom: 8 }}>Детали</p>
                            <p>Profi: {src?.config?.login || "—"}</p>
                            <p>SOURCE: <code>{src?.id || "—"}</code></p>
                            <p>Сбор: {src?.enabled ? "вкл" : "выкл"}</p>
                            <p>
                              Последняя ошибка:{" "}
                              {a?.lastError || src?.lastError
                                ? a?.lastError || src?.lastError
                                : a?.lastErrorArchived || src?.lastErrorArchived
                                  ? `нет (архив: ${a?.lastErrorArchived || src?.lastErrorArchived})`
                                  : "нет"}
                            </p>
                            <p>Last login (хаб): {src?.config?._lastLoginAt ? ageLabel(src.config._lastLoginAt) : "—"}</p>
                          </div>
                          <div>
                            <p style={{ fontWeight: 650, marginBottom: 8 }}>Действия</p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAccess(p.id);
                              }}
                              style={{
                                padding: "8px 14px",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--border)",
                                background: "var(--bg-surface)",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: "var(--text-xs)",
                              }}
                            >
                              Карточка доступа
                            </button>
                            {src?.id && (
                              <PollIntervalControl
                                sourceId={src.id}
                                currentPreset={(src.config?.pollPreset as string) || "standard"}
                                label={a?.checkIntervalLabel || "3–7 мин"}
                                onSaved={load}
                              />
                            )}
                            <p style={{ marginTop: 10, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                              Интервал ленты — только админ. Документ: docs/PROFI_POLL_LOGISTICS.md. Пол не короче 2 мин.
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </tbody>
        </table>
        {partners.length === 0 && (
          <p style={{ padding: 24, color: "var(--ink-muted)", textAlign: "center" }}>Партнёров нет</p>
        )}
      </div>

      {accessCard && (
        <PartnerAccessCardModal card={accessCard} onClose={() => setAccessCard(null)} />
      )}
    </div>
  );
}

function DailyProduction({ partner }: { partner: PartnerRow }) {
  const today = partner.workspace?.leadsToday ?? 0;
  const yesterday = partner.workspace?.leadsYesterday ?? 0;
  const delivered = partner.workspace?.telegramDeliveredToday ?? 0;
  const attempted = partner.workspace?.telegramAttemptedToday ?? 0;
  const last = partner.workspace?.lastLead;
  const diff = today - yesterday;
  const lastTime = last?.createdAt
    ? new Date(last.createdAt).toLocaleTimeString("ru-RU", {
        timeZone: "Europe/Moscow",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const progress = Math.min(100, Math.round((today / 15) * 100));

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-surface)",
        padding: 16,
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <strong style={{ fontSize: "var(--text-sm)" }}>
            Выработка дня: {partner.name || partner.email}
          </strong>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 3 }}>
            Счётчик автоматически с 00:00 МСК, история не удаляется
          </div>
        </div>
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 650,
            color: diff >= 0 ? "var(--green)" : "var(--amber)",
          }}
        >
          к вчера: {diff > 0 ? "+" : ""}{diff}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <MiniMetric label="Собрано сегодня" value={String(today)} />
        <MiniMetric label="Вчера за день" value={String(yesterday)} />
        <MiniMetric
          label="Доставлено в TG"
          value={`${delivered}/${attempted}`}
          color={delivered < attempted ? "var(--amber)" : "var(--green)"}
        />
        <MiniMetric label="Последняя заявка" value={lastTime} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ height: 7, borderRadius: 999, background: "var(--bg-layer)", overflow: "hidden" }}>
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: today >= 8 ? "var(--green)" : "var(--accent)",
              borderRadius: 999,
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6, fontSize: "0.65rem", color: "var(--ink-muted)" }}>
          <span>Ориентир пилота «сайты»: 8–15/день, не алерт</span>
          <span>{last?.title ? `${lastTime} · ${last.title.slice(0, 70)}` : "заявок ещё нет"}</span>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "var(--bg-layer)" }}>
      <div style={{ fontSize: "0.65rem", color: "var(--ink-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: color || "var(--ink-heading)" }}>{value}</div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: 14, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--bg-surface)" }}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: color || "var(--ink-heading)" }}>{value}</div>
    </div>
  );
}

function PollIntervalControl({
  sourceId,
  currentPreset,
  label,
  onSaved,
}: {
  sourceId: string;
  currentPreset: string;
  label: string;
  onSaved: () => void;
}) {
  const [preset, setPreset] = useState(currentPreset || "standard");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setPreset(currentPreset || "standard");
  }, [currentPreset, sourceId]);

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/poll-interval", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId, preset }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMsg(d.error || "Ошибка");
      return;
    }
    setMsg(`Сохранено: ${d.poll?.label || ""}. ${d.note || ""}`);
    onSaved();
  }

  return (
    <div style={{ marginTop: 12, padding: 10, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg-surface)" }}>
      <p style={{ fontWeight: 650, margin: "0 0 6px", fontSize: "var(--text-xs)" }}>Интервал Profi → TG</p>
      <p style={{ margin: "0 0 8px", fontSize: "0.65rem", color: "var(--ink-muted)" }}>
        Сейчас: {label}. TG после нахождения — секунды; задержка = сон между проверками ленты.
      </p>
      <select
        value={preset}
        onChange={(e) => setPreset(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          padding: "6px 8px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          background: "var(--bg-layer)",
          color: "var(--ink-body)",
          fontSize: "var(--text-xs)",
          marginBottom: 8,
        }}
      >
        <option value="calm">Спокойный · 5–9 мин (ниже риск)</option>
        <option value="standard">Стандарт · 3–7 мин</option>
        <option value="responsive">Быстрее отклик · 2–4 мин (выше риск)</option>
      </select>
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          save();
        }}
        style={{
          padding: "6px 12px",
          borderRadius: "var(--radius-sm)",
          border: "none",
          background: "var(--accent)",
          color: "#fff",
          fontWeight: 600,
          fontSize: "var(--text-xs)",
          cursor: "pointer",
        }}
      >
        {busy ? "…" : "Применить"}
      </button>
      {msg && <p style={{ margin: "8px 0 0", fontSize: "0.65rem", color: "var(--ink-muted)" }}>{msg}</p>}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)" };
const td: React.CSSProperties = { padding: "10px 12px", fontSize: "var(--text-sm)", verticalAlign: "top" };
