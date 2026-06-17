// Скрипт создания первого пользователя
// Запуск: npx tsx scripts/seed.ts
import { db } from "../src/lib/db";
import { hash } from "bcryptjs";

async function seed() {
  const email = "bilariuss@yandex.ru";
  const password = "bilariuss111111";

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log("✅ Пользователь уже существует:", email);
    return;
  }

  const passwordHash = await hash(password, 12);

  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      firstName: "Алексей",
      role: "admin",
    },
  });

  // Создаём рабочее пространство
  const workspace = await db.workspace.create({
    data: {
      userId: user.id,
      name: "Моё пространство",
      slug: `ws-${user.id.slice(0, 8)}`,
    },
  });

  // Создаём настройки
  await db.settings.create({
    data: {
      workspaceId: workspace.id,
      keywords: "сайт, лендинг, nextjs, react, seo, telegram, ai, бот",
      minusKeywords: "wordpress, tilda, студент, курсовая",
      budgetMin: 30000,
      budgetMax: 500000,
      regions: "Россия, Казахстан, Удалённо",
    },
  });

  console.log("✅ Пользователь создан:", email);
  console.log("✅ Пространство:", workspace.name);
  console.log("✅ Настройки: ключевые слова, бюджет, регионы");
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
