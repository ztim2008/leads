/** Данные для подключения партнёра (оператор / агент) */

export interface PartnerInput {
  email: string;
  password: string;
  name?: string;
  profiLogin: string;
  profiPassword: string;
  leadsPerMonth: number;
  keywords?: string;
  minusKeywords?: string;
  budgetMin?: number;
  budgetMax?: number;
  telegramChatId?: string;
  telegramToken?: string;
  vpsIp?: string;
  vpsName?: string;
}

export interface ValidationIssue {
  field: string;
  level: "error" | "warn";
  message: string;
}

export interface ParseResult {
  data: Partial<PartnerInput>;
  issues: ValidationIssue[];
}
