"use client";

import { useState, useEffect } from "react";

const SAMPLE_LEADS = [
  { title: "Разработка интернет-магазина на React", budget: "150 000 ₽", platform: "Profi.ru", time: "только что" },
  { title: "SEO-продвижение сайта услуг", budget: "45 000 ₽", platform: "Profi.ru", time: "2 мин назад" },
  { title: "Дизайн лендинга для клиники", budget: "80 000 ₽", platform: "Profi.ru", time: "5 мин назад" },
  { title: "Телеграм-бот для доставки", budget: "60 000 ₽", platform: "Profi.ru", time: "8 мин назад" },
  { title: "Верстка 10 страниц на Next.js", budget: "95 000 ₽", platform: "Profi.ru", time: "12 мин назад" },
  { title: "Инфографика для Wildberries", budget: "25 000 ₽", platform: "Profi.ru", time: "15 мин назад" },
  { title: "Фирменный стиль + логотип", budget: "55 000 ₽", platform: "Profi.ru", time: "18 мин назад" },
  { title: "Аудит сайта и исправление ошибок", budget: "35 000 ₽", platform: "Profi.ru", time: "22 мин назад" },
];

interface AnimatedLead {
  id: number;
  title: string;
  budget: string;
  platform: string;
  time: string;
  entering: boolean;
}

export default function LeadFeedAnimation() {
  const [leads, setLeads] = useState<AnimatedLead[]>([]);
  const [nextId, setNextId] = useState(0);

  useEffect(() => {
    // Add a new lead every 2.5-4 seconds
    const addLead = () => {
      const sample = SAMPLE_LEADS[nextId % SAMPLE_LEADS.length];
      const newLead: AnimatedLead = {
        id: nextId,
        title: sample.title,
        budget: sample.budget,
        platform: sample.platform,
        time: "только что",
        entering: true,
      };
      
      setLeads(prev => {
        // Update times of existing leads
        const updated = prev.map(l => ({
          ...l,
          time: l.time === "только что" ? "30 сек назад" :
                l.time === "30 сек назад" ? "1 мин назад" :
                l.time === "1 мин назад" ? "2 мин назад" :
                l.time === "2 мин назад" ? "5 мин назад" : l.time,
        }));
        // Keep max 5 visible
        const trimmed = updated.length >= 5 ? updated.slice(0, 4) : updated;
        return [newLead, ...trimmed];
      });

      setNextId(id => {
        // Remove entering animation after 500ms
        setTimeout(() => {
          setLeads(prev => prev.map(l => l.id === id ? { ...l, entering: false } : l));
        }, 600);
        return id + 1;
      });
    };

    // First lead after 1 second
    const initial = setTimeout(addLead, 1000);
    // Then every 3-5 seconds
    const interval = setInterval(() => {
      addLead();
    }, 3000 + Math.random() * 2000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  if (leads.length === 0) return null;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 8,
      width: "100%", maxWidth: 380,
    }}>
      {leads.map((lead) => (
        <div
          key={lead.id}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
            display: "flex", flexDirection: "column", gap: 6,
            animation: lead.entering
              ? "slideIn 0.5s ease-out"
              : "none",
            opacity: lead.entering ? 0 : 1,
            transform: lead.entering ? "translateX(40px)" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: lead.entering ? "var(--accent)" : "var(--green)",
                boxShadow: lead.entering ? "0 0 8px var(--accent)" : "none",
                transition: "all 0.5s ease",
              }} />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontWeight: 500 }}>
                {lead.platform}
              </span>
            </div>
            <span style={{ fontSize: "0.6rem", color: "var(--ink-muted)" }}>
              {lead.time}
            </span>
          </div>
          <p style={{
            fontSize: "var(--text-sm)", fontWeight: 600,
            color: "var(--ink-heading)", lineHeight: 1.3,
          }}>
            {lead.title}
          </p>
          <p style={{
            fontSize: "var(--text-sm)", fontWeight: 700,
            color: "var(--accent)",
          }}>
            {lead.budget}
          </p>
        </div>
      ))}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
