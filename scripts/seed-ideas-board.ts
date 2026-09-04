/**
 * Сид трёх идей Ideas Board + анализ агента.
 * Запуск: npx tsx scripts/seed-ideas-board.ts
 */
import { PrismaClient } from "@prisma/client";
import { runIdeaAnalysis } from "../src/lib/ideas/analyze";

const db = new PrismaClient();

const IDEAS = [
  {
    title: "ИИ-каталог шаблонов (стройка)",
    tags: ["шаблоны", "директ", "стройка"],
    body: `Создать каталог AI/готовых шаблонов сайтов для клиентов из строительной и смежных ниш — по образцу витрины https://landing.compmaster.site/: фильтры по услуге, карточки шаблонов с калькуляторами, мгновенный старт.

Цель:
- быстрый запуск лендинга под нишу (кузовной, стяжка, электрика, кухни и т.п.);
- проверка гипотез в Яндекс Директе без долгой кастомной разработки;
- входной продукт в экосистему Konversus с апселлом лидов и доработок.

Контекст референса LandingCompMaster: десятки готовых шаблонов (~1 000 ₽), калькуляторы сметы, формы заявок, редактор без тяжёлой CMS, нишевые категории (автосервис, ремонт, мебель).

Вопросы к разбору: unit-экономика каталога vs кастом, риски копирования, как стыковать с Директом и Leads AI.`,
    extraContext:
      "Референс landing.compmaster.site: витрина «готовые шаблоны сайтов», ~37 шаблонов, запуск за 1 день, ниши стройка/услуги с калькуляторами, цена порядка 1000 ₽, фильтры и сортировки.",
  },
  {
    title: "Контент-ферма",
    tags: ["контент", "seo", "wordstat"],
    body: `Контент-ферма для клиентов на их собственных сайтах: генерация и публикация SEO-страниц под спрос Wordstat с разбивкой по городу, району, услуге и коммерческим интентам.

Цель:
- органический поток заявок в дополнение к Директу;
- масштабируемый recurring-продукт (пакеты страниц / месяц);
- усиление уже сделанных нами сайтов.

Ограничения: качество vs «thin content», ожидания клиента по срокам SEO, операционка публикации и индексации.

Нужен разбор: за/против, риски фильтров поиска, пилот и метрики go/no-go.`,
  },
  {
    title: "Скан сайта → оффер улучшения",
    tags: ["лидоген", "скан", "оффер"],
    body: `Лидогенерация через скан сайтов потенциальных клиентов: находим слабые места (мобилка, скорость, формы, оффер, SEO, доверие) и предлагаем конкретное платное улучшение.

Цель:
- персонализированный холодный оффер вместо массовой рассылки;
- вход в проекты по сайтам/шаблонам с дальнейшим подключением к Konversus Leads;
- позже — полуавтомат (чеклист → краулер → скоринг → письмо).

Старт с ручного пилота в одной нише. Разложить на сильные/слабые стороны, риски спама и ложных срабатываний, следующие шаги.`,
  },
];

async function main() {
  const author =
    (await db.user.findFirst({ where: { email: "bilariuss@yandex.ru" } })) ||
    (await db.user.findFirst({ where: { role: "admin" }, orderBy: { createdAt: "asc" } }));

  if (!author) {
    throw new Error("Не найден admin / bilariuss@yandex.ru");
  }

  console.log("Author:", author.email, author.id);

  const created: Array<{ id: string; title: string; source?: string }> = [];

  for (const item of IDEAS) {
    const existing = await db.idea.findFirst({
      where: { title: item.title },
    });
    if (existing) {
      console.log("Exists, re-analyze:", existing.id, existing.title);
      const { analysis } = await runIdeaAnalysis(existing.id, {
        force: true,
        extraContext: item.extraContext,
      });
      created.push({ id: existing.id, title: existing.title, source: analysis.source });
      continue;
    }

    const idea = await db.idea.create({
      data: {
        title: item.title,
        body: item.body,
        tags: item.tags,
        status: "draft",
        createdById: author.id,
      },
    });
    console.log("Created:", idea.id, idea.title);

    const { analysis } = await runIdeaAnalysis(idea.id, {
      force: true,
      extraContext: item.extraContext,
    });
    created.push({ id: idea.id, title: idea.title, source: analysis.source });
    console.log("  analysis source:", analysis.source, analysis.error || "ok");
  }

  console.log("\n=== RESULT ===");
  for (const c of created) {
    console.log(`- ${c.title}`);
    console.log(`  /dashboard/ideas/${c.id}`);
    console.log(`  source: ${c.source}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
