/** Локальный парсинг — пароли не отправляются в LLM */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const HOST_RE = /leads-pilot-\d+/i;

export function extractEmail(text: string): string | undefined {
  return text.match(EMAIL_RE)?.[0]?.toLowerCase();
}

export function extractIp(text: string): string | undefined {
  return text.match(IP_RE)?.[0];
}

export function extractHostname(text: string): string | undefined {
  return text.match(HOST_RE)?.[0];
}

export function extractLimit(text: string): number | undefined {
  const m = text.match(/(?:лимит|limit)\s*[:=]?\s*(\d+)/i) || text.match(/(\d+)\s*(?:заявок|лид)/i);
  if (m) return parseInt(m[1], 10);
  return undefined;
}

export function looksLikeSecrets(text: string): boolean {
  return /пароль|password/i.test(text) || /root\s*[:@]/i.test(text);
}

export function parseVpsBlock(text: string) {
  const ip = extractIp(text);
  const hostname = extractHostname(text);
  const email = extractEmail(text);
  return { ip, hostname, email };
}

export function sanitizeForLlm(text: string): string {
  if (!looksLikeSecrets(text)) return text;
  return text
    .replace(/пароль\s*[:：]?\s*[^\s\n]+/gi, "пароль: [скрыто]")
    .replace(/password\s*[:：]?\s*[^\s\n]+/gi, "password: [hidden]");
}
