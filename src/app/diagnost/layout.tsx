import type { Metadata } from "next";
import "./diagnost.css";

export const metadata: Metadata = {
  title: "Техосмотр сайта перед рекламой — аудит готовности к трафику",
  description:
    "Проверьте, готов ли сайт принимать рекламный трафик: оценка конверсии, оффера, UX, SEO, скорости, доверия и аналитики. Спидометр готовности, план исправлений и PDF-отчёты.",
};

export default function DiagnostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
