import { sanitizeForLlm } from "./parse-local";
import type { IntentMatch } from "./types";

const ALLOWED = [
  "list_partners",
  "partner_status",
  "renew_month",
  "toggle_collection",
  "test_telegram",
  "get_install_command",
  "save_vps_ip",
  "create_partner",
  "help",
  "unknown",
] as const;

export function isLlmConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export async function llmIntent(message: string): Promise<IntentMatch | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const safe = sanitizeForLlm(message);

  const system = `Ты классификатор команд оператора Leads AI. Ответь только JSON:
{"type":"...","email":null,"vpsIp":null,"leadsPerMonth":null,"enabled":null}
type один из: ${ALLOWED.join(", ")}
Не извлекай пароли. email только если явно в тексте.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: safe },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      type?: string;
      email?: string;
      vpsIp?: string;
      leadsPerMonth?: number;
      enabled?: boolean;
    };

    const type = ALLOWED.includes(parsed.type as typeof ALLOWED[number])
      ? (parsed.type as IntentMatch["type"])
      : "unknown";

    const params: Record<string, string | number | boolean> = {};
    if (parsed.email) params.email = parsed.email.toLowerCase();
    if (parsed.vpsIp) params.vpsIp = parsed.vpsIp;
    if (parsed.leadsPerMonth) params.leadsPerMonth = parsed.leadsPerMonth;
    if (parsed.enabled !== undefined && parsed.enabled !== null) params.enabled = parsed.enabled;

    return { type, params, confidence: 0.75 };
  } catch {
    return null;
  }
}
