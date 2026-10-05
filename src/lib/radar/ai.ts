import { callOpenRouter } from "@/lib/ai/openrouter";

export function radarApiKey(): string {
  return (process.env.OPENROUTER_API_KEY || "").trim();
}

function parseObject(raw: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const value = JSON.parse(match[0]);
      return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

export async function refineMatchScore(input: {
  apiKey: string;
  specialization: string;
  about: string;
  directions: string[];
  skills: string[];
  exclusions: string[];
  salaryMin: number;
  title: string;
  company: string | null;
  description: string;
}): Promise<{ score: number; why: string } | null> {
  const system = `Ты оцениваешь, насколько вакансия подходит одному соискателю.
Профиль:
Специализация: ${input.specialization}
Опыт: ${input.about}
Направления: ${input.directions.join(", ")}
Навыки: ${input.skills.join(", ")}
Не интересно: ${input.exclusions.join(", ")}
Минимум: ${input.salaryMin} ₽

Ответь СТРОГО JSON без markdown:
{"score": число 0-100, "why": "одна короткая фраза, почему подходит или нет"}

90+ только если вакансия прямо про этот профиль.
70-89 если близко, но есть лишнее.
Ниже 70 если это другая профессия, офис, продажи или разработка.
Не поднимай оценку из-за громких слов вроде AI, если задачи другие.`;

  const user = `Вакансия: ${input.title}
Компания: ${input.company || "не указана"}

${input.description.slice(0, 2500)}`;

  const raw = await callOpenRouter(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { model: "deepseek/deepseek-chat", temperature: 0.1, maxTokens: 250, timeout: 25000 },
    input.apiKey,
  );
  const parsed = parseObject(raw);
  const score = typeof parsed?.score === "number" ? Math.round(parsed.score) : null;
  const why = typeof parsed?.why === "string" ? parsed.why.trim() : "";
  if (score == null || score < 0 || score > 100 || !why) return null;
  return { score, why: why.slice(0, 280) };
}

export async function draftReply(input: {
  apiKey: string;
  specialization: string;
  about: string;
  directions: string[];
  skills: string[];
  title: string;
  company: string | null;
  description: string;
}): Promise<string> {
  const system = `Ты пишешь короткий отклик на вакансию от лица соискателя.
Профиль: ${input.specialization}.
Опыт и факты, которые можно использовать: ${input.about}
Направления: ${input.directions.join(", ")}.
Навыки: ${input.skills.join(", ")}.

5–8 предложений на русском. Конкретно под задачи этой вакансии.
Не выдумывай компании, годы опыта и цифры, которых нет в профиле.
Без списков и без канцелярита. Верни только текст письма.`;

  const raw = await callOpenRouter(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: `Вакансия: ${input.title}\nКомпания: ${input.company || "не указана"}\n\n${input.description.slice(0, 2500)}`,
      },
    ],
    { model: "deepseek/deepseek-chat", temperature: 0.4, maxTokens: 500, timeout: 30000 },
    input.apiKey,
  );
  return raw.replace(/^```[\s\S]*?\n|```$/g, "").trim().slice(0, 2500);
}
