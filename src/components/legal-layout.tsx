import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function LegalNav() {
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: "var(--bg-surface)", borderBottom: "1px solid var(--border)",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
        {/* Логотип */}
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "1.1rem", color: "#fafafa", textDecoration: "none", letterSpacing: "-0.02em" }}>
          <div style={{ width: 30, height: 30, borderRadius: 6, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, flexShrink: 0 }}>◈</div>
          <span className="nav-logo-text" style={{ display: "inline" }}>Leads AI</span>
        </a>

        {/* Десктоп */}
        <div className="nav-desktop" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/#how" style={{ padding: "6px 10px", borderRadius: 6, fontSize: "0.85rem", color: "var(--ink-muted)", textDecoration: "none", fontWeight: 500 }}>Как работает</a>
          <a href="/docs" style={{ padding: "6px 10px", borderRadius: 6, fontSize: "0.85rem", color: "var(--ink-muted)", textDecoration: "none", fontWeight: 500 }}>Документация</a>
          <a href="https://konversus.ru" style={{ fontSize: "0.8rem", color: "var(--ink-muted)", textDecoration: "none", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
            <ArrowUpRight size={12} /> konversus.ru
          </a>
          <a href="/auth" style={{ padding: "8px 16px", borderRadius: 6, background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none" }}>Войти</a>
        </div>

        {/* Мобильная кнопка */}
        <input type="checkbox" id="mobile-menu-toggle" style={{ display: "none" }} />
        <label htmlFor="mobile-menu-toggle" className="nav-mobile-btn" style={{
          display: "none", background: "none", border: "1px solid var(--border)",
          borderRadius: 6, padding: "6px 10px", color: "var(--ink-body)", cursor: "pointer",
          fontSize: "1.3rem", position: "absolute", right: 20, top: 12,
        }}>☰</label>
        <div id="mobile-menu" style={{ display: "none", flexDirection: "column", gap: 4, padding: "12px 20px 16px", background: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}>
          <a href="/#how" style={{ padding: "8px 0", color: "var(--ink-body)", textDecoration: "none", fontSize: "0.9rem" }}>Как работает</a>
          <a href="/docs" style={{ padding: "8px 0", color: "var(--ink-body)", textDecoration: "none", fontSize: "0.9rem" }}>Документация</a>
          <a href="https://konversus.ru" style={{ padding: "8px 0", color: "var(--ink-body)", textDecoration: "none", fontSize: "0.9rem" }}>← konversus.ru</a>
          <a href="/auth" style={{ padding: "8px 0", color: "var(--accent)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>Войти</a>
        </div>
        <style>{`
          @media (max-width: 768px) { .nav-desktop { display: none !important; } .nav-mobile-btn { display: flex !important; } }
          #mobile-menu-toggle:checked ~ #mobile-menu { display: flex !important; }
        `}</style>
      </div>
    </nav>
  );
}

export function LegalFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", padding: "40px 0 24px", marginTop: 60 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px" }}>

        {/* Верхняя часть футера */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between", marginBottom: 32 }}>
          {/* Колонка 1 — бренд */}
          <div style={{ minWidth: 200 }}>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "1rem", color: "#fafafa", textDecoration: "none", marginBottom: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 4, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>◈</div>
              Leads AI
            </a>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem", lineHeight: 1.6, maxWidth: 280 }}>
              Сервис в экосистеме <a href="https://konversus.ru" style={{ color: "var(--accent)", textDecoration: "none" }}>Konversus</a> — умные инструменты для роста вашего бизнеса.
            </p>
          </div>

          {/* Колонка 2 — сервис */}
          <div>
            <p style={{ fontWeight: 600, color: "var(--ink-body)", fontSize: "0.8rem", marginBottom: 10 }}>Сервис</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <a href="/#how" style={footerLink}>Как работает</a>
              <a href="/#" style={footerLink}>Возможности</a>
              <a href="/docs" style={footerLink}>Документация</a>
              <a href="/dashboard/billing" style={footerLink}>Тарифы</a>
            </div>
          </div>

          {/* Колонка 3 — юр. инфо (ЮKassa) */}
          <div>
            <p style={{ fontWeight: 600, color: "var(--ink-body)", fontSize: "0.8rem", marginBottom: 10 }}>Юридическая информация</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <a href="/contacts" style={footerLink}>Контакты</a>
              <a href="/oferta" style={footerLink}>Оферта</a>
              <a href="/privacy" style={footerLink}>Политика конфиденциальности</a>
              <a href="/refund" style={footerLink}>Правила возврата</a>
            </div>
          </div>
        </div>

        {/* Нижняя строка */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}>© {new Date().getFullYear()} Тимофеев Алексей Геннадьевич · ИНН 532002912418</span>
          <div style={{ display: "flex", gap: 20 }}>
            <a href="https://konversus.ru" style={{ color: "var(--ink-muted)", fontSize: "0.75rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
              <ArrowUpRight size={10} /> konversus.ru
            </a>
            <a href="https://t.me/bilarius" style={{ color: "var(--ink-muted)", fontSize: "0.75rem", textDecoration: "none" }}>@bilarius</a>
          </div>
        </div>

      </div>
    </footer>
  );
}

const footerLink: React.CSSProperties = {
  color: "var(--ink-muted)", fontSize: "0.8rem", textDecoration: "none",
  padding: "2px 0", transition: "color 0.15s",
};
