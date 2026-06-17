// AI-анализатор заявок — одноступенчатый (DeepSeek)
// Добавлено: определение «человек или робот» написал ТЗ

import { callOpenRouter, type ChatMessage } from "@/lib/ai/openrouter";

export interface LeadAnalysisResult {
  score: number;
  budgetPrediction: string;
  difficulty: string;
  recommendation: string;
  reasoning: string;
  botProbability: number;     // 0-100: вероятность что ТЗ написано роботом (0 = точно человек)
}

const SYSTEM_PROMPT = `Ты — AI-ассистент веб-разработчика и дизайнера. Оцениваешь заявки с фриланс-бирж.

Профиль исполнителя:
- Веб-разработка и дизайн (Next.js, React, TypeScript, Tailwind)
- Создание сайтов, лендингов, интернет-магазинов
- Дизайн: презентации, инфографика, карточки товаров, брендинг, полиграфия
- SEO, AI-интеграции, чат-боты
- Интересуют заказы от 3 000 ₽

Оцени заявку и ответь СТРОГО валидным JSON без markdown:

{
  "score": число 0-100,
  "budgetPrediction": "диапазон в рублях текстом",
  "difficulty": "Низкая | Средняя | Высокая",
  "recommendation": "Откликнуться | Подумать | Пропустить",
  "reasoning": "1-2 предложения обоснования",
  "botProbability": число 0-100
}

Поле botProbability — твоя оценка вероятности что заявку написал робот/шаблон/автоматическая система, а не живой человек:
- 0-20: точно живой человек (персональные детали, эмоции, уникальные формулировки)
- 20-50: скорее человек (есть индивидуальность но структурированно)
- 50-70: подозрительно (слишком идеально структурировано, шаблонные фразы)
- 70-100: точно робот/шаблон (безличный текст, автоматическая генерация, повторяющиеся паттерны)

Признаки робота: идеальная структура, отсутствие эмоций, шаблонные фразы типа "Требуется специалист для выполнения задачи", перечисление через запятую без контекста.
Признаки человека: разговорный стиль, эмоции, конкретные детали проекта, ошибки или неидеальная пунктуация.

Критерии оценки:
- 85-100: идеальный заказ (твой стек, хороший бюджет, чёткое ТЗ)
- 70-84: хороший заказ (подходит по стеку или бюджету)
- 40-69: средний (можно взять если мало работы)
- 0-39: плохой (не твой стек, мизерный бюджет, мутное ТЗ)

МИНУС-баллы за: WordPress, Joomla, Tilda, студенческие работы, курсовая, диплом, "срочно", "нужен новичок".
ПЛЮС-баллы за: Next.js, React, TypeScript, дизайн, инфографика, карточки товаров, чёткий бюджет, авито, озон, валбериз.`;

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
      maxTokens: 700,
      timeout: 30_000,
    },
    options.apiKey
  );

  try {
    const parsed = JSON.parse(result);
    return {
      ...parsed,
      botProbability: typeof parsed.botProbability === "number" ? parsed.botProbability : 50,
    };
  } catch {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...parsed,
        botProbability: typeof parsed.botProbability === "number" ? parsed.botProbability : 50,
      };
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
