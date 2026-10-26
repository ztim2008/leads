import type { MetadataRoute } from "next";

const BASE = "https://leads.konversus.ru";

const PAGES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/seo", priority: 0.9, changeFrequency: "monthly" },
  { path: "/diagnost", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pokaz", priority: 0.8, changeFrequency: "monthly" },
  { path: "/rentgen", priority: 0.8, changeFrequency: "monthly" },
  { path: "/lovec", priority: 0.7, changeFrequency: "monthly" },
  { path: "/docs", priority: 0.4, changeFrequency: "monthly" },
  { path: "/contacts", priority: 0.3, changeFrequency: "yearly" },
  { path: "/oferta", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/refund", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.map((p) => ({ url: `${BASE}${p.path}`, lastModified, changeFrequency: p.changeFrequency, priority: p.priority }));
}
