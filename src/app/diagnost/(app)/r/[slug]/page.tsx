import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AuditView from "@/components/diagnost/audit-view";
import { getAuditView } from "@/lib/diagnost/data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const view = await getAuditView(slug);
  return {
    title: view ? `Техосмотр ${view.host}${view.result ? ` — готовность к рекламе ${view.result.scores.adReadiness}%` : ""}` : "Аудит не найден",
    robots: { index: false, follow: false },
  };
}

export default async function AuditPage({ params }: Props) {
  const { slug } = await params;
  const view = await getAuditView(slug);
  if (!view) notFound();
  return <AuditView initial={view} />;
}
