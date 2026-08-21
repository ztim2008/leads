/**
 * Интервал проверки ленты Profi (админ, на партнёра).
 * Жёсткий пол — защита от опасного «ускорения».
 */

export const POLL_ABSOLUTE_MIN = 2;
export const POLL_ABSOLUTE_MAX = 15;

export const POLL_PRESETS = {
  calm: {
    id: "calm" as const,
    label: "Спокойный",
    minMinutes: 5,
    maxMinutes: 9,
    risk: "ниже",
    hint: "Новый аккаунт / осторожный режим",
  },
  standard: {
    id: "standard" as const,
    label: "Стандарт",
    minMinutes: 3,
    maxMinutes: 7,
    risk: "норма",
    hint: "По умолчанию — баланс скорость/риск",
  },
  responsive: {
    id: "responsive" as const,
    label: "Быстрее отклик",
    minMinutes: 2,
    maxMinutes: 4,
    risk: "выше",
    hint: "Чаще смотрит ленту. Риск паттерна бота выше — только осознанно",
  },
};

export type PollPresetId = keyof typeof POLL_PRESETS;

export type PollRange = {
  preset: PollPresetId;
  minMinutes: number;
  maxMinutes: number;
  label: string;
};

export function isPollPresetId(v: unknown): v is PollPresetId {
  return typeof v === "string" && v in POLL_PRESETS;
}

export function clampPollRange(minRaw: number, maxRaw: number): { minMinutes: number; maxMinutes: number } {
  let minMinutes = Math.round(Number(minRaw));
  let maxMinutes = Math.round(Number(maxRaw));
  if (!Number.isFinite(minMinutes)) minMinutes = 3;
  if (!Number.isFinite(maxMinutes)) maxMinutes = 7;
  minMinutes = Math.min(POLL_ABSOLUTE_MAX, Math.max(POLL_ABSOLUTE_MIN, minMinutes));
  maxMinutes = Math.min(POLL_ABSOLUTE_MAX, Math.max(POLL_ABSOLUTE_MIN, maxMinutes));
  if (maxMinutes < minMinutes) maxMinutes = minMinutes;
  return { minMinutes, maxMinutes };
}

export function resolvePollRange(cfg: Record<string, unknown> | null | undefined): PollRange {
  const raw = cfg || {};
  if (isPollPresetId(raw.pollPreset)) {
    const p = POLL_PRESETS[raw.pollPreset];
    return {
      preset: p.id,
      minMinutes: p.minMinutes,
      maxMinutes: p.maxMinutes,
      label: `${p.minMinutes}–${p.maxMinutes} мин`,
    };
  }
  if (raw.pollMinMinutes != null || raw.pollMaxMinutes != null) {
    const { minMinutes, maxMinutes } = clampPollRange(
      Number(raw.pollMinMinutes ?? 3),
      Number(raw.pollMaxMinutes ?? 7),
    );
    return {
      preset: "standard",
      minMinutes,
      maxMinutes,
      label: `${minMinutes}–${maxMinutes} мин`,
    };
  }
  const p = POLL_PRESETS.standard;
  return {
    preset: p.id,
    minMinutes: p.minMinutes,
    maxMinutes: p.maxMinutes,
    label: `${p.minMinutes}–${p.maxMinutes} мин`,
  };
}

export function pollConfigPatch(preset: PollPresetId): {
  pollPreset: PollPresetId;
  pollMinMinutes: number;
  pollMaxMinutes: number;
} {
  const p = POLL_PRESETS[preset] || POLL_PRESETS.standard;
  return {
    pollPreset: p.id,
    pollMinMinutes: p.minMinutes,
    pollMaxMinutes: p.maxMinutes,
  };
}
