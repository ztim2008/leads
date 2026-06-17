// AI-анализатор заявок — двухступенчатый промптинг
// Stage 1 (быстрая модель): извлечение структуры
// Stage 2 (сильная модель): оценка и рекомендация

import { callOpenRouter, type ChatMessage } from "@/lib/ai/openrouter";

// ─── Типы результата анализа ──────────────────────────────────────────────

export interface LeadAnalysisResult {
  score: number;           // 0–100
  budgetPrediction: string;
  difficulty: string;      // Низкая | Средняя | Высокая
  recommendation: string;  // Откликнуться | Подумать | Пропустить
  reasoning: string;
}

// ─── Stage 1: структурная экстракция ──────────────────────────────────────

const STAGE1_SYSTEM = `Ты — анализатор заявок на фриланс-площадках.
Извлеки из описания заявки структурированные данные.
Отвечай СТРОГО валидным JSON без markdown-обёртки.

Схема:
{
  "projectType": "тип проекта (сайт, бот, дизайн, seo, приложение, etc.)",
  "technologies": ["список технологий из заявки"],
  "complexity": "Низкая | Средняя | Высокая",
  "realBudget": "реалистичная оценка бюджета в рублях числом или null",
  "redFlags": ["список тревожных сигналов: размытое ТЗ, низкий бюджет, etc."],
  "greenFlags": ["список положительных сигналов: чёткое ТЗ, хороший бюджет, etc."]
}`;

interface Stage1Result {
  projectType: string;
  technologies: string[];
  complexity: string;
  realBudget: number | null;
  redFlags: string[];
  greenFlags: string[];
}

async function runStage1(
  title: string,
  description: string,
  fastModel: string,
  apiKey: string
): Promise<Stage1Result> {
  const prompt = `Заявка: ${title}\n\nОписание:\n${description.slice(0, 2000)}`;
  const messages: ChatMessage[] = [
    { role: "system", content: STAGE1_SYSTEM },
    { role: "user", content: prompt },
  ];

  const text = await callOpenRouter(messages, {
    model: fastModel,
    temperature: 0.2,
    maxTokens: 1000,
  }, apiKey);

  return JSON.parse(text) as Stage1Result;
}

// ─── Stage 2: оценка и стратегия ──────────────────────────────────────────

const STAGE2_SYSTEM = `Ты — эксперт по оценке фриланс-заявок для веб-разработчика/агентства.
Твоя задача — оценить заявку и дать рекомендацию.

Профиль исполнителя:
- Веб-разработка (Next.js, React, TypeScript, Tailwind)
- AI-разработка (чат-боты, автоматизация, OpenRouter, GPT)
- SEO и маркетинг
- Дизайн и брендинг
- Бюджет интересует от 30 000 ₽

Отвечай СТРОГО валидным JSON без markdown-обёртки.

Схема:
{
  "score": число 0-100,
  "budgetPrediction": "диапазон бюджета текстом, например: 80-120 тыс ₽",
  "difficulty": "Низкая | Средняя | Высокая",
  "recommendation": "Откликнуться | Подумать | Пропустить",
  "reasoning": "2-3 предложения с конкретным обоснованием оценки"
}`;

export async function analyzeLead(
  title: string,
  description: string,
  options: {
    fastModel: string;
    strongModel: string;
    apiKey: string;
  }
): Promise<LeadAnalysisResult> {
  // Stage 1: быстрая экстракция
  const stage1 = await runStage1(title, description, options.fastModel, options.apiKey);

  // Stage 2: глубокая оценка
  const stage2Prompt = `Заявка: ${title}\nОписание: ${description.slice(0, 2000)}\n\nРезультаты анализа:\n${JSON.stringify(stage1, null, 2)}`;

  const messages: ChatMessage[] = [
    { role: "system", content: STAGE2_SYSTEM },
    { role: "user", content: stage2Prompt },
  ];

  const text = await callOpenRouter(messages, {
    model: options.strongModel,
    temperature: 0.3,
    maxTokens: 1500,
  }, options.apiKey);

  return JSON.parse(text) as LeadAnalysisResult;
}
