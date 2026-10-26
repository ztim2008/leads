import type { Metadata } from "next";
import Link from "next/link";
import { ScanLine } from "lucide-react";
import KonversusNav from "@/components/konversus-nav";
import KonversusFooter from "@/components/konversus-footer";
import "./rentgen.css";

export const metadata: Metadata = {
  title: "Рентген сайта — какие кнопки и ссылки не работают",
  description:
    "Бесплатная проверка сайта по ссылке: открываем страницу на ПК и телефоне, нажимаем каждую кнопку и ссылку и показываем на снимке, что работает, что ведёт в пустоту и что слишком мелко для пальца.",
};

export default function RentgenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark rg">
      <KonversusNav />
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 pb-2 pt-[76px] md:px-8">
        <Link href="/rentgen" className="flex items-center gap-3" style={{ color: "var(--rg-ink)" }}>
          <span className="rg-panel flex h-10 w-10 items-center justify-center" style={{ borderRadius: 10 }}>
            <ScanLine size={20} strokeWidth={2} />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold">Рентген сайта</span>
            <span className="block text-xs" style={{ color: "var(--rg-muted)" }}>
              Клики на ПК и телефоне
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/rentgen#history" className="rounded-lg px-3 py-2" style={{ color: "var(--rg-body)" }}>
            Мои проверки
          </Link>
          <Link href="/rentgen#method" className="rounded-lg px-3 py-2" style={{ color: "var(--rg-body)" }}>
            Как проверяем
          </Link>
        </nav>
      </div>
      {children}
      <div className="mt-24">
        <KonversusFooter />
      </div>
    </div>
  );
}
