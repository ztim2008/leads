import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Стабильные server actions (Next.js 14+)
  serverExternalPackages: ["playwright", "bcryptjs", "pdfkit"],

  // «Показ» — статика из public/pokaz (npm run pokaz:sync)
  async rewrites() {
    return [{ source: "/pokaz", destination: "/pokaz/index.html" }];
  },

  // Логирование для отладки
  logging: {
    fetches: { fullUrl: false },
  },
};

export default nextConfig;
