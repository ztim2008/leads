export function toRub(amount: number, currency: string | null | undefined): number {
  const c = (currency || "RUR").toUpperCase();
  if (c === "RUR" || c === "RUB") return amount;
  if (c === "USD") return Math.round(amount * 90);
  if (c === "EUR") return Math.round(amount * 100);
  if (c === "KZT") return Math.round(amount * 0.2);
  return amount;
}

/** null — зарплата не указана. true — вся вилка ниже порога. */
export function salaryBelowFloor(
  from: number | null,
  to: number | null,
  currency: string | null | undefined,
  floor: number,
): boolean | null {
  if (from == null && to == null) return null;
  const high = Math.max(from ?? to ?? 0, to ?? from ?? 0);
  return toRub(high, currency) < floor;
}

export function formatSalary(
  from: number | null,
  to: number | null,
  currency: string | null | undefined,
  gross: boolean | null | undefined,
): string {
  if (from == null && to == null) return "зарплата не указана";
  const cur = !currency || currency === "RUR" || currency === "RUB" ? "₽" : currency;
  const fmt = (n: number) => {
    if (cur === "₽" && n >= 1000) {
      const k = Math.round(n / 1000);
      return `${k} тыс.`;
    }
    return n.toLocaleString("ru-RU");
  };
  let body = "";
  if (from != null && to != null && from !== to) body = `${fmt(from)}–${fmt(to)} ${cur}`;
  else body = `${fmt((from ?? to) as number)} ${cur}`;
  return gross ? `${body} до вычета` : body;
}
