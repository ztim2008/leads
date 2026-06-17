// OpenRouter клиент — вызов AI-моделей
// Переиспользует паттерн из konversus.ru/src/lib/ai/openrouter.ts

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export async function callOpenRouter(
  messages: ChatMessage[],
  options: CallOptions,
  apiKey: string
): Promise<string> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://leads.konversus.ru",
      "X-Title": "Konversus Leads AI",
    },
    body: JSON.stringify({
      model: options.model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2000,
    }),
    signal: AbortSignal.timeout(options.timeout ?? 60_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter вернул пустой ответ");
  }

  return content;
}
