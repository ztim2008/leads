import type { ClickKind, IssueRule } from "@/lib/rentgen/types";

export type Group = "ok" | "dead" | "check" | "unknown";

export const GROUP_OF: Record<ClickKind, Group> = { ok: "ok", dead: "dead", fake: "check", small: "check", unknown: "unknown" };

export const GROUPS: { id: Group; label: string; about: string }[] = [
  { id: "ok", label: "Работает", about: "Нажали — что-то произошло: переход, окно, звонок, отправка" },
  { id: "dead", label: "Не работает", about: "Ссылка в пустоту, страница с ошибкой, неполный телефон или почта" },
  { id: "check", label: "Проверьте", about: "Выглядит как кнопка, но не нажимается, или слишком мелко для пальца" },
  { id: "unknown", label: "Не проверяли", about: "Элемент перекрыт или чужой сайт не дал себя проверить" },
];

/** minor — мешает экранным дикторам и SEO, но не посетителю: по умолчанию скрыто */
export const ISSUE_RULES: { id: IssueRule; label: string; minor?: boolean }[] = [
  { id: "overflow", label: "Шире экрана" },
  { id: "label", label: "Поля без подписи" },
  { id: "contrast", label: "Плохо читается" },
  { id: "small-text", label: "Мелкий текст" },
  { id: "alt", label: "Картинки без описания", minor: true },
  { id: "link-name", label: "Ссылки без текста", minor: true },
  { id: "button-name", label: "Кнопки без названия", minor: true },
];

export const MINOR_RULES = new Set<IssueRule>(ISSUE_RULES.filter((rule) => rule.minor).map((rule) => rule.id));
