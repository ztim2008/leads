"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X, ChevronDown, ExternalLink } from "lucide-react";
import { ABOUT_URL, CONTACT_TELEGRAM, PRODUCTS, STATUS_LABELS, type Product } from "@/config/products";

function ProductBadge({ product }: { product: Product }) {
  if (product.status === "live") return null;
  const soon = product.status === "soon";
  return (
    <span style={{ fontSize: "0.65rem", padding: "1px 7px", borderRadius: 100, border: "1px solid var(--border)", color: soon ? "var(--ink-muted)" : "var(--green)", fontWeight: 600 }}>
      {STATUS_LABELS[product.status]}
    </span>
  );
}

export default function KonversusNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Закрываем мега-меню при клике вне
  useEffect(() => {
    if (!megaOpen) return;
    const handler = (e: MouseEvent) => {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) {
        setMegaOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [megaOpen]);

  return (
    <>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? "rgba(9,9,11,0.92)" : "rgba(9,9,11,0.7)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        transition: "all 0.3s ease",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          
          {/* Логотип */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", fontWeight: 700, fontSize: "1.15rem", color: "#fafafa", letterSpacing: "-0.02em" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #22c55e, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff" }}>
              K
            </div>
            <span className="nav-brand">Konversus</span>
          </Link>

          {/* Десктопное меню */}
          <div className="nav-desktop" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* Мега-меню: Продукты */}
            <div ref={megaRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMegaOpen(!megaOpen)}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "8px 14px", borderRadius: 8,
                  background: megaOpen ? "rgba(255,255,255,0.06)" : "transparent",
                  border: "none", color: megaOpen ? "#fafafa" : "#a1a1aa",
                  fontSize: "0.85rem", fontWeight: 500, cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Продукты
                <ChevronDown size={14} style={{ transform: megaOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />
              </button>

              {/* Выпадающая панель с продуктами */}
              {megaOpen && (
                <div style={{
                  position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
                  marginTop: 8, width: 680,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)", borderRadius: 16,
                  padding: "24px 28px",
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: "10px 24px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                  animation: "fadeIn 0.15s ease",
                }}>
                  {PRODUCTS.map((prod) => {
                    const inner = (
                      <>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-hover)", color: prod.status === "soon" ? "var(--ink-muted)" : "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <prod.icon size={18} strokeWidth={1.75} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: "0.85rem", color: prod.status === "soon" ? "var(--ink-muted)" : "var(--ink-heading)" }}>{prod.name}</span>
                            <ProductBadge product={prod} />
                          </div>
                          <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: 2, lineHeight: 1.4 }}>{prod.tagline}</p>
                        </div>
                      </>
                    );
                    const rowStyle: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 10, textDecoration: "none" };
                    if (!prod.href) return <div key={prod.id} style={{ ...rowStyle, cursor: "default" }} aria-disabled="true">{inner}</div>;
                    return (
                      <a
                        key={prod.id}
                        href={prod.href}
                        target={prod.external ? "_blank" : undefined}
                        rel={prod.external ? "noopener" : undefined}
                        onClick={() => setMegaOpen(false)}
                        style={{ ...rowStyle, transition: "background-color 0.15s ease" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {inner}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            <NavLink href={ABOUT_URL} external>Обо мне</NavLink>
            <NavLink href="/docs">Документация</NavLink>
            <NavLink href={CONTACT_TELEGRAM} external>Контакты</NavLink>
          </div>

          {/* Мобильная кнопка */}
          <button
            className="nav-mobile-btn"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              display: "none", background: "none", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "8px 10px", color: "#a1a1aa", cursor: "pointer",
            }}
            aria-label="Меню"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Мобильное меню */}
        {mobileOpen && (
          <div style={{
            padding: "8px 24px 20px", background: "rgba(9,9,11,0.98)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "none",
            animation: "fadeIn 0.15s ease",
          }} className="nav-mobile-menu">
            <MobileSection title="Продукты">
              {PRODUCTS.filter((prod) => prod.href).map((prod) => (
                <a
                  key={prod.id}
                  href={prod.href!}
                  target={prod.external ? "_blank" : undefined}
                  rel={prod.external ? "noopener" : undefined}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 0", textDecoration: "none",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <prod.icon size={16} style={{ color: "var(--green)" }} />
                  <span style={{ color: "var(--ink-body)", fontSize: "0.9rem" }}>{prod.name}</span>
                  <span style={{ marginLeft: "auto" }}><ProductBadge product={prod} /></span>
                </a>
              ))}
            </MobileSection>
            <MobileLink href={ABOUT_URL} onClick={() => setMobileOpen(false)} external>Обо мне</MobileLink>
            <MobileLink href="/docs" onClick={() => setMobileOpen(false)}>Документация</MobileLink>
            <MobileLink href={CONTACT_TELEGRAM} onClick={() => setMobileOpen(false)} external>Telegram @bilarius</MobileLink>
          </div>
        )}
      </nav>

      {/* Глобальные стили для навигации */}
      <style>{`
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-btn { display: flex !important; align-items: center; justify-content: center; }
          .nav-mobile-menu { display: block !important; }
          .nav-brand { font-size: 1rem !important; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

// Вспомогательные компоненты

function NavLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "8px 14px", borderRadius: 8,
        color: "#a1a1aa", fontSize: "0.85rem", fontWeight: 500,
        textDecoration: "none",
        transition: "color 0.15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#fafafa")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
    >
      {children}
      {external && <ExternalLink size={12} style={{ opacity: 0.5 }} />}
    </a>
  );
}

function MobileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ fontSize: "0.7rem", color: "#52525b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 600 }}>{title}</p>
      {children}
    </div>
  );
}

function MobileLink({ href, children, onClick, external }: { href: string; children: React.ReactNode; onClick?: () => void; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 0", textDecoration: "none",
        color: "#a1a1aa", fontSize: "0.9rem",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </a>
  );
}
