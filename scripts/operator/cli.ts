/**
 * Оператор CLI — подключение и проверка партнёров (для админа и Cursor-агентов)
 *
 * npm run operator:parse -- --paste
 * npm run operator:onboard -- --email ... --password ... --profiLogin ... --profiPassword ...
 * npm run operator:verify -- partner@email.ru
 */

import { readFileSync } from "fs";
import {
  parsePartnerPaste,
  validatePartnerInput,
  mergeCliArgs,
  hasErrors,
  printIssues,
} from "./parse";
import { onboardPartner } from "./onboard";
import { verifyPartner, printChecks } from "./verify";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else if (key === "paste" || key === "dry") {
        out[key] = "true";
      }
    } else if (!out._email && a.includes("@")) {
      out.email = a;
    }
  }
  return out;
}

async function readPaste(): Promise<string> {
  return readFileSync(0, "utf8");
}

async function cmdParse(args: Record<string, string>) {
  let text = "";
  let data: Partial<import("./types").PartnerInput> = {};

  if (args.file) {
    text = readFileSync(args.file, "utf8");
    data = parsePartnerPaste(text).data;
  } else if (args.paste) {
    text = await readPaste();
    data = parsePartnerPaste(text).data;
  }

  const merged = mergeCliArgs(data, args);
  const parseIssues = text ? parsePartnerPaste(text).issues : [];
  const valIssues = validatePartnerInput(merged);
  const all = [...parseIssues, ...valIssues];

  if (!args.file && !args.paste && !merged.email) {
    console.error("Укажите --paste, --file или аргументы --email …");
    process.exit(1);
  }

  console.log("\n📋 Распознанные поля:");
  console.log(
    JSON.stringify(
      {
        ...merged,
        password: merged.password ? "[set]" : "",
        profiPassword: merged.profiPassword ? "[set]" : "",
      },
      null,
      2,
    ),
  );

  if (all.length) {
    console.log("\n🔍 Валидация:");
    printIssues(all);
  }

  process.exit(hasErrors(all) ? 1 : 0);
}

async function cmdOnboard(args: Record<string, string>) {
  let data: Partial<import("./types").PartnerInput> = {};

  if (args.file) {
    const text = readFileSync(args.file, "utf8");
    data = parsePartnerPaste(text).data;
  } else if (args.paste) {
    data = parsePartnerPaste(await readPaste()).data;
  }

  const input = mergeCliArgs(data, args);
  const issues = validatePartnerInput(input);

  if (issues.length) {
    console.log("🔍 Валидация перед созданием:");
    printIssues(issues);
  }

  if (hasErrors(issues)) {
    console.error("\n❌ Исправьте ошибки и повторите.");
    process.exit(1);
  }

  if (args.dry === "true") {
    console.log("\n🟡 dry-run — партнёр НЕ создан");
    console.log(JSON.stringify(input, null, 2));
    process.exit(0);
  }

  const result = await onboardPartner(input);
  if (!result.ok) {
    console.error("❌", result.error);
    process.exit(1);
  }

  console.log("\n✅ Партнёр создан");
  console.log(`   Email:    ${result.email}`);
  console.log(`   Пароль:   ${result.partnerPassword}`);
  console.log(`   Workspace: ${result.workspaceId}`);
  console.log(`   Source:   ${result.sourceId}`);
  if (result.accessCard) {
    console.log(`   Profi:    ${result.accessCard.profiLogin}`);
    console.log(`   TG chat:  ${result.accessCard.telegramChatId || "—"}`);
    console.log(`   Лимит:    ${result.accessCard.leadsPerMonth}`);
  }
  console.log(`\n🚀 VPS install:\n   ${result.setupCommand}`);
  if (input.vpsIp) {
    console.log(`\n📡 SSH: ssh root@${input.vpsIp}`);
  }
  console.log("\n▶ Проверка: npm run operator:verify --", result.email);
}

async function cmdVerify(args: Record<string, string>) {
  const email = args.email || args._email;
  if (!email) {
    console.error("Укажите email: npm run operator:verify -- partner@email.ru");
    process.exit(1);
  }

  console.log(`\n🔎 Проверка партнёра: ${email}\n`);
  const { ok, checks } = await verifyPartner(email);
  printChecks(checks);
  console.log(ok ? "\n✅ Критичные проверки пройдены" : "\n⚠️ Есть проблемы — см. выше");
  process.exit(ok ? 0 : 1);
}

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

(async () => {
  switch (cmd) {
    case "parse":
      await cmdParse(args);
      break;
    case "onboard":
      await cmdOnboard(args);
      break;
    case "verify":
      await cmdVerify(args);
      break;
    default:
      console.log(`
Leads AI — оператор CLI

  npm run operator:parse -- --paste          # вставить блок, только парсинг
  npm run operator:onboard -- --paste        # из буфера → создать
  npm run operator:onboard -- --dry --paste  # dry-run
  npm run operator:onboard -- --email x@y.ru --password secret --profiLogin L --profiPassword P --leadsPerMonth 500 --vpsIp 1.2.3.4
  npm run operator:verify -- partner@email.ru

См. docs/OPERATOR_AGENT.md
`);
      process.exit(cmd ? 1 : 0);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
