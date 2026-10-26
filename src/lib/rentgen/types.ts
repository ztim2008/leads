export type ClickKind = "ok" | "dead" | "fake" | "small" | "unknown";
export type ContactKind = "tel" | "mail" | "messenger";
export type ViewKind = "desktop" | "mobile";

/** Прямоугольник в CSS-пикселях документа (от левого верхнего угла страницы) */
export type PxBox = { x: number; y: number; w: number; h: number };

export type ClickItem = {
  /** Номер метки на снимке — только у проблем (dead / fake / small) */
  n: number | null;
  kind: ClickKind;
  contact?: ContactKind;
  label: string;
  href?: string;
  /** HTTP-статус ссылки — заполняет проверка ссылок (D.14) */
  status?: number | null;
  reason: string;
  box: PxBox;
  /** Короткий CSS-путь — для отладки и повторного поиска элемента */
  path: string;
};

export type RentgenView = {
  shot: string;
  width: number;
  height: number;
  truncated: boolean;
  items: ClickItem[];
  /** Сколько подозрительных элементов не успели прощёлкать (ушли в unknown) */
  unprobed: number;
};

export type RentgenResult = {
  finalUrl: string;
  framework: "react" | "vue" | "angular" | null;
  views: { desktop: RentgenView; mobile: RentgenView | null };
  linksChecked: number;
  ms: number;
};

/** Сырые данные элемента из страницы — до классификации */
export type RawClick = {
  path: string;
  /** тег|класс|подпись — одинаковые элементы прощёлкиваем один раз */
  sig: string;
  tag: string;
  role: string | null;
  label: string;
  hrefRaw: string | null;
  hrefAbs: string | null;
  box: PxBox;
  inForm: boolean;
  formAttr: boolean;
  submit: boolean;
  interactive: boolean;
  buttonish: boolean;
  pointer: boolean;
  inlineText: boolean;
  onclick: boolean;
  submenu: boolean;
  /** Уже выбранная вкладка / фильтр — повторное нажатие ничего не меняет */
  active: boolean;
  anchorExists: boolean | null;
};

export type RawView = {
  items: RawClick[];
  docHeight: number;
  framework: RentgenResult["framework"];
};
