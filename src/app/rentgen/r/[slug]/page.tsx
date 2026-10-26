import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ScanView from "@/components/rentgen/scan-view";
import { getScanView } from "@/lib/rentgen/data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const view = await getScanView(slug);
  return {
    title: view ? `Рентген ${view.host}` : "Проверка не найдена",
    robots: { index: false, follow: false },
  };
}

export default async function ScanPage({ params }: Props) {
  const { slug } = await params;
  const view = await getScanView(slug);
  if (!view) notFound();
  return <ScanView initial={view} />;
}
