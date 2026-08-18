"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PartnerFilters } from "@/lib/leads/partner-filters";

const inp: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--bg-root)",
  color: "var(--ink-body)",
  fontSize: "var(--text-sm)",
  boxSizing: "border-box",
};

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  color: "var(--ink-muted)",
  marginBottom: 6,
  fontWeight: 500,
};

export default function PartnerFiltersForm({
  workspaceId,
  initial,
}: {
  workspaceId: string;
  initial: PartnerFilters;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gender, setGender] = useState(initial.clientGender);
  const [showNoBudget, setShowNoBudget] = useState(initial.showNoBudget);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setToast(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          titleKeywords: fd.get("titleKeywords") || "",
          titleMinusKeywords: fd.get("titleMinusKeywords") || "",
          keywords: fd.get("keywords") || "",
          minusKeywords: fd.get("minusKeywords") || "",
          budgetMin: Number(fd.get("budgetMin") || 0),
          budgetMax: Number(fd.get("budgetMax") || 0),
          showNoBudget,
          workHoursStart: fd.get("workHoursStart") || "08:00",
          workHoursEnd: fd.get("workHoursEnd") || "22:00",
          clientGender: gender,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setToast(data.error || "Не удалось сохранить");
        return;
      }
      setToast("Сохранено. Новые заявки идут по этим фильтрам, без перезахода в Profi.");
      router.refresh();
    } catch {
      setToast("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 640 }}>
      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 20 }}>
        Меняется только отбор заявок на хабе. Сбор на VPS не рестартится и новый вход в Profi не делается.
        Склонения учитываются: «сайт» ловит сайты, сайтов, сайтами.
      </p>

      <Field title="Заголовок — плюс-слова" hint="Хотя бы одно слово должно быть в заголовке. Пусто — заголовок не фильтруем.">
        <input name="titleKeywords" defaultValue={initial.titleKeywords} placeholder="сайт, лендинг, тильда" style={inp} />
      </Field>

      <Field title="Заголовок — минус-слова" hint="Если слово есть в заголовке — заявка не придёт. Не смотрит текст, продублируйте ниже если нужно.">
        <input name="titleMinusKeywords" defaultValue={initial.titleMinusKeywords} placeholder="курсовая, студент, бесплатно" style={inp} />
      </Field>

      <Field title="Текст — плюс-слова" hint="Хотя бы одно слово должно быть в тексте заявки. Пусто — текст не фильтруем.">
        <input name="keywords" defaultValue={initial.keywords} placeholder="тильда, админка, каталог" style={inp} />
      </Field>

      <Field title="Текст — минус-слова" hint="Если слово есть в тексте — заявка не придёт. Не смотрит заголовок.">
        <input name="minusKeywords" defaultValue={initial.minusKeywords} placeholder="курсовая, диплом, бартер" style={inp} />
      </Field>

      <Field title="Часы сбора" hint="Только 08:00–22:00 МСК. Ночью робот спит.">
        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ flex: 1 }}>
            <span style={lbl}>С</span>
            <input name="workHoursStart" type="time" defaultValue={initial.workHoursStart} min="08:00" max="21:00" style={inp} />
          </label>
          <label style={{ flex: 1 }}>
            <span style={lbl}>До</span>
            <input name="workHoursEnd" type="time" defaultValue={initial.workHoursEnd} min="09:00" max="22:00" style={inp} />
          </label>
        </div>
      </Field>

      <Field title="Бюджет" hint="Вилка в рублях. Галка ниже — заявки, где сумма не указана.">
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <label style={{ flex: 1 }}>
            <span style={lbl}>От</span>
            <input name="budgetMin" type="number" min={0} defaultValue={initial.budgetMin || ""} placeholder="0" style={inp} />
          </label>
          <label style={{ flex: 1 }}>
            <span style={lbl}>До</span>
            <input name="budgetMax" type="number" min={0} defaultValue={initial.budgetMax || ""} placeholder="500000" style={inp} />
          </label>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--text-sm)" }}>
          <input type="checkbox" checked={showNoBudget} onChange={(e) => setShowNoBudget(e.target.checked)} />
          Показывать заявки без бюджета
        </label>
      </Field>

      <Field
        title="Пол заказчика"
        hint="Определяем по имени в карточке (Анна — женский, Денис — мужской). Саша, Женя и заявки без имени при выборе М/Ж не проходят."
      >
        {(
          [
            ["all", "Все"],
            ["male", "Мужской"],
            ["female", "Женский"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} style={{ display: "inline-flex", gap: 6, marginRight: 16, fontSize: "var(--text-sm)" }}>
            <input type="radio" name="clientGender" checked={gender === value} onChange={() => setGender(value)} />
            {label}
          </label>
        ))}
      </Field>

      <button
        type="submit"
        disabled={saving}
        style={{
          marginTop: 8,
          padding: "12px 28px",
          border: "none",
          borderRadius: "var(--radius-sm)",
          background: "var(--accent)",
          color: "#fff",
          fontWeight: 700,
          cursor: saving ? "wait" : "pointer",
        }}
      >
        {saving ? "Сохраняем…" : "Сохранить фильтры"}
      </button>
      {toast && (
        <p style={{ marginTop: 12, fontSize: "var(--text-sm)", color: "var(--ink-body)" }}>{toast}</p>
      )}
    </form>
  );
}

function Field({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ fontWeight: 650, fontSize: "var(--text-sm)", marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 10 }}>{hint}</p>
      {children}
    </div>
  );
}
