"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

type Profile = {
  specialization: string;
  about: string;
  directions: string[];
  skills: string[];
  formats: string[];
  exclusions: string[];
  searchQueries: string[];
  tildaQueries: string[];
  aiQueries: string[];
  webQueries: string[];
};

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [specialization, setSpecialization] = useState(profile.specialization);
  const [about, setAbout] = useState(profile.about);
  const [directions, setDirections] = useState(profile.directions.join("\n"));
  const [skills, setSkills] = useState(profile.skills.join("\n"));
  const [formats, setFormats] = useState(profile.formats.join("\n"));
  const [exclusions, setExclusions] = useState(profile.exclusions.join("\n"));
  const [searchQueries, setSearchQueries] = useState(profile.searchQueries.join("\n"));
  const [tildaQueries, setTildaQueries] = useState(profile.tildaQueries.join("\n"));
  const [aiQueries, setAiQueries] = useState(profile.aiQueries.join("\n"));
  const [webQueries, setWebQueries] = useState(profile.webQueries.join("\n"));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    const res = await fetch("/api/radar/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        specialization,
        about,
        directions,
        skills,
        formats,
        exclusions,
        searchQueries,
        tildaQueries,
        aiQueries,
        webQueries,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) setError(data.error || "Не сохранилось");
    else setMessage("Профиль сохранён. Следующий обход возьмёт его.");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      style={{ display: "grid", gap: 16, maxWidth: 640 }}
    >
      <Field label="Специализация">
        <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Опыт" hint="Эти факты попадают в оценку и в черновик отклика">
        <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={6} style={inputStyle} />
      </Field>
      <Field label="Направления" hint="Каждое с новой строки">
        <textarea value={directions} onChange={(e) => setDirections(e.target.value)} rows={6} style={inputStyle} />
      </Field>
      <Field label="Навыки">
        <textarea value={skills} onChange={(e) => setSkills(e.target.value)} rows={4} style={inputStyle} />
      </Field>
      <Field label="Формат">
        <textarea value={formats} onChange={(e) => setFormats(e.target.value)} rows={3} style={inputStyle} />
      </Field>
      <Field label="Не интересно" hint="Эти слова в заголовке отсекаются до оценки">
        <textarea value={exclusions} onChange={(e) => setExclusions(e.target.value)} rows={4} style={inputStyle} />
      </Field>
      <Field label="Карточки" hint="Поиск по заголовку. Менеджер маркетплейса не проходит.">
        <textarea value={searchQueries} onChange={(e) => setSearchQueries(e.target.value)} rows={4} style={inputStyle} />
      </Field>
      <Field label="Сайты, сисадмин и ИИ" hint="Создание и поддержка сайтов, системный администратор, ИИ-технологии. Удалёнка по всей России.">
        <textarea value={webQueries} onChange={(e) => setWebQueries(e.target.value)} rows={4} style={inputStyle} />
      </Field>
      <Field label="Тильда" hint="В заголовке нужны Tilda или Тильда и роль: разработчик, дизайнер, верстальщик.">
        <textarea value={tildaQueries} onChange={(e) => setTildaQueries(e.target.value)} rows={3} style={inputStyle} />
      </Field>
      <Field label="ИИ" hint="AI-дизайнер и AI-креатор. Видео и монтаж не проходят.">
        <textarea value={aiQueries} onChange={(e) => setAiQueries(e.target.value)} rows={4} style={inputStyle} />
      </Field>
      {error && <p style={{ color: "var(--red)", fontSize: "var(--text-sm)", margin: 0 }}>{error}</p>}
      {message && <p style={{ color: "var(--green)", fontSize: "var(--text-sm)", margin: 0 }}>{message}</p>}
      <button type="submit" disabled={saving} style={buttonStyle}>
        {saving ? "Сохраняю…" : "Сохранить профиль"}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: "var(--text-sm)", fontWeight: 650, color: "var(--ink-heading)" }}>{label}</span>
      {hint && <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{hint}</span>}
      {children}
    </label>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg-surface)",
  color: "var(--ink-body)",
  padding: "10px 12px",
  font: "inherit",
  fontSize: "var(--text-sm)",
};

const buttonStyle: CSSProperties = {
  justifySelf: "start",
  background: "var(--accent)",
  color: "#fff",
  border: 0,
  borderRadius: "var(--radius-sm)",
  padding: "10px 16px",
  fontWeight: 650,
  cursor: "pointer",
};
