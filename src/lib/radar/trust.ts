export type TrustCheck = { id: string; ok: boolean; label: string };

export type TrustInput = {
  company: string | null;
  employerTrusted: boolean | null;
  employerVacancyCount: number | null;
  publishedAt: Date | null;
  salaryFrom: number | null;
  salaryTo: number | null;
  description: string;
  now?: Date;
};

const PAY_RE =
  /оплатите|вступительн\w* взнос|предоплат|перевод на карту|криптокошел|залог за|купить место|оплата регистрации|внесите оплату/i;
const SHORT_LINK_RE = /bit\.ly|clck\.ru|tinyurl|goo\.gl|t\.co\//i;

export function buildTrustChecks(input: TrustInput): TrustCheck[] {
  const now = input.now ?? new Date();
  const ageH = input.publishedAt ? (now.getTime() - input.publishedAt.getTime()) / 3600000 : null;
  const high = Math.max(input.salaryFrom ?? 0, input.salaryTo ?? 0);
  const low = input.salaryFrom ?? input.salaryTo;
  const salaryOk =
    low != null && high >= 30000 && high <= 400000 && (input.salaryFrom == null || input.salaryFrom >= 20000);
  const text = input.description || "";

  const checks: TrustCheck[] = [
    {
      id: "trusted",
      ok: input.employerTrusted === true,
      label: input.employerTrusted ? "работодатель подтверждён" : "работодатель не подтверждён",
    },
    {
      id: "company",
      ok: (input.company || "").trim().length > 1,
      label: (input.company || "").trim().length > 1 ? "компания указана" : "компания не указана",
    },
    {
      id: "recent",
      ok: ageH != null && ageH >= -1 && ageH <= 72,
      label: ageH != null && ageH <= 72 ? "вакансия размещена недавно" : "вакансия не свежая",
    },
  ];
  if (input.employerVacancyCount != null) {
    checks.push({
      id: "history",
      ok: input.employerVacancyCount >= 2,
      label: input.employerVacancyCount >= 2 ? "есть история вакансий" : "мало истории вакансий",
    });
  }
  if (input.salaryFrom != null || input.salaryTo != null) {
    checks.push({
      id: "salary",
      ok: salaryOk,
      label: salaryOk ? "зарплата выглядит правдоподобно" : "зарплата не указана или странная",
    });
  }
  checks.push(
    {
      id: "description",
      ok: text.trim().length >= 400,
      label: text.trim().length >= 400 ? "есть конкретное описание работы" : "описание слишком короткое",
    },
    {
      id: "payment",
      ok: !PAY_RE.test(text),
      label: PAY_RE.test(text) ? "есть просьба заплатить" : "нет просьбы заплатить",
    },
    {
      id: "links",
      ok: !SHORT_LINK_RE.test(text),
      label: SHORT_LINK_RE.test(text) ? "есть подозрительная ссылка" : "нет подозрительных ссылок",
    },
  );
  return checks;
}

export function trustScore(checks: TrustCheck[]): number {
  if (!checks.length) return 0;
  const ok = checks.filter((c) => c.ok).length;
  return Math.round((ok / checks.length) * 100);
}
