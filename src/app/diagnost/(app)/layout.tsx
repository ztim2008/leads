import Link from "next/link";
import { Gauge } from "lucide-react";

export default function DiagnostAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark dg">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 md:px-8">
        <Link href="/diagnost" className="flex items-center gap-3" style={{ color: "var(--dg-ink)" }}>
          <span className="dg-tile flex h-10 w-10 items-center justify-center" style={{ color: "var(--dg-accent)" }}>
            <Gauge size={20} strokeWidth={2} />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold">Техосмотр сайта</span>
            <span className="block text-xs" style={{ color: "var(--dg-muted)" }}>
              Аудит перед рекламой
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/diagnost#history" className="rounded-lg px-3 py-2" style={{ color: "var(--dg-body)" }}>
            Мои аудиты
          </Link>
          <Link href="/diagnost#method" className="rounded-lg px-3 py-2" style={{ color: "var(--dg-body)" }}>
            Методика
          </Link>
        </nav>
      </header>
      {children}
      <footer className="mx-auto mt-24 flex max-w-[1240px] flex-wrap items-center justify-between gap-3 border-t px-5 py-8 text-xs md:px-8" style={{ borderColor: "var(--dg-line)", color: "var(--dg-muted)" }}>
        <span>Техосмотр сайта — сервис Konversus для директологов и агентств</span>
        <a href="https://leads.konversus.ru" style={{ color: "var(--dg-muted)" }}>
          leads.konversus.ru
        </a>
      </footer>
    </div>
  );
}
