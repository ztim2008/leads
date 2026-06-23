// AI-анализатор заявок — v2: учитывает deep scan данные (отзывы, возраст, бюджет)

import { callOpenRouter, type ChatMessage } from "@/lib/ai/openrouter";

export interface LeadAnalysisResult {
  score: number;
  budgetPrediction: string;
  difficulty: string;
  recommendation: string;
  reasoning: string;
  botProbability: number;
}

export interface LeadSignals {
  reviewCount?: number;
  yearsOnPlatform?: number;
  clientRating?: number;
  budgetMin?: number;
  descriptionLength?: number;
}

const SYSTEM_PROMPT = `Ты — AI-ассистент веб-разработчика и дизайнера. Оцениваешь заявки с фриланс-бирж.

Профиль исполнителя:
- Веб-разработка и дизайн (Next.js, React, TypeScript, Tailwind)
- Создание сайтов, лендингов, интернет-магазинов
- Дизайн: презентации, инфографика, карточки товаров, брендинг, полиграфия
- SEO, AI-интеграции, чат-боты
- Интересуют заказы от 3 000 ₽

Ты получишь заявку И ДОПОЛНИТЕЛЬНЫЕ СИГНАЛЫ о заказчике (отзывы, возраст аккаунта, рейтинг, подробность ТЗ, бюджет).
ИСПОЛЬЗУЙ эти сигналы для более точной оценки.

Оцени заявку и ответь СТРОГО валидным JSON без markdown:

{
  "score": число 0-100,
  "budgetPrediction": "диапазон в рублях текстом",
  "difficulty": "Низкая | Средняя | Высокая",
  "recommendation": "Откликнуться | Подумать | Пропустить",
  "reasoning": "1-2 предложения обоснования",
  "botProbability": число 0-100
}

Поле botProbability — оценка вероятности что заявку написал робот/шаблон, а не живой человек:
- 0-20: точно живой человек (персональные детали, эмоции)
- 20-50: скорее человек
- 50-70: подозрительно (шаблонные фразы)
- 70-100: точно робот/шаблон

Признаки робота: идеальная структура, отсутствие эмоций, шаблонные фразы.
Признаки человека: разговорный стиль, эмоции, конкретные детали, ошибки.

ВАЖНО — используй сигналы заказчика для корректировки скора:
- Если у заказчика 5+ отзывов и 2+ года на платформе → +10-20 баллов к score
- Если заказчик новичок (0 отзывов, < 6 мес) → -10-15 баллов к score
- Если ТЗ подробное (>1000 символов) и бюджет указан → +5-10 баллов
- Если ТЗ короткое и бюджет не указан → -5-10 баллов
- Высокий рейтинг клиента (★★★) → понижай botProbability (скорее живой человек)
- Низкий рейтинг (★☆☆ или без рейтинга) + шаблонный текст → повышай botProbability

Критерии оценки:
- 85-100: идеальный заказ (твой стек, хороший бюджет, проверенный заказчик)
- 70-84: хороший заказ (подходит по стеку или бюджету, заказчик с историей)
- 40-69: средний (можно взять если мало работы)
- 0-39: плохой (не твой стек, мизерный бюджет, мутное ТЗ, новичок без отзывов)

МИНУС-баллы: WordPress, Joomla, Tilda, студент, курсовая, диплом, срочно, новичок.
ПЛЮС-баллы: Next.js, React, TypeScript, дизайн, инфографика, карточки товаров, чёткий бюджет, Авито, Озон, Валбериз.`;

export async function analyzeLead(
  title: string,
  description: string,
  options: {
    model?: string;
    apiKey: string;
    signals?: LeadSignals;
  }
): Promise<LeadAnalysisResult> {
  // Собираем текст с заявкой и сигналами
  let text = `Заявка: ${title}\n\nОписание:\n${description.slice(0, 1500)}`;

  if (options.signals) {
    const s = options.signals;
    const signalLines: string[] = ["\n--- СИГНАЛЫ ЗАКАЗЧИКА ---"];
    if (s.reviewCount !== undefined) signalLines.push(`Отзывы: ${s.reviewCount}`);
    if (s.yearsOnPlatform !== undefined) signalLines.push(`Лет на платформе: ${s.yearsOnPlatform}`);
    if (s.clientRating !== undefined && s.clientRating > 0)
      signalLines.push(`Рейтинг клиента: ${s.clientRating}/3`);
    if (s.budgetMin !== undefined && s.budgetMin > 0)
      signalLines.push(`Указанный бюджет: ${s.budgetMin} ₽`);
    if (s.descriptionLength !== undefined)
      signalLines.push(`Подробность ТЗ: ${s.descriptionLength} символов`);
    text += "\n" + signalLines.join("\n");
  }

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
