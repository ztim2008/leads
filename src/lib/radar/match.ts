import { salaryBelowFloor } from "./money";
import { termHit } from "./text";

export type MatchInput = {
  title: string;
  description: string;
  remote: boolean;
  employment: string | null;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryCurrency: string | null;
  directions: string[];
  skills: string[];
  salaryMin: number;
};

export function scoreMatch(input: MatchInput): { score: number; reasons: string[] } {
  const hay = `${input.title}\n${input.description}`;
  const reasons: string[] = [];
  for (const term of [...input.directions, ...input.skills]) {
    if (termHit(hay, term)) reasons.push(term);
  }
  let score = 35 + Math.min(reasons.length, 4) * 12;
  if (input.remote) {
    score += 8;
    reasons.push("удалёнка");
  }
  const below = salaryBelowFloor(input.salaryFrom, input.salaryTo, input.salaryCurrency, input.salaryMin);
  if (below === false) {
    score += 8;
    reasons.push("зарплата от порога");
  }
  if (input.employment && /полн|full/i.test(input.employment)) {
    score += 5;
    reasons.push("постоянная работа");
  }
  return { score: Math.min(100, score), reasons };
}
