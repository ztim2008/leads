import { profiConnector } from "../src/lib/connectors/profi";

async function main() {
  console.log("🚀 Тест коннектора Profi...\n");

  const leads = await profiConnector.fetchLeads({
    login: "TimofeyevAG11",
    password: "Bilariuss111111",
    keywords: "",
  });

  console.log(`\n📊 Всего заявок: ${leads.length}\n`);

  for (const lead of leads.slice(0, 10)) {
    console.log("───");
    console.log("🔗", lead.url);
    console.log("📝", lead.title);
    if (lead.budgetMin) console.log("💰", lead.budgetMin, "₽");
    console.log("📄", lead.description?.slice(0, 150));
  }

  process.exit(0);
}
main();
