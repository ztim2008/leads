/**
 * Контракт анализа Ideas Board (типы + лейблы) — безопасно для client components.
 */

export type IdeaVerdict = "explore" | "park" | "build_mvp" | "skip";
export type RiskSeverity = "low" | "med" | "high";
export type NextStepOwner = "founder" | "partner" | "both";

export interface IdeaEffort {
  score: number;
  label: "S" | "M" | "L" | "XL";
  weeksHint: string;
}

export interface WeightedPoint {
  id: string;
  text: string;
  weight: number;
}

export interface IdeaRisk {
  id: string;
  text: string;
  severity: RiskSeverity;
  mitigation: string;
}

export interface IdeaAnalog {
  id: string;
  name: string;
  url: string | null;
  note: string;
}

export interface IdeaNextStep {
  id: string;
  text: string;
  owner: NextStepOwner;
}

export interface IdeaGraphNode {
  id: string;
  type: "idea" | "pro" | "con" | "risk" | "analog" | "next";
  label: string;
}

export interface IdeaGraphEdge {
  from: string;
  to: string;
  kind: string;
}

export interface IdeaAnalysis {
  summary: string;
  verdict: IdeaVerdict;
  effort: IdeaEffort;
  pros: WeightedPoint[];
  cons: WeightedPoint[];
  risks: IdeaRisk[];
  analogs: IdeaAnalog[];
  fitWithKonversus: string;
  nextSteps: IdeaNextStep[];
  graph?: { nodes: IdeaGraphNode[]; edges: IdeaGraphEdge[] };
  source?: "llm" | "fallback";
  error?: string;
}

export const VERDICT_LABELS: Record<IdeaVerdict, string> = {
  explore: "Исследовать",
  park: "Отложить",
  build_mvp: "Собрать MVP",
  skip: "Пропустить",
};

export const EFFORT_LABELS: Record<IdeaEffort["label"], string> = {
  S: "S · малый",
  M: "M · средний",
  L: "L · крупный",
  XL: "XL · очень крупный",
};

export const VERDICTS = new Set<IdeaVerdict>(["explore", "park", "build_mvp", "skip"]);
export const SEVERITIES = new Set<RiskSeverity>(["low", "med", "high"]);
export const OWNERS = new Set<NextStepOwner>(["founder", "partner", "both"]);
export const EFFORT_LABELS_SET = new Set(["S", "M", "L", "XL"]);
