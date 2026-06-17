// AI-анализатор заявок — одноступенчатый (дешёвая модель)
// Использует Gemini Flash — быстро и дёшево (~$0.0001 за анализ)

import { callOpenRouter, type ChatMessage } from "@/lib/ai/openrouter";

export interface LeadAnalysisResult {
  score: number;           // 0–100
  budgetPrediction: string;
  difficulty: string;      // Низкая | Средняя | Высокая
  recommendation: string;  // Откликнуться | Подумать | Пропустить
  reasoning: string;
}

const SYSTEM_PROMPT = `Ты — AI-ассистент веб-разработчика и дизайнера. Оцениваешь заявки с фриланс-бирж.

Профиль исполнителя:
- Веб-разработка и дизайн (Next.js, React, TypeScript, Tailwind)
- Создание сайтов, лендингов, интернет-магазинов
- Дизайн: презентации, инфографика, карточки товаров, брендинг
- SEO, AI-интеграции, чат-боты
- Интересуют заказы от 3 000 ₽

Оцени заявку и ответь СТРОГО валидным JSON без markdown:

{
  "score": число 0-100,
  "budgetPrediction": "диапазон в рублях текстом",
  "difficulty": "Низкая | Средняя | Высокая",
  "recommendation": "Откликнуться | Подумать | Пропустить",
  "reasoning": "1-2 предложения обоснования"
}

Критерии оценки:
- 85-100: идеальный заказ (твой стек, хороший бюджет, чёткое ТЗ)
- 70-84: хороший заказ (подходит по стеку или бюджету)
- 40-69: средний (можно взять если мало работы)
- 0-39: плохой (не твой стек, мизерный бюджет, мутное ТЗ)

МИНУС-баллы за: WordPress, Joomla, Tilda, студенческие работы, курсовая, диплом, "срочно", "нужен новичок".
ПЛЮС-баллы за: Next.js, React, TypeScript, дизайн, инфографика, карточки товаров, чёткий бюджет.`;

export async function analyzeLead(
  title: string,
  description: string,
  options: {
    model?: string;
    apiKey: string;
  }
): Promise<LeadAnalysisResult> {
  const text = `Заявка: ${title}\n\nОписание:\n${description.slice(0, 1500)}`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: text },
  ];

  const result = await callOpenRouter(
    messages,
    {
      model: options.model || "deepseek/deepseek-chat",
      temperature: 0.2,
      maxTokens: 600,
      timeout: 30_000,
    },
    options.apiKey
  );

  try {
    return JSON.parse(result) as LeadAnalysisResult;
  } catch {
    // Пробуем извлечь JSON из текста
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Невалидный JSON от AI");
  }
}

// ─── Генерация откликов ──────────────────────────────────────────────────

const RESPONSE_SYSTEM = `Ты — веб-разработчик и дизайнер. Пиши отклики на русском, деловым тоном, без шаблонов.
Отвечай СТРОГО валидным JSON без markdown:
{
  "short": "краткий отклик (2-3 предложения)",
  "sales": "продающий отклик (3-4 предложения, с выгодой для клиента)",
  "expert": "экспертный отклик (3-4 предложения, с техническими деталями)",
  "technical": "технический отклик (3-4 предложения, со стеком и процессом)"
}`;

export interface GeneratedResponses {
  short: string;
  sales: string;
  expert: string;
  technical: string;
}

export async function generateResponses(
  title: string,
  description: string,
  apiKey: string
): Promise<GeneratedResponses | null> {
  try {
    const messages: ChatMessage[] = [
      { role: "system", content: RESPONSE_SYSTEM },
      { role: "user", content: `Заявка: ${title}\n\nОписание: ${description.slice(0, 1000)}` },
    ];

    const result = await callOpenRouter(
      messages,
      {
        model: "deepseek/deepseek-chat",
        temperature: 0.5,
        maxTokens: 800,
        timeout: 30_000,
      },
      apiKey
    );

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as GeneratedResponses;
    }
    return null;
  } catch {
    return null;
  }
}
