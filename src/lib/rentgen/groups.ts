import type { ClickKind } from "@/lib/rentgen/types";

export type Group = "ok" | "dead" | "check" | "unknown";

export const GROUP_OF: Record<ClickKind, Group> = { ok: "ok", dead: "dead", fake: "check", small: "check", unknown: "unknown" };

export const GROUPS: { id: Group; label: string; about: string }[] = [
  { id: "ok", label: "Работает", about: "Нажали — что-то произошло: переход, окно, звонок, отправка" },
  { id: "dead", label: "Не работает", about: "Ссылка в пустоту, страница с ошибкой, неполный телефон или почта" },
  { id: "check", label: "Проверьте", about: "Выглядит как кнопка, но не нажимается, или слишком мелко для пальца" },
  { id: "unknown", label: "Не проверяли", about: "Элемент перекрыт или чужой сайт не дал себя проверить" },
];
