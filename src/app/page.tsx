// Главная страница — продающий лендинг Konversus Leads AI
import Link from "next/link";

const FEATURES = [
  {
    icon: "🔍",
    title: "Автоматический мониторинг",
    desc: "Система сама отслеживает новые заказы на Profi.ru, Авито Услуги, FL.ru и Kwork. Вам не нужно мониторить десятки площадок вручную.",
  },
  {
    icon: "🧠",
    title: "AI-анализ каждой заявки",
    desc: "Искусственный интеллект оценивает заявку по 100-балльной шкале, прогнозирует бюджет и даёт рекомендацию: откликнуться, подумать или пропустить.",
  },
  {
    icon: "📝",
    title: "Готовые отклики",
    desc: "Для каждой заявки генерируется 4 варианта отклика: краткий, продающий, экспертный и технический. Копируйте и отправляйте одним кликом.",
  },
  {
    icon: "📱",
    title: "Уведомления в Telegram",
    desc: "Новые заявки приходят мгновенно в Telegram с оценкой, бюджетом и описанием. Вы видите только подходящие заказы.",
  },
  {
    icon: "📊",
    title: "Аналитика и воронка",
    desc: "Отслеживайте конверсию: сколько заявок → откликов → сделок. Понимайте, какие площадки приносят больше прибыли.",
  },
  {
    icon: "🎯",
    title: "Умные фильтры",
    desc: "Настройте ключевые слова, бюджет и регион. Система отсеивает мусор и показывает только релевантные заявки под ваш профиль.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Подключите площадки",
    desc: "Выберите источники заявок: Profi.ru, Авито Услуги, FL.ru, Kwork. Настройте ключевые слова и фильтры под свою специализацию.",
  },
  {
    num: "02",
    title: "Получайте лучшие заявки",
    desc: "AI анализирует каждую заявку, отсеивает спам и мусор, оценивает вероятность сделки. В Telegram приходят только подходящие заказы.",
  },
  {
    num: "03",
    title: "Откликайтесь первым",
    desc: "Готовый отклик уже ждёт вас. Копируйте, адаптируйте под себя и отправляйте. Вы быстрее конкурентов на 15–30 минут.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(99,102,241,0.15),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Не ищите заказы —{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                они найдут вас
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-300 sm:text-xl">
              Konversus Leads AI автоматически мониторит заказы на Profi.ru,
              Авито, FL.ru и Kwork, анализирует их через ИИ и присылает только
              подходящие в Telegram.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/dashboard"
                className="rounded-xl bg-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-indigo-500 transition-colors"
              >
                Начать бесплатно
              </Link>
              <Link
                href="#how"
                className="text-lg font-semibold leading-6 text-gray-300 hover:text-white transition-colors"
              >
                Как работает →
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Как работает */}
      <section id="how" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Как это работает
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Три шага от хаоса к системе
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-5xl gap-12 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.num} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-2xl font-bold text-indigo-600">
                  {step.num}
                </div>
                <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Возможности */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Всё, что нужно для работы с заказами
            </h2>
          </div>
          <div className="mx-auto mt-16 grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Цены */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Тарифы
            </h2>
          </div>
          <div className="mx-auto mt-16 grid max-w-4xl gap-8 sm:grid-cols-2">
            {/* Free */}
            <div className="rounded-2xl border border-gray-200 p-8">
              <h3 className="text-xl font-semibold">Бесплатный</h3>
              <p className="mt-2 text-gray-500">Для старта</p>
              <p className="mt-6 text-4xl font-bold">0 ₽</p>
              <ul className="mt-8 space-y-3 text-gray-600">
                <li>✓ 1 источник заявок</li>
                <li>✓ 50 заявок в день</li>
                <li>✓ Telegram-уведомления</li>
                <li>✓ Базовые фильтры</li>
                <li>✗ AI-анализ</li>
                <li>✗ Генерация откликов</li>
              </ul>
              <Link
                href="/dashboard"
                className="mt-8 block rounded-xl border border-indigo-600 px-6 py-3 text-center font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                Начать
              </Link>
            </div>
            {/* Pro */}
            <div className="rounded-2xl bg-indigo-600 p-8 text-white ring-1 ring-indigo-600">
              <h3 className="text-xl font-semibold">Pro</h3>
              <p className="mt-2 text-indigo-200">Для профессионалов</p>
              <p className="mt-6 text-4xl font-bold">990 ₽/мес</p>
              <ul className="mt-8 space-y-3 text-indigo-100">
                <li>✓ Все источники заявок</li>
                <li>✓ Без лимита заявок</li>
                <li>✓ Telegram-уведомления</li>
                <li>✓ AI-анализ каждой заявки</li>
                <li>✓ Генерация 4 типов откликов</li>
                <li>✓ Аналитика и воронка</li>
              </ul>
              <Link
                href="/dashboard"
                className="mt-8 block rounded-xl bg-white px-6 py-3 text-center font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                Попробовать
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-12">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-lg font-semibold text-white">Konversus Leads AI</p>
          <p className="mt-2">Автоматический поиск и анализ заказов для веб-разработчиков и агентств</p>
          <p className="mt-6 text-sm">© 2025 Konversus. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
}
