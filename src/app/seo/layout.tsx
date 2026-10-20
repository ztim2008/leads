import type { Metadata } from "next";
import "./seo.css";

export const metadata: Metadata = {
  title: "Что такое SEO простыми словами — как сайт попадает в Яндекс | Konversus",
  description:
    "Объясняем без технических слов: как Яндекс выбирает сайты, сколько ждать результата, какие есть этапы и методы продвижения и что на самом деле можно гарантировать.",
};

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
