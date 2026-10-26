import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api/", "/auth", "/diagnost/r/", "/rentgen/r/"],
    },
    sitemap: "https://leads.konversus.ru/sitemap.xml",
    host: "https://leads.konversus.ru",
  };
}
