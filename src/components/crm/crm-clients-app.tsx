"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { dueKindFor, formatDueLabel, nextStepAtToDateInput } from "@/lib/crm/due";
import { CRM_CONTACT_TYPES, CRM_LEAD_SOURCES, CRM_STATUSES, crmStatusLabel } from "@/lib/crm/statuses";

type Contact = { id: string; type: string; value: string; label: string | null; isPrimary: boolean };
type Client = {
  id: string;
  name: string;
  niche: string | null;
  city: string | null;
  status: string;
  connected: boolean;
  source: string | null;
  notes: string | null;
  nextStep: string | null;
  nextStepAt: string | null;
  owner: { id: string; email: string; name: string } | null;
  contacts: Contact[];
  linkedPartner: { email: string; name: string; workspaceId: string } | null;
  updatedAt: string;
};

type PartnerOpt = { workspaceId: string; email: string; name: string };

const box: CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: 12,
};
const inp: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--bg-layer)",
  color: "var(--ink-body)",
  fontSize: "var(--text-sm)",
};
const btn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  cursor: "pointer",
};
const btnGhost: CSSProperties = {
  ...btn,
  background: "transparent",
  color: "var(--ink-body)",
  border: "1px solid var(--border)",
};
const hint: CSSProperties = {
  margin: 0,
  fontSize: "0.7rem",
  color: "var(--ink-muted)",
  lineHeight: 1.35,
};

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: wide ? "min(640px, 100%)" : "min(480px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, margin: 0 }}>{title}</h3>
            {subtitle && (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", margin: "4px 0 0" }}>{subtitle}</p>
            )}
          </div>
          <button type="button" onClick={onClose} style={{ ...btnGhost, padding: "4px 10px" }} aria-label="Закрыть">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function CrmClientsApp({ isAdmin }: { isAdmin: boolean }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [readyCount, setReadyCount] = useState(0);
  const [dueTodayCount, setDueTodayCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [status, setStatus] = useState("");
  const [due, setDue] = useState<"" | "today" | "overdue">("");
  const [q, setQ] = useState("");
  const [readyOnly, setReadyOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [partners, setPartners] = useState<PartnerOpt[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    niche: "",
    city: "",
    source: "ads",
    telegram: "",
    notes: "",
    nextStep: "",
    nextStepAt: "",
  });

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (readyOnly) params.set("ready", "1");
    else if (status) params.set("status", status);
    if (due) params.set("due", due);
    if (q.trim()) params.set("q", q.trim());
    if (isAdmin && mineOnly) params.set("mine", "1");
    const r = await fetch(`/api/crm/clients?${params}`);
    const d = await r.json();
    if (!r.ok) {
      setErr(d.error || "Ошибка загрузки");
      return;
    }
    const list: Client[] = d.clients || [];
    setClients(list);
    setCounts(d.counts || {});
    setReadyCount(d.readyCount || 0);
    setDueTodayCount(d.dueTodayCount || 0);
    setOverdueCount(d.overdueCount || 0);
    setErr(null);
    if (selectedId) {
      const fresh = list.find((c) => c.id === selectedId);
      if (fresh) setSelected(fresh);
    }
  }, [status, q, readyOnly, mineOnly, isAdmin, due, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/crm/partner-options")
      .then((r) => r.json())
      .then((d) => setPartners(d.partners || []))
      .catch(() => null);
  }, [isAdmin]);

  async function openClient(id: string) {
    setSelectedId(id);
    const fromList = clients.find((c) => c.id === id);
    if (fromList) setSelected(fromList);
    const r = await fetch(`/api/crm/clients/${id}`);
    const d = await r.json();
    if (r.ok) setSelected(d.client);
  }

  function closeDetail() {
    setSelectedId(null);
    setSelected(null);
  }

  async function createClient() {
    if (!form.name.trim()) return;
    setCreating(true);
    const contacts = form.telegram.trim()
      ? [{ type: "telegram", value: form.telegram.trim(), isPrimary: true }]
      : [];
    const r = await fetch("/api/crm/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        niche: form.niche || null,
        city: form.city || null,
        source: form.source || null,
        notes: form.notes.trim() || null,
        nextStep: form.nextStep.trim() || null,
        nextStepAt: form.nextStepAt || null,
        contacts,
      }),
    });
    const d = await r.json();
    setCreating(false);
    if (!r.ok) {
      setErr(d.error || "Не создано");
      return;
    }
    setForm({
      name: "",
      niche: "",
      city: "",
      source: "ads",
      telegram: "",
      notes: "",
      nextStep: "",
      nextStepAt: "",
    });
    setShowCreate(false);
    setSelectedId(d.client.id);
    setSelected(d.client);
    await load();
  }

  async function saveSelected(patch: Record<string, unknown>) {
    if (!selected) return;
    const r = await fetch(`/api/crm/clients/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const d = await r.json();
    if (!r.ok) {
      setErr(d.error || "Не сохранено");
      return;
    }
    setSelected(d.client);
    await load();
  }

  async function addContact(type: string, value: string) {
    if (!selected || !value.trim()) return;
    await fetch(`/api/crm/clients/${selected.id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, value: value.trim(), isPrimary: selected.contacts.length === 0 }),
    });
    const r = await fetch(`/api/crm/clients/${selected.id}`);
    const d = await r.json();
    if (r.ok) setSelected(d.client);
    await load();
  }

  async function removeContact(contactId: string) {
    if (!selected) return;
    await fetch(`/api/crm/clients/${selected.id}/contacts?contactId=${contactId}`, { method: "DELETE" });
    const r = await fetch(`/api/crm/clients/${selected.id}`);
    const d = await r.json();
    if (r.ok) setSelected(d.client);
    await load();
  }

  function setDueFilter(v: "" | "today" | "overdue") {
    setDue(v);
    if (v) {
      setReadyOnly(false);
      setStatus("");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, margin: 0 }}>Наши клиенты</h1>
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", margin: "4px 0 0" }}>
            {isAdmin
              ? "Компактный список. Карточка и добавление — в окне."
              : "Ваши клиенты. Нажмите строку, чтобы открыть карточку."}
          </p>
        </div>
        <button type="button" style={btn} onClick={() => setShowCreate(true)}>
          + Клиент
        </button>
      </div>

      {err && (
        <div style={{ ...box, marginBottom: 10, borderColor: "var(--red)", color: "var(--red)" }}>{err}</div>
      )}

      <div style={{ ...box, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input
          style={{ ...inp, flex: "1 1 180px", minWidth: 140, maxWidth: 280, padding: "6px 10px" }}
          placeholder="Поиск…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          style={{ ...inp, width: "auto", padding: "6px 10px" }}
          value={due || (readyOnly ? "ready_q" : status)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "due_today") setDueFilter("today");
            else if (v === "due_overdue") setDueFilter("overdue");
            else if (v === "ready_q") {
              setDue("");
              setReadyOnly(true);
              setStatus("");
            } else {
              setDue("");
              setReadyOnly(false);
              setStatus(v);
            }
          }}
        >
          <option value="">Все статусы</option>
          <option value="due_today">Сегодня ({dueTodayCount})</option>
          <option value="due_overdue">Просрочено ({overdueCount})</option>
          {isAdmin && <option value="ready_q">К подключению ({readyCount})</option>}
          {CRM_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({counts[s.id] || 0})
            </option>
          ))}
        </select>
        {overdueCount > 0 && (
          <button
            type="button"
            style={{ ...btn, padding: "6px 10px", fontSize: 12, background: due === "overdue" ? "#991b1b" : "#dc2626" }}
            onClick={() => setDueFilter(due === "overdue" ? "" : "overdue")}
          >
            Просрочено {overdueCount}
          </button>
        )}
        {dueTodayCount > 0 && (
          <button
            type="button"
            style={{ ...btn, padding: "6px 10px", fontSize: 12, background: due === "today" ? "#92400e" : "#d97706" }}
            onClick={() => setDueFilter(due === "today" ? "" : "today")}
          >
            Сегодня {dueTodayCount}
          </button>
        )}
        {isAdmin && (
          <label style={{ fontSize: "var(--text-xs)", display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            Только мои
          </label>
        )}
        <span style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>{clients.length} в списке</span>
      </div>

      <div style={{ ...box, padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isAdmin
              ? "minmax(120px, 1.4fr) 100px minmax(90px, 1fr) minmax(100px, 1fr) 90px"
              : "minmax(120px, 1.4fr) 100px minmax(90px, 1fr) minmax(100px, 1fr)",
            gap: 8,
            padding: "8px 12px",
            fontSize: "0.65rem",
            fontWeight: 700,
            color: "var(--ink-muted)",
            textTransform: "uppercase",
            letterSpacing: 0.04,
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-layer)",
          }}
        >
          <span>Клиент</span>
          <span>Статус</span>
          <span>Шаг / дата</span>
          <span>Контакт</span>
          {isAdmin && <span>Ответств.</span>}
        </div>

        {clients.length === 0 && (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", margin: 0, padding: 16 }}>
            {due === "today"
              ? "На сегодня шагов нет."
              : due === "overdue"
                ? "Просрочек нет."
                : "Пока пусто — нажмите «+ Клиент»."}
          </p>
        )}

        <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
          {clients.map((c) => {
            const kind = dueKindFor(c.nextStepAt);
            const dueLabel = formatDueLabel(c.nextStepAt);
            const primary = c.contacts.find((x) => x.isPrimary) || c.contacts[0];
            const active = selectedId === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openClient(c.id)}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: isAdmin
                      ? "minmax(120px, 1.4fr) 100px minmax(90px, 1fr) minmax(100px, 1fr) 90px"
                      : "minmax(120px, 1.4fr) 100px minmax(90px, 1fr) minmax(100px, 1fr)",
                    gap: 8,
                    alignItems: "center",
                    textAlign: "left",
                    padding: "7px 12px",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    background: active ? "var(--accent-soft)" : "transparent",
                    cursor: "pointer",
                    color: "var(--ink-body)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                      {c.connected ? " · ✓" : ""}
                    </span>
                    <span style={{ fontSize: "0.65rem", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                      {[c.niche, c.city].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>{crmStatusLabel(c.status)}</span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: kind === "overdue" || kind === "today" ? 700 : 500,
                      color: kind === "overdue" ? "#dc2626" : kind === "today" ? "#d97706" : "var(--ink-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.nextStep || "—"}
                    {dueLabel ? ` · ${dueLabel}` : ""}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {primary ? primary.value : "—"}
                  </span>
                  {isAdmin && (
                    <span style={{ fontSize: "0.65rem", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.owner?.name?.split(" ")[0] || c.owner?.email?.split("@")[0] || "—"}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {showCreate && (
        <ModalShell
          title="Новый клиент"
          subtitle="После сохранения откроется карточка."
          onClose={() => setShowCreate(false)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input style={inp} placeholder="Имя / как обращаться" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input style={inp} placeholder="Ниша" value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} />
              <input style={inp} placeholder="Город" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <input style={inp} placeholder="Telegram" value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} />
            <select style={inp} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {CRM_LEAD_SOURCES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <div>
              <textarea
                style={{ ...inp, minHeight: 64, resize: "vertical" }}
                placeholder="Заметка: откуда человек, о чём договорились…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <p style={hint}>Свободный текст. Не пишите пароли Profi / VPS.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                style={inp}
                placeholder="След. шаг (Zoom / follow-up)"
                value={form.nextStep}
                onChange={(e) => setForm({ ...form, nextStep: e.target.value })}
              />
              <div>
                <input
                  type="date"
                  style={inp}
                  value={form.nextStepAt}
                  onChange={(e) => setForm({ ...form, nextStepAt: e.target.value })}
                />
                <p style={hint}>Дата шага → «сегодня / просрочено».</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button type="button" style={btnGhost} onClick={() => setShowCreate(false)}>Отмена</button>
              <button type="button" style={btn} disabled={creating || !form.name.trim()} onClick={createClient}>
                {creating ? "…" : "Создать"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {selected && (
        <ModalShell
          title={selected.name}
          subtitle={[selected.niche, selected.city].filter(Boolean).join(" · ") || undefined}
          onClose={closeDetail}
          wide
        >
          <ClientDetail
            client={selected}
            isAdmin={isAdmin}
            partners={partners}
            onSave={saveSelected}
            onAddContact={addContact}
            onRemoveContact={removeContact}
            onDelete={
              isAdmin
                ? async () => {
                    if (!confirm("Удалить карточку?")) return;
                    await fetch(`/api/crm/clients/${selected.id}`, { method: "DELETE" });
                    closeDetail();
                    await load();
                  }
                : undefined
            }
          />
        </ModalShell>
      )}
    </div>
  );
}

function ClientDetail({
  client,
  isAdmin,
  partners,
  onSave,
  onAddContact,
  onRemoveContact,
  onDelete,
}: {
  client: Client;
  isAdmin: boolean;
  partners: PartnerOpt[];
  onSave: (p: Record<string, unknown>) => Promise<void>;
  onAddContact: (type: string, value: string) => Promise<void>;
  onRemoveContact: (id: string) => Promise<void>;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(client.name);
  const [niche, setNiche] = useState(client.niche || "");
  const [city, setCity] = useState(client.city || "");
  const [notes, setNotes] = useState(client.notes || "");
  const [nextStep, setNextStep] = useState(client.nextStep || "");
  const [nextStepAt, setNextStepAt] = useState(nextStepAtToDateInput(client.nextStepAt));
  const [status, setStatus] = useState(client.status);
  const [source, setSource] = useState(client.source || "");
  const [contactType, setContactType] = useState("telegram");
  const [contactValue, setContactValue] = useState("");
  const [linkWs, setLinkWs] = useState(client.linkedPartner?.workspaceId || "");

  useEffect(() => {
    setName(client.name);
    setNiche(client.niche || "");
    setCity(client.city || "");
    setNotes(client.notes || "");
    setNextStep(client.nextStep || "");
    setNextStepAt(nextStepAtToDateInput(client.nextStepAt));
    setStatus(client.status);
    setSource(client.source || "");
    setLinkWs(client.linkedPartner?.workspaceId || "");
  }, [client]);

  const kind = dueKindFor(client.nextStepAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {client.connected && (
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--accent)" }}>ПОДКЛЮЧЕН</span>
      )}
      {isAdmin && client.owner && (
        <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
          Ответственный: {client.owner.name} ({client.owner.email})
        </p>
      )}
      <input style={inp} value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input style={inp} placeholder="Ниша" value={niche} onChange={(e) => setNiche(e.target.value)} />
        <input style={inp} placeholder="Город" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select style={inp} value={status} onChange={(e) => setStatus(e.target.value)}>
          {CRM_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <select style={inp} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Источник</option>
          {CRM_LEAD_SOURCES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={{ ...hint, display: "block", marginBottom: 4 }}>Следующий шаг</label>
          <input
            style={inp}
            placeholder="Zoom / follow-up"
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
          />
        </div>
        <div>
          <label style={{ ...hint, display: "block", marginBottom: 4 }}>
            Дата (МСК)
            {kind === "overdue" && <span style={{ color: "#dc2626", fontWeight: 700 }}> · просрочено</span>}
            {kind === "today" && <span style={{ color: "#d97706", fontWeight: 700 }}> · сегодня</span>}
          </label>
          <input type="date" style={inp} value={nextStepAt} onChange={(e) => setNextStepAt(e.target.value)} />
        </div>
      </div>

      <div>
        <label style={{ ...hint, display: "block", marginBottom: 4 }}>Заметка</label>
        <textarea
          style={{ ...inp, minHeight: 72 }}
          placeholder="Контекст разговора…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button
        type="button"
        style={btn}
        onClick={() =>
          onSave({
            name,
            niche: niche || null,
            city: city || null,
            status,
            source: source || null,
            nextStep: nextStep || null,
            nextStepAt: nextStepAt || null,
            notes: notes || null,
          })
        }
      >
        Сохранить
      </button>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <strong style={{ fontSize: "var(--text-sm)" }}>Контакты</strong>
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0" }}>
          {client.contacts.map((c) => (
            <li key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "var(--text-sm)", marginBottom: 4 }}>
              <span>{c.type}: {c.value}</span>
              <button type="button" onClick={() => onRemoveContact(c.id)} style={{ border: "none", background: "transparent", color: "var(--red)", cursor: "pointer" }}>×</button>
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", gap: 6 }}>
          <select style={{ ...inp, width: 120 }} value={contactType} onChange={(e) => setContactType(e.target.value)}>
            {CRM_CONTACT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <input style={inp} placeholder="Значение" value={contactValue} onChange={(e) => setContactValue(e.target.value)} />
          <button
            type="button"
            style={btn}
            onClick={async () => {
              await onAddContact(contactType, contactValue);
              setContactValue("");
            }}
          >
            +
          </button>
        </div>
      </div>

      {isAdmin && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <strong style={{ fontSize: "var(--text-sm)" }}>Связь с партнёром</strong>
          <select style={{ ...inp, marginTop: 8 }} value={linkWs} onChange={(e) => setLinkWs(e.target.value)}>
            <option value="">Не связан</option>
            {partners.map((p) => (
              <option key={p.workspaceId} value={p.workspaceId}>{p.name} · {p.email}</option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" style={btn} onClick={() => onSave({ linkedWorkspaceId: linkWs || null })}>
              Привязать
            </button>
            <a href="/dashboard/admin/new" style={{ ...btn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              + Подключить
            </a>
          </div>
        </div>
      )}

      {onDelete && (
        <button type="button" onClick={onDelete} style={{ ...btnGhost, color: "var(--red)", borderColor: "var(--red)", marginTop: 4 }}>
          Удалить карточку
        </button>
      )}
    </div>
  );
}
