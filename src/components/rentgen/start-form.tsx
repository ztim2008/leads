"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

export default function StartForm({ initialUrl = "", hint = true }: { initialUrl?: string; hint?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/rentgen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as { slug?: string; error?: string };
      if (!response.ok || !data.slug) throw new Error(data.error || "Не удалось начать проверку");
      router.push(`/rentgen/r/${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать проверку");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="rg-panel rg-field">
        <input
          className="rg-input"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          placeholder="example.ru"
          aria-label="Адрес сайта"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <button type="submit" className="rg-btn rg-btn-primary" style={{ height: "var(--rg-control-h-hero)", padding: "0 20px" }} disabled={busy || !url.trim()}>
          {busy ? <Loader2 size={18} className="rg-spin" /> : null}
          {busy ? "Запускаем" : "Просветить"}
          {!busy && <ArrowRight size={18} />}
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-sm" style={{ color: "var(--rg-dead)" }} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--rg-muted)" }}>
          Бесплатно, до 10 сайтов в день. Проверка занимает около минуты.
        </p>
      ) : null}
    </form>
  );
}
