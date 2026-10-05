export function norm(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е");
}

export function termHit(haystack: string, term: string): boolean {
  const hay = norm(haystack);
  const words = norm(term)
    .split(/[^a-zа-я0-9+]+/i)
    .filter((w) => w.length >= 4);
  if (!words.length) return false;
  return words.every((w) => hay.includes(w.length > 6 ? w.slice(0, w.length - 2) : w));
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
