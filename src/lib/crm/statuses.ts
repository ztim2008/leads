export const CRM_STATUSES = [
  { id: "lead", label: "Потенциал", tone: "muted" },
  { id: "zoom", label: "Zoom", tone: "info" },
  { id: "agreed", label: "Договорились", tone: "ok" },
  { id: "ready", label: "К подключению", tone: "warn" },
  { id: "connected", label: "Подключен", tone: "ok" },
  { id: "paused", label: "Пауза", tone: "muted" },
  { id: "rejected", label: "Отказ", tone: "bad" },
] as const;

export type CrmStatusId = (typeof CRM_STATUSES)[number]["id"];

export const CRM_STATUS_IDS = CRM_STATUSES.map((s) => s.id);

export function crmStatusLabel(id: string): string {
  return CRM_STATUSES.find((s) => s.id === id)?.label || id;
}

export const CRM_LEAD_SOURCES = [
  { id: "ads", label: "Реклама" },
  { id: "profi", label: "Profi / поиск" },
  { id: "referral", label: "Рекомендация" },
  { id: "zoom", label: "Zoom" },
  { id: "other", label: "Другое" },
] as const;

export const CRM_CONTACT_TYPES = [
  { id: "telegram", label: "Telegram" },
  { id: "phone", label: "Телефон" },
  { id: "email", label: "Email" },
  { id: "other", label: "Другое" },
] as const;

export function isConnectedStatus(status: string): boolean {
  return status === "connected";
}
