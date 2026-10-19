"use client";
import Link from "next/link";
import { Phone, Mail, Send, ExternalLink } from "lucide-react";
import { ABOUT_URL, CONTACT_TELEGRAM, PRODUCTS } from "@/config/products";

const ABOUT = [
  { name: "Обо мне", href: ABOUT_URL, ext: true },
  { name: "Портфолио", href: `${ABOUT_URL}#portfolio`, ext: true },
  { name: "Документация", href: "/docs", ext: false },
];

export default function KonversusFooter() {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "60px 0 32px", background: "rgba(9,9,11,0.6)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40, flexWrap: "wrap" }} className="footer-grid">

          {/* Бренд */}
          <div>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", fontWeight: 700, fontSize: "1.1rem", color: "#fafafa", marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, #22c55e, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>K</div>
              Konversus
            </Link>
            <p style={{ color: "#71717a", fontSize: "0.8rem", lineHeight: 1.7, maxWidth: 280 }}>
              Хаб сервисов для бизнеса: проверка сайта перед рекламой, заявки, чат на сайте и быстрые прототипы.
            </p>
          </div>

          {/* Продукты */}
          <div>
            <h4 style={{ fontWeight: 600, color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>Продукты</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PRODUCTS.filter((p) => p.href).map((p) => (
                <a key={p.id} href={p.href!} target={p.external ? "_blank" : undefined} rel={p.external ? "noopener" : undefined}
                  style={{ color: "#71717a", fontSize: "0.85rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, transition: "color 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#71717a")}
                >
                  {p.name}{p.external && <ExternalLink size={10} />}
                </a>
              ))}
            </div>
          </div>

          {/* О проекте */}
          <div>
            <h4 style={{ fontWeight: 600, color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>О проекте</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ABOUT.map((a) => (
                <a key={a.href} href={a.href} target={a.ext ? "_blank" : undefined} rel={a.ext ? "noopener" : undefined}
                  style={{ color: "#71717a", fontSize: "0.85rem", textDecoration: "none", transition: "color 0.15s" }}
                >
                  {a.name}
                </a>
              ))}
            </div>
          </div>

          {/* Контакты */}
          <div>
            <h4 style={{ fontWeight: 600, color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>Контакты</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a href={CONTACT_TELEGRAM} target="_blank" rel="noopener" style={{ color: "#71717a", fontSize: "0.85rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#71717a")}
              >
                <Send size={14} />
                @bilarius
              </a>
              <a href="mailto:bilariuss@yandex.ru" style={{ color: "#71717a", fontSize: "0.85rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#71717a")}
              >
                <Mail size={14} />
                bilariuss@yandex.ru
              </a>
              <a href="tel:+79212013252" style={{ color: "#71717a", fontSize: "0.85rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#71717a")}
              >
                <Phone size={14} />
                +7 921 201-32-52
              </a>
            </div>
          </div>
        </div>

        {/* Нижняя строка */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 40, paddingTop: 20, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#52525b", fontSize: "0.75rem" }}>© {new Date().getFullYear()} Тимофеев Алексей · ИНН 532002912418</span>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="https://vk.com/bilarius" target="_blank" style={{ color: "#52525b", fontSize: "0.75rem", textDecoration: "none" }}>VK</a>
            <a href={CONTACT_TELEGRAM} target="_blank" style={{ color: "#52525b", fontSize: "0.75rem", textDecoration: "none" }}>Telegram</a>
            <a href="https://www.behance.net/timofeev_aleksey" target="_blank" style={{ color: "#52525b", fontSize: "0.75rem", textDecoration: "none" }}>Behance</a>
          </div>
        </div>

      </div>

      <style>{`
        @media (max-width: 768px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
        }
        @media (max-width: 480px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  );
}
