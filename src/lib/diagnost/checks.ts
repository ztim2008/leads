import type { AiVision, BusinessType, CategoryId, Check, CheckStatus, Level, Severity, Signals } from "@/lib/diagnost/types";

type Spec = {
  id: string;
  category: CategoryId;
  title: string;
  weight: number;
  why: string;
  fix: string;
  severity: Severity;
  impact: Level;
  effort: Level;
};

function check(spec: Spec, status: CheckStatus, evidence: string, url: string | null, source: Check["source"] = "check", confidence = 1): Check {
  return { ...spec, status, evidence, url, source, confidence };
}

const UNKNOWN = "Не удалось проверить автоматически";

function list(items: string[], max = 4): string {
  const shown = items.slice(0, max).map((item) => `«${item}»`).join(", ");
  return items.length > max ? `${shown} и ещё ${items.length - max}` : shown;
}

function scoreStatus(value: number, good: number, ok: number): CheckStatus {
  return value >= good ? "pass" : value >= ok ? "warn" : "fail";
}

function lowerIsBetter(value: number, good: number, ok: number): CheckStatus {
  return value <= good ? "pass" : value <= ok ? "warn" : "fail";
}

function ms(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace(".", ",")} с` : `${value} мс`;
}

function kb(value: number): string {
  return value >= 1024 ? `${(value / 1024).toFixed(1).replace(".", ",")} МБ` : `${value} КБ`;
}

const CTA_EXAMPLES: Record<BusinessType, string> = {
  ecommerce: "«Перейти в каталог», «Купить», «Смотреть товары со скидкой»",
  services: "«Рассчитать стоимость», «Получить консультацию», «Оставить заявку»",
  b2b: "«Запросить КП», «Получить прайс», «Обсудить проект»",
  saas: "«Попробовать бесплатно», «Посмотреть демо», «Начать»",
  local: "«Записаться», «Позвонить», «Построить маршрут»",
  info: "«Записаться на курс», «Получить бесплатный урок», «Начать обучение»",
  other: "«Оставить заявку», «Получить консультацию», «Купить»",
};

export function detectBusiness(signals: Signals): BusinessType {
  const text = `${signals.home.title} ${signals.home.h1s.join(" ")} ${signals.home.text}`.toLowerCase();
  if (signals.home.cart) return "ecommerce";
  if (/тариф|подписк|попробовать бесплатно|триал|личный кабинет.*сервис|api\b/.test(text)) return "saas";
  if (/онлайн-курс|вебинар|марафон|наставничеств|обучени[ея] онлайн|школа .*онлайн/.test(text)) return "info";
  if (/оптом|для бизнеса|юридическ[а-я]+ лиц|b2b|дилер|производств|поставк|тендер/.test(text)) return "b2b";
  if (signals.home.trust.address && /запис|салон|клиник|стоматолог|автосервис|кафе|ресторан|фитнес|барбер/.test(text)) return "local";
  return "services";
}

export function runChecks(signals: Signals, business: BusinessType, ai: AiVision | null): Check[] {
  const { home, render, files } = signals;
  const url = signals.finalUrl;
  const desktop = render.desktop;
  const mobile = render.mobile;
  const perf = render.perf;
  const out: Check[] = [];
  const contactPaths = (home.forms.count > 0 ? 1 : 0) + (home.phones.length ? 1 : 0) + (home.messengers.length ? 1 : 0);

  // ── Конверсия ────────────────────────────────────────────────
  const ctaFold: Spec = {
    id: "conv.cta_fold",
    category: "conversion",
    title: "Призыв к действию на первом экране",
    weight: 3,
    why: "Посетитель из рекламы решает за 3–5 секунд. Если на первом экране не видно, что сделать дальше, он закрывает вкладку.",
    fix: `Поставить на первый экран одну заметную кнопку с конкретным действием: ${CTA_EXAMPLES[business]}.`,
    severity: "critical",
    impact: "high",
    effort: "low",
  };
  if (!desktop) out.push(check(ctaFold, "unknown", UNKNOWN, url, "render"));
  else {
    const labels = desktop.marks.filter((mark) => mark.kind === "cta").map((mark) => mark.label);
    out.push(
      check(
        ctaFold,
        desktop.ctaAboveFold ? "pass" : "fail",
        desktop.ctaAboveFold
          ? labels.length
            ? `На первом экране (1440×900) видны кнопки: ${list(labels, 3)}.`
            : "На первом экране (1440×900) видна форма заявки."
          : "В первом экране (1440×900) нет кнопки с действием и нет формы.",
        url,
        "render",
      ),
    );
  }

  const ctaMobile: Spec = {
    ...ctaFold,
    id: "conv.cta_mobile",
    title: "Призыв к действию на первом экране телефона",
    weight: 2,
    why: "Большая часть рекламного трафика в Директе — мобильная. Кнопка, которая на телефоне уехала вниз, теряет заявки.",
    fix: "Проверить мобильную шапку: кнопка заявки или звонка должна быть видна без прокрутки.",
    severity: "important",
  };
  if (!mobile) out.push(check(ctaMobile, "unknown", UNKNOWN, url, "render"));
  else {
    const ok = mobile.ctaAboveFold || mobile.phoneAboveFold;
    out.push(
      check(
        ctaMobile,
        ok ? "pass" : "fail",
        ok
          ? `На экране 390×844 видно: ${[mobile.ctaAboveFold && "кнопка или форма", mobile.phoneAboveFold && "телефон"].filter(Boolean).join(" и ")}.`
          : "На экране телефона 390×844 нет ни кнопки заявки, ни телефона без прокрутки.",
        url,
        "render",
      ),
    );
  }

  const ctaStrength: Spec = {
    id: "conv.cta_strength",
    category: "conversion",
    title: "Тексты кнопок называют действие",
    weight: 2,
    why: "«Подробнее» не обещает результата. Кнопка с конкретным действием и выгодой нажимается заметно чаще.",
    fix: "Заменить «Подробнее» и «Узнать больше» на действие с результатом: «Получить расчёт за 15 минут».",
    severity: "important",
    impact: "medium",
    effort: "low",
  };
  out.push(
    check(
      ctaStrength,
      home.ctas.length >= 2 ? "pass" : home.ctas.length === 1 ? "warn" : "fail",
      home.ctas.length
        ? `Кнопки с действием: ${list(home.ctas)}.${home.weakCtas.length ? ` Слабые: ${list(home.weakCtas, 3)}.` : ""}`
        : home.weakCtas.length
          ? `Кнопок с действием нет. Есть только ${list(home.weakCtas, 3)}.`
          : "На главной нет кнопок с действием («заказать», «рассчитать», «получить»).",
      url,
    ),
  );

  const shop = business === "ecommerce";
  const buyVisible = [desktop, mobile].some((view) => view?.marks.some((mark) => mark.kind === "cta" && /купить|корзин|заказ/i.test(mark.label)));
  out.push(
    check(
      shop
        ? {
            id: "conv.form",
            category: "conversion",
            title: "Путь к покупке",
            weight: 3,
            why: "Для магазина заявка — это покупка: из рекламы посетитель должен сразу видеть корзину или кнопку «Купить».",
            fix: "Сделать кнопку «Купить» / «В корзину» и иконку корзины заметными; для сложных товаров добавить форму «Помочь с выбором».",
            severity: "important",
            impact: "high",
            effort: "medium",
          }
        : {
            id: "conv.form",
            category: "conversion",
            title: "Форма заявки",
            weight: 3,
            why: "Форма — основная точка, где рекламный клик превращается в заявку и цель в Метрике.",
            fix: "Добавить короткую форму: имя и телефон, кнопка с действием. Повторить её внизу страницы.",
            severity: "critical",
            impact: "high",
            effort: "medium",
          },
      home.forms.count > 0 || (shop && (home.cart || buyVisible)) ? "pass" : home.cart || shop ? "warn" : "fail",
      home.forms.count > 0
        ? `На главной форм: ${home.forms.count}.${mobile?.formDepthScreens != null ? ` На телефоне первая форма на ${String(mobile.formDepthScreens).replace(".", ",")} экрана вниз.` : ""}`
        : shop && (home.cart || buyVisible)
          ? `Форм заявки нет, но для магазина путь к покупке есть: ${[home.cart && "корзина", buyVisible && "кнопка покупки на первом экране"].filter(Boolean).join(", ")}.`
          : home.cart
            ? "Форм заявки на главной нет, есть корзина."
            : shop
              ? "Форм заявки на главной нет, корзина и кнопки покупки не найдены автоматически."
              : "На главной нет ни одной формы.",
      url,
    ),
  );

  if (home.forms.count > 0) {
    out.push(
      check(
        {
          id: "conv.form_short",
          category: "conversion",
          title: "Форма короткая",
          weight: 1,
          why: "Каждое лишнее поле снижает долю заполнивших. Для первого касания хватает имени и телефона.",
          fix: "Оставить 2–3 поля, остальное уточнять в разговоре.",
          severity: "minor",
          impact: "medium",
          effort: "low",
        },
        home.forms.maxFields <= 4 ? "pass" : home.forms.maxFields <= 6 ? "warn" : "fail",
        `Самая длинная форма: ${home.forms.maxFields} полей.`,
        url,
      ),
    );
  }

  if (mobile && home.forms.count > 0 && mobile.formDepthScreens !== null) {
    out.push(
      check(
        {
          id: "conv.form_mobile_depth",
          category: "conversion",
          title: "Форма недалеко на телефоне",
          weight: 1,
          why: "Чем дальше форма, тем меньше людей до неё доходит. На телефоне это заметнее всего.",
          fix: "Поднять форму или добавить закреплённую кнопку «Оставить заявку» внизу экрана телефона.",
          severity: "important",
          impact: "medium",
          effort: "low",
        },
        lowerIsBetter(mobile.formDepthScreens, 3, 6),
        `Первая форма на телефоне начинается через ${String(mobile.formDepthScreens).replace(".", ",")} экрана.`,
        url,
        "render",
      ),
    );
  }

  out.push(
    check(
      {
        id: "conv.phone",
        category: "conversion",
        title: "Кликабельный телефон",
        weight: 2,
        why: "С телефона многие предпочитают позвонить. Номер без ссылки tel: приходится копировать вручную.",
        fix: "Сделать номер ссылкой tel: в шапке и в контактах.",
        severity: "important",
        impact: "high",
        effort: "low",
      },
      home.phones.length ? "pass" : "fail",
      home.phones.length ? `Ссылки tel: ${home.phones.slice(0, 3).join(", ")}.` : "Ссылок tel: на главной нет.",
      url,
    ),
  );

  out.push(
    check(
      {
        id: "conv.messengers",
        category: "conversion",
        title: "Мессенджеры",
        weight: 1,
        why: "Часть аудитории не звонит и не заполняет формы, но пишет в мессенджер.",
        fix: "Добавить ссылки на Telegram, WhatsApp или MAX рядом с телефоном.",
        severity: "minor",
        impact: "medium",
        effort: "low",
      },
      home.messengers.length ? "pass" : "warn",
      home.messengers.length ? `Найдены: ${home.messengers.join(", ")}.` : "Ссылок на мессенджеры на главной нет.",
      url,
    ),
  );

  out.push(
    check(
      {
        id: "conv.cta_repeat",
        category: "conversion",
        title: "Призыв повторяется по странице",
        weight: 1,
        why: "Посетитель созревает на разных блоках. Если кнопка только в шапке, на середине страницы действовать нечем.",
        fix: "Повторить кнопку заявки после ключевых блоков: преимущества, цены, отзывы.",
        severity: "minor",
        impact: "medium",
        effort: "low",
      },
      home.ctaCount >= 3 ? "pass" : home.ctaCount >= 1 ? "warn" : "fail",
      `Кнопок и ссылок с действием на главной: ${home.ctaCount}.`,
      url,
    ),
  );

  out.push(
    check(
      {
        id: "conv.contact_paths",
        category: "conversion",
        title: "Несколько способов связаться",
        weight: 1,
        why: "Разным людям удобно по-разному. Один канал связи — это потерянная часть заявок.",
        fix: "Дать минимум два канала: форма и телефон, лучше ещё мессенджер.",
        severity: contactPaths === 0 ? "critical" : "minor",
        impact: "high",
        effort: "low",
      },
      contactPaths >= 2 ? "pass" : contactPaths === 1 ? "warn" : "fail",
      `Каналов связи на главной: ${contactPaths} из 3 (форма, телефон, мессенджер).${home.analytics.chats.length ? ` Есть онлайн-чат: ${home.analytics.chats.join(", ")}.` : ""}`,
      url,
    ),
  );

  if (ai) {
    out.push(
      check(
        {
          id: "conv.ai_path",
          category: "conversion",
          title: "Понятный следующий шаг",
          weight: 2,
          why: "Даже при наличии кнопок путь к заявке может быть неочевидным: много равнозначных действий, нет логики блоков.",
          fix: "Выстроить один главный путь: оффер → выгоды → доказательства → форма. Второстепенные действия сделать тише.",
          severity: "important",
          impact: "high",
          effort: "medium",
        },
        scoreStatus(ai.ux.pathToLead, 8, 5),
        `Оценка по скриншотам: ${ai.ux.pathToLead}/10. ${ai.ux.comment}`,
        url,
        "ai",
        0.7,
      ),
    );
  }

  // ── Оффер ────────────────────────────────────────────────────
  const h1 = home.h1s[0] || "";
  const genericH1 = /^(главная|добро пожаловать|о компании|home|welcome)$/i.test(h1.trim());
  out.push(
    check(
      {
        id: "offer.h1",
        category: "offer",
        title: "Главный заголовок называет предложение",
        weight: 2,
        why: "Заголовок — первое, что читают после клика по объявлению. Он должен совпадать с запросом и обещанием в рекламе.",
        fix: "Сформулировать H1: что продаёте, кому и с каким результатом. Например, «Кухни на заказ в Москве за 14 дней».",
        severity: h1 ? "important" : "critical",
        impact: "high",
        effort: "low",
      },
      !h1 || genericH1 ? "fail" : h1.length < 12 || h1.length > 110 ? "warn" : "pass",
      h1 ? `H1 = «${h1}» (${h1.length} знаков).` : "H1 = отсутствует.",
      url,
    ),
  );

  if (ai) {
    out.push(
      check(
        {
          id: "offer.ai_clarity",
          category: "offer",
          title: "Понятно, что продают и кому",
          weight: 4,
          why: "Если за несколько секунд не ясно, что предлагают, клик из рекламы оплачен впустую.",
          fix: "Переписать первый экран: продукт, аудитория, результат — одной фразой в заголовке и одной в подзаголовке.",
          severity: "critical",
          impact: "high",
          effort: "low",
        },
        scoreStatus(ai.offer.clarity, 8, 5),
        `Оффер понятен на ${ai.offer.clarity}/10. ${ai.offer.conclusion}${ai.offer.quote ? ` Цитата: «${ai.offer.quote}».` : ""}`,
        url,
        "ai",
        0.75,
      ),
    );
    out.push(
      check(
        {
          id: "offer.ai_diff",
          category: "offer",
          title: "Есть отличие от конкурентов",
          weight: 3,
          why: "В рекламе рядом стоят конкуренты. Без причины выбрать вас пользователь вернётся в выдачу и кликнет следующего.",
          fix: "Вынести на первый экран 1–2 конкретных отличия: срок, гарантия, цена, опыт в цифрах.",
          severity: "important",
          impact: "high",
          effort: "medium",
        },
        scoreStatus(ai.offer.differentiation, 7, 4),
        `Отличие ${ai.offer.differentiation}/10. ${ai.offer.usp ? `УТП по тексту страницы: «${ai.offer.usp}».` : "Явного УТП на первом экране не найдено."}`,
        url,
        "ai",
        0.7,
      ),
    );
  }

  out.push(
    check(
      {
        id: "offer.specifics",
        category: "offer",
        title: "Конкретика в цифрах",
        weight: 2,
        why: "Цифры (сроки, цены, годы, количество проектов) вызывают больше доверия, чем общие слова «качественно и недорого».",
        fix: "Добавить в первый экран и заголовки 2–3 цифры: срок, цена «от», опыт, гарантия.",
        severity: "minor",
        impact: "medium",
        effort: "low",
      },
      home.specifics.length >= 2 ? "pass" : home.specifics.length === 1 ? "warn" : "fail",
      home.specifics.length ? `В заголовках и начале страницы: ${list(home.specifics)}.` : "В заголовках и начале страницы нет цифр: сроков, цен, опыта.",
      url,
    ),
  );

  const priceExpected = ai ? ai.business.priceExpected : business === "ecommerce" || business === "services" || business === "local";
  out.push(
    check(
      {
        id: "offer.prices",
        category: "offer",
        title: "Цены или условия",
        weight: priceExpected ? 2 : 1,
        why: "Без ориентира по цене часть посетителей уходит сравнивать к конкурентам, а заявки приходят нецелевые.",
        fix: "Показать цену «от», пакеты или пример расчёта текстом на странице.",
        severity: priceExpected ? "important" : "minor",
        impact: "medium",
        effort: "medium",
      },
      home.prices.length ? "pass" : priceExpected ? "fail" : "warn",
      home.prices.length ? `Цены на главной: ${list(home.prices, 3)}.` : "Цен в рублях на главной не найдено.",
      url,
    ),
  );

  out.push(
    check(
      {
        id: "offer.advantages",
        category: "offer",
        title: "Блок преимуществ",
        weight: 1,
        why: "Короткий список выгод отвечает на вопрос «почему вы», не заставляя читать весь сайт.",
        fix: "Добавить блок «Почему мы» с 3–5 конкретными выгодами.",
        severity: "minor",
        impact: "medium",
        effort: "low",
      },
      home.hasAdvantages ? "pass" : "warn",
      home.hasAdvantages ? "Найден блок преимуществ («почему мы», «преимущества»)." : "Блока преимуществ в заголовках и тексте не найдено.",
      url,
    ),
  );

  // ── UX ───────────────────────────────────────────────────────
  out.push(
    check(
      {
        id: "ux.viewport",
        category: "ux",
        title: "Мобильная адаптация включена",
        weight: 2,
        why: "Без мета-тега viewport телефон показывает уменьшенную десктопную версию — читать и нажимать неудобно.",
        fix: "Добавить <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
        severity: "critical",
        impact: "high",
        effort: "low",
      },
      home.viewport ? "pass" : "fail",
      home.viewport ? "Мета-тег viewport есть." : "Мета-тега viewport нет.",
      url,
    ),
  );

  const overflow: Spec = {
    id: "ux.mobile_overflow",
    category: "ux",
    title: "Страница помещается в экран телефона",
    weight: 2,
    why: "Горизонтальная прокрутка на телефоне выглядит как сломанный сайт и снижает доверие.",
    fix: "Найти элемент шире экрана (таблица, картинка, слайдер) и ограничить ширину.",
    severity: "important",
    impact: "medium",
    effort: "medium",
  };
  out.push(
    mobile
      ? check(overflow, mobile.horizontalScroll ? "fail" : "pass", mobile.horizontalScroll ? "На ширине 390 px появляется горизонтальная прокрутка." : "На ширине 390 px горизонтальной прокрутки нет.", url, "render")
      : check(overflow, "unknown", UNKNOWN, url, "render"),
  );

  const font: Spec = {
    id: "ux.mobile_font",
    category: "ux",
    title: "Читаемый текст на телефоне",
    weight: 1,
    why: "Мелкий текст приходится увеличивать пальцами — большинство просто уходит.",
    fix: "Основной текст на телефоне не меньше 15–16 px.",
    severity: "minor",
    impact: "medium",
    effort: "low",
  };
  out.push(
    mobile && mobile.baseFontPx
      ? check(font, mobile.baseFontPx >= 15 ? "pass" : mobile.baseFontPx >= 13 ? "warn" : "fail", `Типичный размер текста на телефоне: ${Math.round(mobile.baseFontPx)} px.`, url, "render")
      : check(font, "unknown", UNKNOWN, url, "render"),
  );

  const tap: Spec = {
    id: "ux.tap_targets",
    category: "ux",
    title: "Удобные для пальца кнопки",
    weight: 1,
    why: "Мелкие ссылки и кнопки на телефоне промахиваются — человек раздражается и уходит.",
    fix: "Сделать кнопки и ссылки меню не ниже 40 px по высоте.",
    severity: "minor",
    impact: "low",
    effort: "low",
  };
  out.push(
    mobile && mobile.smallTapShare !== null
      ? check(tap, lowerIsBetter(mobile.smallTapShare, 0.35, 0.6), `Мелких (ниже 32 px) интерактивных элементов: ${Math.round(mobile.smallTapShare * 100)}%.`, url, "render")
      : check(tap, "unknown", UNKNOWN, url, "render"),
  );

  out.push(
    check(
      {
        id: "ux.nav",
        category: "ux",
        title: "Понятное меню",
        weight: 1,
        why: "Часть рекламного трафика сначала ищет цены, контакты или отзывы. Без меню их не найти.",
        fix: "Добавить в шапку 4–7 пунктов: услуги, цены, отзывы, контакты.",
        severity: "minor",
        impact: "low",
        effort: "low",
      },
      home.navLinks >= 3 ? "pass" : home.navLinks >= 1 ? "warn" : "fail",
      `Ссылок в шапке или меню: ${home.navLinks}.`,
      url,
    ),
  );

  if (ai) {
    out.push(
      check(
        {
          id: "ux.ai_hierarchy",
          category: "ux",
          title: "Визуальная иерархия первого экрана",
          weight: 3,
          why: "Взгляд должен идти по порядку: заголовок → выгода → кнопка. Если всё одинаково громкое, главное теряется.",
          fix: "Оставить на первом экране один крупный заголовок, короткий подзаголовок и одну контрастную кнопку.",
          severity: "important",
          impact: "medium",
          effort: "medium",
        },
        scoreStatus(ai.ux.hierarchy, 8, 5),
        `Оценка по скриншоту: ${ai.ux.hierarchy}/10. ${ai.firstScreen.comment}`,
        url,
        "ai",
        0.7,
      ),
    );
  }

  // ── SEO ──────────────────────────────────────────────────────
  out.push(
    check(
      {
        id: "seo.status",
        category: "seo",
        title: "Главная страница открывается",
        weight: 3,
        why: "Если страница отвечает ошибкой, реклама не пройдёт модерацию, а клики будут потрачены впустую.",
        fix: "Исправить ответ сервера: главная должна отдавать код 200.",
        severity: "critical",
        impact: "high",
        effort: "medium",
      },
      home.status === 200 ? "pass" : home.status < 400 ? "warn" : "fail",
      `Код ответа ${home.status}.${signals.redirects.length ? ` Перенаправлений: ${signals.redirects.length} (${signals.redirects.map((r) => r.status).join(" → ")}).` : ""}`,
      url,
    ),
  );

  out.push(
    check(
      {
        id: "seo.https",
        category: "seo",
        title: "Защищённое соединение HTTPS",
        weight: 2,
        why: "Браузер помечает сайт без HTTPS как небезопасный. Люди не оставляют на нём телефон.",
        fix: "Подключить SSL-сертификат и перенаправить http на https.",
        severity: "critical",
        impact: "high",
        effort: "low",
      },
      signals.https ? "pass" : "fail",
      signals.https ? `Итоговый адрес: ${signals.finalUrl}.` : `Сайт открывается по http: ${signals.finalUrl}.`,
      url,
    ),
  );

  const title = home.title;
  out.push(
    check(
      {
        id: "seo.title",
        category: "seo",
        title: "Title страницы",
        weight: 2,
        why: "Title — заголовок вкладки и сниппета в поиске. Он влияет на узнаваемость и клики.",
        fix: "Title 30–65 знаков: услуга, город, название компании.",
        severity: "minor",
        impact: "medium",
        effort: "low",
      },
      !title ? "fail" : title.length < 20 || title.length > 75 ? "warn" : "pass",
      title ? `Title = «${title}» (${title.length} знаков).` : "Title = отсутствует.",
      url,
    ),
  );

  out.push(
    check(
      {
        id: "seo.description",
        category: "seo",
        title: "Мета-описание",
        weight: 1,
        why: "Описание часто становится текстом сниппета в поиске.",
        fix: "Написать описание 70–160 знаков: что продаёте, где, чем отличаетесь.",
        severity: "minor",
        impact: "low",
        effort: "low",
      },
      !home.description ? "fail" : home.description.length < 50 || home.description.length > 180 ? "warn" : "pass",
      home.description ? `Description ${home.description.length} знаков: «${home.description.slice(0, 160)}».` : "Description = отсутствует.",
      url,
    ),
  );

  out.push(
    check(
      {
        id: "seo.h1_single",
        category: "seo",
        title: "Один H1 на странице",
        weight: 1,
        why: "Несколько H1 размывают тему страницы для поисковика.",
        fix: "Оставить один H1, остальные заголовки сделать H2.",
        severity: "minor",
        impact: "low",
        effort: "low",
      },
      home.h1s.length === 1 ? "pass" : home.h1s.length === 0 ? "fail" : "warn",
      `H1 на главной: ${home.h1s.length}.`,
      url,
    ),
  );

  out.push(
    check(
      {
        id: "seo.h2",
        category: "seo",
        title: "Структура подзаголовков",
        weight: 0.5,
        why: "Подзаголовки помогают и людям, и поисковикам понять структуру страницы.",
        fix: "Разбить страницу на блоки с понятными H2.",
        severity: "minor",
        impact: "low",
        effort: "low",
      },
      home.h2s.length >= 3 ? "pass" : home.h2s.length >= 1 ? "warn" : "fail",
      `H2 на главной: ${home.h2s.length}.`,
      url,
    ),
  );

  out.push(
    check(
      {
        id: "seo.noindex",
        category: "seo",
        title: "Страница открыта для поиска",
        weight: 3,
        why: "Метка noindex убирает страницу из поиска. Обычно это забытая настройка после разработки.",
        fix: "Убрать noindex из мета-тега robots на страницах, которые должны быть в поиске.",
        severity: "critical",
        impact: "medium",
        effort: "low",
      },
      home.noindex ? "fail" : "pass",
      home.noindex ? "В мета-теге robots стоит noindex." : "Метки noindex нет.",
      url,
    ),
  );

  out.push(
    check(
      {
        id: "seo.canonical",
        category: "seo",
        title: "Canonical",
        weight: 1,
        why: "Canonical подсказывает поисковику главный адрес страницы и защищает от дублей с UTM-метками рекламы.",
        fix: "Поставить <link rel=\"canonical\"> на собственный адрес страницы.",
        severity: "minor",
        impact: "low",
        effort: "low",
      },
      home.canonical ? "pass" : "warn",
      home.canonical ? `Canonical = ${home.canonical}.` : "Canonical = отсутствует.",
      url,
    ),
  );

  if (files) {
    out.push(
      check(
        {
          id: "seo.robots",
          category: "seo",
          title: "robots.txt",
          weight: files.robots.blocksYandex ? 3 : 1,
          why: "robots.txt управляет обходом сайта поисковиками. Ошибка в нём может закрыть весь сайт.",
          fix: files.robots.blocksYandex ? "Снять Disallow: / для Яндекса." : "Положить robots.txt в корень сайта со строкой Sitemap.",
          severity: files.robots.blocksYandex ? "critical" : "minor",
          impact: files.robots.blocksYandex ? "high" : "low",
          effort: "low",
        },
        files.robots.blocksYandex ? "fail" : files.robots.found ? "pass" : "warn",
        files.robots.blocksYandex
          ? "robots.txt закрывает сайт от Яндекса (Disallow: /)."
          : files.robots.found
            ? `robots.txt найден${files.robots.sitemaps.length ? `, Sitemap: ${files.robots.sitemaps[0]}` : ", строки Sitemap нет"}.`
            : "robots.txt не найден.",
        files.robots.url,
      ),
    );
    out.push(
      check(
        {
          id: "seo.sitemap",
          category: "seo",
          title: "sitemap.xml",
          weight: 1,
          why: "Карта сайта помогает поисковику найти все страницы услуг и товаров.",
          fix: "Сделать sitemap.xml с адресами этого домена.",
          severity: "minor",
          impact: "low",
          effort: "low",
        },
        files.sitemap.found && !files.sitemap.foreignHosts.length ? "pass" : files.sitemap.found ? "warn" : "fail",
        files.sitemap.found
          ? `Карта найдена, адресов: ${files.sitemap.locs}.${files.sitemap.foreignHosts.length ? ` Есть чужие домены: ${files.sitemap.foreignHosts.join(", ")}.` : ""}`
          : `${files.sitemap.url} не найден.`,
        files.sitemap.url,
      ),
    );
  }

  if (home.images > 0) {
    const share = home.imagesNoAlt / home.images;
    out.push(
      check(
        {
          id: "seo.alt",
          category: "seo",
          title: "Подписи alt у картинок",
          weight: 1,
          why: "Alt помогает поиску по картинкам и доступности сайта.",
          fix: "Подписать изображения товаров и работ коротким описанием.",
          severity: "minor",
          impact: "low",
          effort: "low",
        },
        lowerIsBetter(share, 0.2, 0.5),
        `Без alt: ${home.imagesNoAlt} из ${home.images} картинок.`,
        url,
      ),
    );
  }

  out.push(
    check(
      {
        id: "seo.og",
        category: "seo",
        title: "Open Graph для соцсетей и мессенджеров",
        weight: 0.5,
        why: "Без Open Graph ссылка в мессенджере выглядит голой строкой — меньше переходов из пересылок.",
        fix: "Добавить og:title, og:description и og:image.",
        severity: "minor",
        impact: "low",
        effort: "low",
      },
      home.og ? "pass" : "warn",
      home.og ? "og:title найден." : "Мета-тегов Open Graph нет.",
      url,
    ),
  );

  out.push(
    check(
      {
        id: "seo.schema",
        category: "seo",
        title: "Микроразметка",
        weight: 0.5,
        why: "Разметка Organization, Product, LocalBusiness делает сниппет в поиске информативнее.",
        fix: "Добавить JSON-LD с типом Organization или LocalBusiness, для магазина — Product.",
        severity: "minor",
        impact: "low",
        effort: "medium",
      },
      home.schemaTypes.length ? "pass" : "warn",
      home.schemaTypes.length ? `Типы разметки: ${home.schemaTypes.slice(0, 5).join(", ")}.` : "Микроразметки schema.org не найдено.",
      url,
    ),
  );

  const opened = signals.inner.filter((page) => page.status > 0);
  if (opened.length) {
    const broken = opened.filter((page) => page.status >= 400);
    out.push(
      check(
        {
          id: "seo.inner_status",
          category: "seo",
          title: "Ключевые страницы открываются",
          weight: 1,
          why: "Битые разделы из меню — потерянные посетители и сигнал о заброшенном сайте.",
          fix: "Исправить или убрать из меню ссылки, которые отдают ошибку.",
          severity: "important",
          impact: "medium",
          effort: "low",
        },
        broken.length ? "fail" : "pass",
        broken.length ? `С ошибкой: ${broken.map((page) => `${page.url} (${page.status})`).join(", ")}.` : `Открылись все ${opened.length} проверенных страниц.`,
        broken[0]?.url || url,
      ),
    );
    const titles = new Map<string, string[]>();
    for (const page of [{ url, title: home.title }, ...opened]) {
      const key = page.title.trim().toLowerCase();
      if (key) titles.set(key, [...(titles.get(key) || []), page.url]);
    }
    const dupes = [...titles.values()].filter((urls) => urls.length > 1);
    out.push(
      check(
        {
          id: "seo.dupe_titles",
          category: "seo",
          title: "Разные title у страниц",
          weight: 1,
          why: "Одинаковые title мешают поисковику различать страницы услуг.",
          fix: "Дать каждой странице свой title под её услугу или товар.",
          severity: "minor",
          impact: "low",
          effort: "low",
        },
        dupes.length ? "warn" : "pass",
        dupes.length ? `Одинаковый title: ${dupes[0].join(", ")}.` : `Повторов title на ${opened.length + 1} страницах нет.`,
        url,
      ),
    );
  }

  // ── Скорость ─────────────────────────────────────────────────
  const perfSpec = (id: string, title: string, weight: number, why: string, fix: string, severity: Severity, impact: Level, effort: Level): Spec => ({
    id,
    category: "performance",
    title,
    weight,
    why,
    fix,
    severity,
    impact,
    effort,
  });
  const lcp = perfSpec(
    "perf.lcp",
    "Загрузка главного содержимого (LCP)",
    3,
    "Если главный блок появляется дольше 2,5 с, часть рекламных кликов уходит, не дождавшись страницы.",
    "Сжать главную картинку первого экрана (WebP, нужный размер), отложить сторонние скрипты.",
    "important",
    "high",
    "medium",
  );
  const cls = perfSpec(
    "perf.cls",
    "Стабильность вёрстки (CLS)",
    2,
    "Когда блоки прыгают при загрузке, человек промахивается по кнопкам.",
    "Задать размеры картинкам и баннерам, не вставлять блоки над уже показанным текстом.",
    "minor",
    "medium",
    "medium",
  );
  const fcp = perfSpec("perf.fcp", "Первое отображение (FCP)", 1, "Белый экран дольше 2 секунд выглядит как неработающий сайт.", "Уменьшить блокирующие CSS и JS в начале страницы.", "minor", "medium", "medium");
  const ttfb = perfSpec("perf.ttfb", "Ответ сервера (TTFB)", 1, "Медленный ответ сервера тормозит всё остальное.", "Включить кеширование страниц на сервере или сменить тариф хостинга.", "minor", "medium", "medium");
  const weight = perfSpec("perf.weight", "Вес страницы", 2, "Тяжёлая страница долго грузится на мобильном интернете.", "Сжать изображения, убрать неиспользуемые скрипты и шрифты.", "minor", "medium", "medium");
  const requests = perfSpec("perf.requests", "Количество запросов", 1, "Сотни запросов замедляют загрузку на телефоне.", "Объединить и отложить сторонние виджеты, убрать лишние.", "minor", "low", "medium");
  const js = perfSpec("perf.js", "Объём скриптов", 1, "Тяжёлые скрипты держат телефон занятым и задерживают реакцию на нажатия.", "Убрать неиспользуемые библиотеки и виджеты, грузить их после показа страницы.", "minor", "medium", "high");
  const img = perfSpec("perf.images", "Вес изображений", 1, "Несжатые картинки — самая частая причина медленного сайта.", "Перевести изображения в WebP и отдавать нужного размера.", "minor", "medium", "low");

  const lab = "Лабораторный замер в браузере с нашего сервера, не данные реальных посетителей.";
  if (!perf) {
    for (const spec of [lcp, cls, fcp, ttfb, weight, requests, js, img]) {
      out.push(check(spec, "unknown", `Недостаточно данных: браузер не смог открыть страницу${render.error ? ` (${render.error})` : ""}.`, url, "render"));
    }
  } else {
    const push = (spec: Spec, value: number | null, status: (v: number) => CheckStatus, text: (v: number) => string) =>
      out.push(value === null ? check(spec, "unknown", "Недостаточно данных: браузер не вернул этот показатель.", url, "render") : check(spec, status(value), `${text(value)} ${lab}`, url, "render"));
    push(lcp, perf.lcpMs, (v) => lowerIsBetter(v, 2500, 4000), (v) => `LCP = ${ms(v)}.`);
    push(cls, perf.cls, (v) => lowerIsBetter(v, 0.1, 0.25), (v) => `CLS = ${String(v).replace(".", ",")}.`);
    push(fcp, perf.fcpMs, (v) => lowerIsBetter(v, 1800, 3000), (v) => `FCP = ${ms(v)}.`);
    push(ttfb, perf.ttfbMs, (v) => lowerIsBetter(v, 800, 1800), (v) => `TTFB = ${ms(v)}.`);
    push(weight, perf.transferKb, (v) => lowerIsBetter(v, 2048, 5120), (v) => `Передано ${kb(v)}.`);
    push(requests, perf.requests, (v) => lowerIsBetter(v, 80, 150), (v) => `Запросов: ${v}.`);
    push(js, perf.jsKb, (v) => lowerIsBetter(v, 600, 1500), (v) => `Скрипты: ${kb(v)}.`);
    push(img, perf.imgKb, (v) => lowerIsBetter(v, 1024, 3072), (v) => `Изображения: ${kb(v)}.`);
  }

  // ── Доверие ──────────────────────────────────────────────────
  const t = home.trust;
  const trust = (id: string, title: string, weight: number, ok: boolean, found: string, missing: string, why: string, fix: string, severity: Severity = "minor", impact: Level = "medium", evidenceUrl: string | null = url, missingStatus: CheckStatus = "fail") =>
    out.push(check({ id, category: "trust", title, weight, why, fix, severity, impact, effort: "low" }, ok ? "pass" : missingStatus, ok ? found : missing, evidenceUrl));

  trust("trust.reviews", "Отзывы клиентов", 2, t.reviews, "На главной есть отзывы или виджет отзывов.", "Отзывов на главной не найдено.", "Отзывы — главный аргумент для нового посетителя из рекламы, который о компании ничего не знает.", "Добавить 3–6 отзывов с именами и фото или виджет отзывов Яндекс Карт.", "important", "high");
  trust("trust.cases", "Кейсы и примеры работ", 1.5, t.cases, "Есть упоминание кейсов, портфолио или выполненных работ.", "Кейсов и примеров работ на главной не найдено.", "Примеры работ показывают результат, который получит клиент.", "Добавить 3–5 примеров работ с цифрами: задача, срок, результат.", "important", "medium", url, "warn");
  trust("trust.legal", "Реквизиты компании", 2, Boolean(t.inn) || t.ogrn, `Реквизиты найдены${t.inn ? `: ИНН ${t.inn}` : " (ОГРН)"}.`, "ИНН и ОГРН на главной не найдены.", "Реквизиты показывают, что за сайтом стоит реальная компания. Для Директа это ещё и требование к рекламодателю.", "Указать в подвале название юрлица, ИНН и ОГРН.", "important", "medium");
  trust("trust.address", "Адрес", 1.5, t.address, "Адрес или карта на главной найдены.", "Адреса на главной не найдено.", "Физический адрес снижает страх «а вдруг это однодневка».", "Указать адрес в подвале и на странице контактов, добавить карту.");
  trust("trust.privacy", "Политика конфиденциальности", 1.5, Boolean(t.privacyUrl), `Ссылка: ${t.privacyUrl}.`, "Ссылки на политику обработки персональных данных нет.", "По 152-ФЗ сайт, который собирает телефоны, обязан публиковать политику. Модерация рекламы и пользователи это замечают.", "Опубликовать политику обработки персональных данных и поставить ссылку в подвал и у форм.", "important", "medium", t.privacyUrl || url);
  if (home.forms.count > 0) {
    trust("trust.consent", "Согласие на обработку данных у формы", 1, home.forms.consent, "Текст согласия на обработку персональных данных найден.", "У форм нет текста согласия на обработку персональных данных.", "Без согласия форма нарушает 152-ФЗ, а часть людей не оставит телефон.", "Добавить под кнопкой формы строку о согласии со ссылкой на политику.", "important", "medium");
  }
  trust("trust.guarantee", "Гарантии", 1, t.guarantee, "Гарантии упомянуты.", "Гарантий на главной не найдено.", "Гарантия снимает риск первой покупки или заявки.", "Сформулировать конкретную гарантию: срок, что входит, что будет, если не понравится.", "minor", "medium", url, "warn");
  trust("trust.clients", "Клиенты и партнёры", 1, t.clients, "Есть блок клиентов или партнёров.", "Блока клиентов или партнёров не найдено.", "Узнаваемые клиенты — быстрый социальный довод.", "Добавить логотипы клиентов или партнёров с их согласия.", "minor", "low", url, "warn");
  trust("trust.certs", "Сертификаты и лицензии", 1, t.certificates, "Сертификаты, лицензии или СРО упомянуты.", "Сертификатов и лицензий не найдено.", "Документы подтверждают квалификацию, особенно в B2B, медицине и строительстве.", "Показать сертификаты, лицензии или членство в СРО, если они есть.", "minor", "low", url, "warn");
  trust("trust.about", "Информация о компании", 1, Boolean(t.aboutUrl) || Boolean(t.years), t.aboutUrl ? `Страница о компании: ${t.aboutUrl}.` : `Опыт указан: «${t.years}».`, "Страницы «О компании» и упоминания опыта не найдено.", "Посетитель хочет понять, кто стоит за сайтом и сколько лет на рынке.", "Добавить раздел «О компании»: годы работы, команда, производство или офис.", "minor", "low", t.aboutUrl || url, "warn");
  if (business === "ecommerce") {
    trust("trust.oferta", "Публичная оферта", 0.5, Boolean(t.ofertaUrl), `Оферта: ${t.ofertaUrl}.`, "Оферты или условий продажи не найдено.", "Для магазина условия покупки, доставки и возврата — обязательная часть доверия.", "Опубликовать оферту и условия доставки и возврата.", "minor", "low", t.ofertaUrl || url);
  }

  // ── Аналитика и реклама ──────────────────────────────────────
  const a = home.analytics;
  const an = (spec: Omit<Spec, "category">, status: CheckStatus, evidence: string) => out.push(check({ ...spec, category: "analytics" }, status, evidence, url));
  an(
    {
      id: "an.metrika",
      title: "Яндекс.Метрика",
      weight: 3,
      why: "Без Метрики Директ не видит конверсий: стратегии на заявки не обучаются, бюджет тратится вслепую.",
      fix: "Установить счётчик Метрики на все страницы и связать его с Директом.",
      severity: "critical",
      impact: "high",
      effort: "low",
    },
    a.metrika ? "pass" : a.gtm ? "warn" : "fail",
    a.metrika ? `Счётчик найден${a.metrikaId ? `: ${a.metrikaId}` : ""}.` : a.gtm ? "Кода Метрики в HTML нет, но есть Google Tag Manager — счётчик мог подключаться через него." : "Кода Яндекс.Метрики не найдено.",
  );
  an(
    {
      id: "an.goals",
      title: "Цели и конверсии",
      weight: 0,
      why: "Директ оптимизирует рекламу по целям. Без целей на форму и звонок кампании не обучатся.",
      fix: "Проверить в Метрике цели: отправка формы, клик по телефону и мессенджеру, переход в корзину.",
      severity: "important",
      impact: "high",
      effort: "low",
    },
    "info",
    a.metrika ? "Наличие счётчика обнаружено. Корректность целей проверить автоматически невозможно." : "Счётчика нет — цели настроить негде.",
  );
  an(
    {
      id: "an.forms_trackable",
      title: "Заявки можно отследить",
      weight: 1,
      why: "Чтобы считать стоимость заявки, должна быть и точка конверсии (форма, телефон), и счётчик.",
      fix: "Связать форму и телефон с целями Метрики.",
      severity: "important",
      impact: "high",
      effort: "low",
    },
    a.metrika && (home.forms.count > 0 || home.phones.length > 0) ? "pass" : "fail",
    a.metrika && (home.forms.count > 0 || home.phones.length > 0) ? "Есть счётчик и точки конверсии (форма или телефон)." : !a.metrika ? "Нет счётчика — заявки из рекламы не будут видны." : "Нет формы и кликабельного телефона — отслеживать нечего.",
  );
  an(
    {
      id: "an.ga_gtm",
      title: "Google Analytics / Tag Manager",
      weight: 0.5,
      why: "Дополнительная аналитика полезна для сквозных отчётов, но для Директа не обязательна.",
      fix: "При необходимости подключить GA4 через Tag Manager.",
      severity: "minor",
      impact: "low",
      effort: "low",
    },
    a.ga4 || a.gtm ? "pass" : "warn",
    [a.ga4 && "GA4", a.gtm && "Google Tag Manager"].filter(Boolean).join(", ") || "GA4 и GTM не найдены.",
  );
  an(
    {
      id: "an.pixels",
      title: "Пиксели ретаргетинга",
      weight: 0.5,
      why: "Пиксели VK и Top.Mail.ru позволяют догонять посетителей рекламой.",
      fix: "Поставить пиксель VK Рекламы, если планируется ретаргетинг.",
      severity: "minor",
      impact: "low",
      effort: "low",
    },
    a.vkPixel || a.topMail ? "pass" : "warn",
    a.vkPixel || a.topMail ? `Найдены: ${[a.vkPixel && "VK", a.topMail && "Top.Mail.ru"].filter(Boolean).join(", ")}.` : "Пикселей VK и Top.Mail.ru не найдено.",
  );
  an(
    {
      id: "an.calltracking",
      title: "Коллтрекинг",
      weight: 1,
      why: "Если заметная часть заявок приходит звонками, без коллтрекинга не видно, какая реклама их приносит.",
      fix: "Подключить коллтрекинг (Calltouch, CoMagic, Callibri) или хотя бы цель на клик по номеру.",
      severity: "minor",
      impact: "medium",
      effort: "medium",
    },
    a.calltracking.length ? "pass" : "warn",
    a.calltracking.length ? `Найден: ${a.calltracking.join(", ")}.` : "Коллтрекинга не найдено (определяется по коду на странице).",
  );
  if (business === "ecommerce") {
    an(
      {
        id: "an.ecommerce",
        title: "Электронная коммерция в Метрике",
        weight: 1,
        why: "Без ecommerce-данных Директ не видит выручку и не может оптимизировать по доходу.",
        fix: "Передавать в dataLayer события просмотра, корзины и покупки.",
        severity: "important",
        impact: "medium",
        effort: "medium",
      },
      a.ecommerce ? "pass" : "warn",
      a.ecommerce ? "В коде есть dataLayer с ecommerce." : "Признаков ecommerce-разметки в коде главной нет.",
    );
  }
  an(
    {
      id: "an.thanks",
      title: "Страница благодарности",
      weight: 0.5,
      why: "Отдельная страница «Спасибо» — самый надёжный способ считать заявки как цель.",
      fix: "После отправки формы вести на /spasibo и настроить цель на посещение.",
      severity: "minor",
      impact: "low",
      effort: "low",
    },
    a.thanksUrl ? "pass" : "unknown",
    a.thanksUrl ? `Найдена ссылка: ${a.thanksUrl}.` : UNKNOWN + ": страница благодарности открывается только после отправки формы.",
  );

  return out;
}
