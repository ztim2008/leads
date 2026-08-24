/** 1–3 шаблона отклика партнёра. Без AI и без авто-отправки на Profi. */

export const MAX_REPLY_TEMPLATES = 3;
const NAME_MAX = 40;
const BODY_MAX = 900;

export type ReplyTemplate = {
  id: string;
  name: string;
  body: string;
};

export type ReplyFillVars = {
  author?: string | null;
  title?: string | null;
  city?: string | null;
  budget?: string | null;
  reviewCount?: number | null;
  responsePrice?: number | null;
  url?: string | null;
};

function newId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeName(raw: unknown): string {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);
}

function sanitizeBody(raw: unknown): string {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, BODY_MAX);
}

/** Разбор из settings.responseTemplate: JSON-массив или старая одна строка. */
export function parseReplyTemplates(raw: unknown): ReplyTemplate[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return normalizeList(raw);
  }
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) return normalizeList(parsed);
    } catch {
      /* fall through — plain text */
    }
  }
  return normalizeList([{ id: "legacy", name: "Основной", body: s }]);
}

function normalizeList(items: unknown[]): ReplyTemplate[] {
  const out: ReplyTemplate[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const body = sanitizeBody(row.body ?? row.text ?? row.template);
    if (!body) continue;
    const name = sanitizeName(row.name) || `Шаблон ${out.length + 1}`;
    const id = String(row.id || "").trim() || newId();
    out.push({ id, name, body });
    if (out.length >= MAX_REPLY_TEMPLATES) break;
  }
  return out;
}

export function serializeReplyTemplates(list: ReplyTemplate[]): string {
  return JSON.stringify(
    list.slice(0, MAX_REPLY_TEMPLATES).map((t) => ({
      id: t.id || newId(),
      name: sanitizeName(t.name) || "Шаблон",
      body: sanitizeBody(t.body),
    })),
  );
}

export function sanitizeReplyTemplatesInput(input: unknown): ReplyTemplate[] {
  if (!Array.isArray(input)) return [];
  return normalizeList(input);
}

export function fillReplyTemplate(body: string, vars: ReplyFillVars): string {
  const budget = (vars.budget || "").replace(/^не указан$/i, "");
  const map: Record<string, string> = {
    "{имя}": (vars.author || "").trim(),
    "{задача}": (vars.title || "").trim(),
    "{город}": (vars.city || "").trim(),
    "{бюджет}": budget.trim(),
    "{отзывы}": vars.reviewCount != null && vars.reviewCount > 0 ? String(vars.reviewCount) : "",
    "{цена_отклика}":
      vars.responsePrice != null && vars.responsePrice > 0 ? String(vars.responsePrice) : "",
    "{ссылка}": (vars.url || "").trim(),
    "{стаж}": "",
  };
  let text = body;
  for (const [key, val] of Object.entries(map)) {
    text = text.split(key).join(val);
  }
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function fillAllReplyTemplates(
  templates: ReplyTemplate[],
  vars: ReplyFillVars,
): Array<{ name: string; text: string }> {
  return templates
    .map((t) => ({
      name: t.name,
      text: fillReplyTemplate(t.body, vars),
    }))
    .filter((t) => t.text.length > 0);
}

/** Telegram Bot API copy_text: максимум 256 символов. */
export const TG_COPY_TEXT_MAX = 256;

export function canCopyViaTelegramButton(text: string): boolean {
  return text.length > 0 && text.length <= TG_COPY_TEXT_MAX;
}
