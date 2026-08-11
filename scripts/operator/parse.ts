import type { PartnerInput, ParseResult, ValidationIssue } from "./types";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

function lineValue(text: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const re = new RegExp(`^\\s*${key}\\s*[:：]\\s*(.+)$`, "im");
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return undefined;
}

/** Парсинг вставленного блока (агент или админ) */
export function parsePartnerPaste(text: string): ParseResult {
  const data: Partial<PartnerInput> = {};
  const issues: ValidationIssue[] = [];

  data.email = lineValue(text, ["email", "почта", "e-mail"]) || text.match(EMAIL_RE)?.[0]?.toLowerCase();
  data.password =
    lineValue(text, ["password", "пароль входа", "пароль для входа", "пароль партнёра", "пароль"]) ||
    undefined;
  data.name = lineValue(text, ["name", "имя", "название"]);
  data.profiLogin = lineValue(text, ["profi", "profi login", "profi логин", "логин profi", "логин"]) || undefined;
  data.profiPassword =
    lineValue(text, ["profi password", "profi пароль", "пароль profi"]) || undefined;

  const limitStr = lineValue(text, ["лимит", "limit", "заявок"]);
  if (limitStr) data.leadsPerMonth = parseInt(limitStr.replace(/\D/g, ""), 10);

  data.telegramChatId = lineValue(text, ["chat id", "chatid", "telegram chat"]);
  data.telegramToken = lineValue(text, ["bot token", "token", "telegram token"]);

  data.vpsIp = lineValue(text, ["ip", "vps ip"]) || text.match(IP_RE)?.[0];
  data.vpsName = text.match(/leads-pilot-\d+/i)?.[0];

  data.keywords = lineValue(text, ["keywords", "ключевые слова", "ключи"]);
  data.minusKeywords = lineValue(text, ["minus", "минус-слова", "минус"]);

  const budgetMin = lineValue(text, ["бюджет от", "budget min"]);
  const budgetMax = lineValue(text, ["бюджет до", "budget max"]);
  if (budgetMin) data.budgetMin = parseInt(budgetMin.replace(/\D/g, ""), 10);
  if (budgetMax) data.budgetMax = parseInt(budgetMax.replace(/\D/g, ""), 10);

  // Если profiLogin совпал с "логин: root" на VPS — отделить
  if (data.profiLogin?.toLowerCase() === "root" && data.email) {
    issues.push({
      field: "profiLogin",
      level: "warn",
      message: "«логин: root» — вероятно SSH, не Profi. Укажите profi логин явно.",
    });
  }

  if (/пароль\s*[:：]/i.test(text) && !data.profiPassword && data.password) {
    // один пароль в тексте — не дублировать в profi без явного profi password
  }

  return { data, issues };
}

export function validatePartnerInput(data: Partial<PartnerInput>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!data.email) {
    issues.push({ field: "email", level: "error", message: "Email обязателен" });
  } else if (!EMAIL_RE.test(data.email)) {
    issues.push({ field: "email", level: "error", message: "Некорректный email" });
  }

  if (!data.password || data.password.length < 6) {
    issues.push({ field: "password", level: "error", message: "Пароль входа ≥ 6 символов" });
  }

  if (!data.profiLogin) {
    issues.push({ field: "profiLogin", level: "error", message: "Profi логин обязателен" });
  }

  if (!data.profiPassword) {
    issues.push({ field: "profiPassword", level: "error", message: "Profi пароль обязателен" });
  }

  const limit = data.leadsPerMonth ?? 500;
  if (limit < 1 || limit > 100000) {
    issues.push({ field: "leadsPerMonth", level: "error", message: "Лимит 1–100000" });
  }

  if (data.telegramChatId && !data.telegramToken) {
    issues.push({ field: "telegramToken", level: "warn", message: "Chat ID без Bot Token" });
  }

  if (data.telegramToken && !data.telegramChatId) {
    issues.push({ field: "telegramChatId", level: "warn", message: "Bot Token без Chat ID" });
  }

  if (data.vpsIp && !IP_RE.test(data.vpsIp)) {
    issues.push({ field: "vpsIp", level: "error", message: "Некорректный IP" });
  }

  return issues;
}

export function mergeCliArgs(data: Partial<PartnerInput>, args: Record<string, string>): PartnerInput {
  const merged: PartnerInput = {
    email: args.email || data.email || "",
    password: args.password || data.password || "",
    name: args.name || data.name,
    profiLogin: args.profiLogin || data.profiLogin || "",
    profiPassword: args.profiPassword || data.profiPassword || "",
    leadsPerMonth: parseInt(args.leadsPerMonth || String(data.leadsPerMonth || 500), 10),
    keywords: args.keywords || data.keywords,
    minusKeywords: args.minusKeywords || data.minusKeywords,
    budgetMin: data.budgetMin ?? 3000,
    budgetMax: data.budgetMax ?? 500000,
    telegramChatId: args.telegramChatId || data.telegramChatId,
    telegramToken: args.telegramToken || data.telegramToken,
    vpsIp: args.vpsIp || data.vpsIp,
    vpsName: data.vpsName,
  };
  return merged;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}

export function printIssues(issues: ValidationIssue[]): void {
  for (const i of issues) {
    const mark = i.level === "error" ? "❌" : "⚠️";
    console.log(`${mark} ${i.field}: ${i.message}`);
  }
}
