import type { Metadata } from "next";
import YandexMetrika from "@/components/yandex-metrika";
import { Inter, JetBrains_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import KonversusNav from "@/components/konversus-nav";
import KonversusFooter from "@/components/konversus-footer";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Konversus — сервисы для бизнеса: аудит сайта, проверка кнопок, заявки",
  description: "Хаб инструментов Konversus: проверка сайта перед рекламой, поиск неработающих кнопок и ссылок, заявки из Profi в Telegram, чат на сайте и быстрый прототип.",
  metadataBase: new URL("https://leads.konversus.ru"),
  verification: { yandex: "f9c5fd333ceeca7f" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning className="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const theme = localStorage.getItem('theme');
            const isDark = theme !== 'light';
            document.documentElement.classList.toggle('dark', isDark);
            if (!theme) localStorage.setItem('theme', 'dark');
          } catch(e) {}
        `}} />
      </head>
      <body className={`${inter.variable} ${montserrat.variable} ${jetbrains.variable} antialiased`}
        style={{ fontFamily: "var(--font-sans)" }}>
        {children}
        <YandexMetrika />
      </body>
    </html>
  );
}
