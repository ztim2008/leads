/** Роли входа. Партнёр = user (tenant с заявками). */

export const ROLES = {
  ADMIN: "admin",
  SALES: "sales",
  PARTNER: "user",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export function isAdminRole(role: string | null | undefined): boolean {
  return role === ROLES.ADMIN;
}

export function isSalesRole(role: string | null | undefined): boolean {
  return role === ROLES.SALES;
}

export function isPartnerRole(role: string | null | undefined): boolean {
  return role === ROLES.PARTNER;
}

/** Может открывать CRM «Наши клиенты». */
export function canAccessCrm(role: string | null | undefined): boolean {
  return isAdminRole(role) || isSalesRole(role);
}

/** Куда редиректить после логина. */
export function homePathForRole(role: string | null | undefined): string {
  if (isAdminRole(role)) return "/dashboard/admin/ops";
  if (isSalesRole(role)) return "/dashboard/crm";
  return "/dashboard";
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  sales: "Напарник (продажи)",
  user: "Партнёр",
};
