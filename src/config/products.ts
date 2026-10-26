import { Gauge, Globe, LayoutTemplate, MessageCircle, MonitorSmartphone, Search, ShieldCheck, ShoppingBag, TrendingUp, Zap, type LucideIcon } from "lucide-react";

export type ProductStatus = "live" | "new" | "soon";

export type Product = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  benefits: string[];
  href: string | null;
  external: boolean;
  /** Статика из public/ (не маршрут Next) — ссылка обычным <a>, без клиентской навигации */
  staticPage?: boolean;
  status: ProductStatus;
  icon: LucideIcon;
  audience: string;
};

export const STATUS_LABELS: Record<ProductStatus, string> = {
  live: "Работает",
  new: "Новое",
  soon: "Скоро",
};

export const CONTACT_TELEGRAM = "https://t.me/bilarius";
export const ABOUT_URL = "https://konversus.ru/about";

export const PRODUCTS: Product[] = [
  {
    id: "diagnost",
    name: "Техосмотр сайта",
    tagline: "Проверка готовности сайта к рекламе",
    description: "Открывает сайт в браузере, проверяет оффер, кнопки, мобильную версию, скорость, доверие и аналитику. Показывает балл и причины каждой оценки.",
    benefits: ["Балл 0–100 и готовность к рекламе в процентах", "План исправлений по влиянию на заявки", "PDF для клиента и для директолога"],
    href: "/diagnost",
    external: false,
    status: "new",
    icon: Gauge,
    audience: "Директологам и агентствам",
  },
  {
    id: "seo-promo",
    name: "SEO-продвижение",
    tagline: "Как попасть в Яндекс и сколько это стоит",
    description: "Объясняем простыми словами, как Яндекс выбирает сайты и сколько ждать результата. Калькулятор стоимости работ и бесплатный разбор вашего бизнеса.",
    benefits: ["SEO без технических слов", "Калькулятор стоимости работ", "Только белые методы"],
    href: "/seo",
    external: false,
    status: "new",
    icon: TrendingUp,
    audience: "Владельцам бизнеса",
  },
  {
    id: "pokaz",
    name: "Показ",
    tagline: "Сайт на ноутбуке, планшете и телефоне",
    description: "Вставьте адрес — сайт откроется сразу на трёх экранах. Расставьте устройства, выберите фон и скачайте PNG для презентации клиенту.",
    benefits: ["Три экрана одновременно", "PNG-композиция для клиента", "Без регистрации и установки"],
    href: "/pokaz",
    external: false,
    staticPage: true,
    status: "new",
    icon: MonitorSmartphone,
    audience: "Директологам и агентствам",
  },
  {
    id: "lovec",
    name: "Ловец лидов",
    tagline: "Заявки с Profi в Telegram за секунды",
    description: "Следит за новыми заказами на Profi, оценивает заказчика и бюджет и сразу присылает карточку в Telegram.",
    benefits: ["Уведомление через секунды после публикации", "AI-оценка реальности заказчика", "История заявок и фильтры"],
    href: "/lovec",
    external: false,
    status: "live",
    icon: Zap,
    audience: "Специалистам на Profi",
  },
  {
    id: "chat",
    name: "Telegram-консультант",
    tagline: "Чат на сайте, ответы из Telegram",
    description: "Посетитель пишет в окно на сайте, сообщение приходит вам в Telegram. AI отвечает сам, а когда нужен живой ответ — вы пишете из Telegram.",
    benefits: ["Виджет ставится за 5 минут", "Режимы: AI, человек, помощник", "Без CRM и админок"],
    href: "https://chat.konversus.ru",
    external: true,
    status: "live",
    icon: MessageCircle,
    audience: "Владельцам бизнеса",
  },
  {
    id: "nordic",
    name: "Nordic Builder",
    tagline: "Живой прототип сайта за 1–3 дня",
    description: "По вашим материалам собирается прототип сайта со ссылкой для показа. После согласования — полный сайт со своим доменом, формами и Метрикой.",
    benefits: ["Прототип за 48–72 часа", "Ссылка для показа клиенту", "Дальше — полный проект по смете"],
    href: "https://nordic-builder.ru",
    external: true,
    status: "live",
    icon: LayoutTemplate,
    audience: "Владельцам бизнеса",
  },
  {
    id: "architect",
    name: "Архитектор сайта",
    tagline: "AI-аудит SEO, скорости и безопасности",
    description: "Вставьте ссылку — AI просканирует сайт, сделает скриншот, определит CMS, найдёт SEO-ошибки, проверит скорость и безопасность.",
    benefits: ["Сайты, Ozon, Wildberries, Авито", "SEO-ошибки и CMS", "Скорость и безопасность"],
    href: "https://konversus.ru/architect",
    external: true,
    status: "live",
    icon: Search,
    audience: "Владельцам бизнеса",
  },
  {
    id: "secret-shopper",
    name: "Тайный покупатель",
    tagline: "Поиск клиентов и готовые КП",
    description: "Находит потенциальных клиентов, проверяет их сайты и готовит коммерческие предложения.",
    benefits: ["Авто-аудит сайтов клиентов", "Генерация КП", "Email-рассылки"],
    href: "https://konversus.ru/dashboard/secret-shopper",
    external: true,
    status: "live",
    icon: ShoppingBag,
    audience: "Директологам и агентствам",
  },
  {
    id: "ssl",
    name: "SSL Doctor",
    tagline: "Мониторинг SSL и безопасности",
    description: "Следит за сертификатами и безопасностью сайта и восстанавливает их до того, как сайт упадёт.",
    benefits: ["Проверка сертификатов 24/7", "Авто-продление", "Уведомления о проблемах"],
    href: null,
    external: true,
    status: "soon",
    icon: ShieldCheck,
    audience: "Владельцам бизнеса",
  },
  {
    id: "seo",
    name: "SEO AI",
    tagline: "Позиции в Яндексе и ключевые слова",
    description: "Анализ позиций в Яндексе, подбор ключевых слов и аудит сайта для российского рынка.",
    benefits: ["Позиции в Яндексе", "Подбор ключевых слов", "Аудит страниц"],
    href: null,
    external: true,
    status: "soon",
    icon: Globe,
    audience: "Владельцам бизнеса",
  },
];
