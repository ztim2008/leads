import type { Metadata } from "next";
import "./seo.css";

const TITLE = "Что такое SEO простыми словами — как сайт попадает в Яндекс и сколько стоит продвижение";
const DESCRIPTION =
  "Объясняем без технических слов: как Яндекс выбирает сайты, сколько ждать результата, белое и чёрное SEO, что можно гарантировать. Калькулятор стоимости продвижения и бесплатный разбор.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://leads.konversus.ru/seo" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://leads.konversus.ru/seo",
    siteName: "Konversus",
    locale: "ru_RU",
    type: "article",
  },
};

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
