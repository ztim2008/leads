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

export type IssueRule = "contrast" | "label" | "alt" | "button-name" | "link-name" | "overflow" | "small-text";

export type IssueItem = {
  n: number;
  rule: IssueRule;
  severity: "error" | "warn";
  label: string;
  reason: string;
  box: PxBox;
  /** Только для alt: заготовка описания из соседнего текста страницы */
  hint?: string;
};

export type AttentionItem = {
  label: string;
  /** Доля прогнозного внимания первого экрана, 0..1 */
  share: number;
  /** Во сколько раз внимание на элементе выше среднего по экрану для той же площади */
  lift: number;
  box: PxBox;
};

export type RentgenAttention = {
  /** Путь к PNG тепловой карты (на клиенте — адрес API) */
  map: string;
  /** Высота первого экрана в CSS px — карта покрывает 0..height */
  height: number;
  /** Доля внимания на самых «горячих» 10% площади: чем выше, тем собраннее взгляд */
  focus: number;
  items: AttentionItem[];
};

export type RentgenView = {
  shot: string;
  width: number;
  height: number;
  truncated: boolean;
  items: ClickItem[];
  /** Сколько подозрительных элементов не успели прощёлкать (ушли в unknown) */
  unprobed: number;
  /** Слой «Ошибки»; у сканов до D.18a поля нет */
  issues?: IssueItem[];
  /** Слой «Внимание» — прогноз модели на первый экран; у сканов до D.18b поля нет */
  attention?: RentgenAttention;
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
