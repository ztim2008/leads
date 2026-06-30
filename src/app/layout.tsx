import Script from "next/script";
import type { Metadata } from "next";
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
  title: "Konversus Leads AI — Умный поиск заказов",
  description: "Автоматический мониторинг заказов с Profi.ru. AI-анализ, Telegram-уведомления и готовые отклики.",
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
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r)return}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(109448101,"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});`}
        </Script>
      </body>
    </html>
  );
}
