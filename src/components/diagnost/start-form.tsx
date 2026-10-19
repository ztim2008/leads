"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { ClosedNotice } from "@/components/diagnost/bits";
import { BUSINESS_LABELS, type BusinessType } from "@/lib/diagnost/types";

const TYPES = Object.entries(BUSINESS_LABELS) as [BusinessType, string][];

export default function StartForm({ initialUrl = "", compact = false }: { initialUrl?: string; compact?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [type, setType] = useState<BusinessType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/diagnost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, businessType: type }),
      });
      const data = (await response.json()) as { slug?: string; error?: string; closed?: boolean };
      if (data.closed) {
        setClosed(true);
        setBusy(false);
        return;
      }
      if (!response.ok || !data.slug) throw new Error(data.error || "Не удалось запустить аудит");
      router.push(`/diagnost/r/${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить аудит");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="dg-panel flex items-center gap-2 p-1.5 pl-5" style={{ borderRadius: 16 }}>
        <input
          className="dg-input"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          placeholder="https://example.ru"
          aria-label="Адрес сайта для аудита"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <button type="submit" className="dg-btn dg-btn-primary" style={{ height: "var(--dg-control-h-hero)", padding: "0 22px" }} disabled={busy || !url.trim()}>
          {busy ? <Loader2 size={18} className="dg-spin" /> : null}
          {busy ? "Запускаем" : "Запустить аудит"}
          {!busy && <ArrowRight size={18} />}
        </button>
      </div>
      {closed ? (
        <ClosedNotice />
      ) : error ? (
        <p className="mt-3 text-sm" style={{ color: "var(--dg-critical)" }} role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-[13px]" style={{ color: "var(--dg-muted)" }}>
          Анализируем сайт, структуру, офферы, UX, SEO, скорость, доверие и конверсионные элементы
        </p>
      )}
      {!compact && (
        <div className="mt-7">
          <div className="dg-eyebrow mb-3">Тип бизнеса</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="dg-chip" aria-pressed={type === null} onClick={() => setType(null)}>
              Определить автоматически
            </button>
            {TYPES.map(([id, label]) => (
              <button key={id} type="button" className="dg-chip" aria-pressed={type === id} onClick={() => setType(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
