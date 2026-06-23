"use client";

import { useEffect, useState } from "react";

const SAMPLE_LEADS = [
  { title: "Разработка интернет-магазина на React", budget: "150 000 ₽", platform: "Profi.ru" },
  { title: "SEO-продвижение сайта услуг", budget: "45 000 ₽", platform: "Profi.ru" },
  { title: "Дизайн лендинга для клиники", budget: "80 000 ₽", platform: "Profi.ru" },
  { title: "Телеграм-бот для доставки", budget: "60 000 ₽", platform: "Profi.ru" },
  { title: "Верстка 10 страниц на Next.js", budget: "95 000 ₽", platform: "Profi.ru" },
  { title: "Инфографика для Wildberries", budget: "25 000 ₽", platform: "Profi.ru" },
  { title: "Фирменный стиль + логотип", budget: "55 000 ₽", platform: "Profi.ru" },
  { title: "Аудит сайта и исправление ошибок", budget: "35 000 ₽", platform: "Profi.ru" },
];

export default function LeadFeedAnimation() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset(prev => (prev + 1) % (SAMPLE_LEADS.length * 90));
    }, 40); // ~25 fps — плавное движение

    return () => clearInterval(interval);
  }, []);

  // Create a long list of repeated leads for seamless scrolling
  const repeatedLeads = [...SAMPLE_LEADS, ...SAMPLE_LEADS, ...SAMPLE_LEADS];
  const cardHeight = 90; // высота каждой карточки в px

  return (
    <div style={{
      width: "100%", maxWidth: 380, height: 380,
      overflow: "hidden", position: "relative",
      maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
      WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
    }}>
      <div style={{
        display: "flex", flexDirection: "column",
        transform: `translateY(-${offset}px)`,
        transition: "none",
      }}>
        {repeatedLeads.map((lead, i) => (
          <div
            key={i}
            style={{
              height: cardHeight,
              padding: "12px 16px",
              flexShrink: 0,
              display: "flex", flexDirection: "column", justifyContent: "center",
              borderBottom: "1px solid var(--border)",
              background: i % 2 === 0 ? "transparent" : "var(--bg-surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "var(--green)",
                }} />
                <span style={{ fontSize: "0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                  {lead.platform}
                </span>
              </div>
            </div>
            <p style={{
              fontSize: "var(--text-sm)", fontWeight: 600,
              color: "var(--ink-heading)", lineHeight: 1.2,
              marginBottom: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {lead.title}
            </p>
            <p style={{
              fontSize: "0.75rem", fontWeight: 700,
              color: "var(--accent)",
            }}>
              {lead.budget}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
