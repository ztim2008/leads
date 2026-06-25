import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Стабильные server actions (Next.js 14+)
  serverExternalPackages: ["playwright", "bcryptjs"],

  // Логирование для отладки
  logging: {
    fetches: { fullUrl: false },
  },
};

export default nextConfig;
