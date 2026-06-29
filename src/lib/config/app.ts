import { db } from "@/lib/db";
export async function getAppConfig() {
  let cfg = await db.appConfig.findUnique({ where: { id: "default" } });
  if (!cfg) cfg = await db.appConfig.create({ data: { id: "default", proPrice: 2900, proPriceCurrency: "RUB", trialDays: 0 } });
  return cfg;
}
export async function updateAppConfig(data: Record<string, any>) {
  return db.appConfig.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
}
