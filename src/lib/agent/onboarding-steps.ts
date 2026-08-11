/**
 * Вычисление шагов онбординга партнёра (admin-only подключение).
 */

export interface OnboardingStep {
  id: string;
  title: string;
  hint: string;
  done: boolean;
  current?: boolean;
}

export interface PartnerOnboardingInput {
  email: string;
  name?: string;
  workspace?: {
    leadsCount: number;
    settings?: {
      telegramChatId?: string | null;
      telegramToken?: string | null;
    } | null;
    sources?: Array<{
      id: string;
      enabled: boolean;
      setupCommand?: string | null;
      agentStatus?: {
        online: boolean;
        lastHeartbeat?: string | null;
        uptime?: number;
        leads?: number;
        lastError?: string | null;
        lifecycle?: string;
        circuitBreaker?: { state?: string } | null;
        version?: number;
      };
      config?: Record<string, unknown>;
    }>;
  } | null;
}

export function computeOnboardingSteps(p: PartnerOnboardingInput): OnboardingStep[] {
  const ws = p.workspace;
  const source = ws?.sources?.[0];
  const cfg = (source?.config || {}) as Record<string, unknown>;
  const a = source?.agentStatus;
  const hasTg = !!(ws?.settings?.telegramChatId && ws?.settings?.telegramToken);
  const hasProfi = !!(cfg._profiConfigured || (cfg.login && cfg.password));
  const vpsMarked = !!(cfg._vpsIp || cfg._onboardingVpsReady);
  const online = a?.online === true;
  const hasLead = (ws?.leadsCount || 0) > 0 || (a?.leads || 0) > 0;
  const cbState = a?.circuitBreaker?.state;
  const cbOk = !cbState || cbState === "CLOSED" || cbState === "HALF_OPEN";

  const steps: OnboardingStep[] = [
    {
      id: "created",
      title: "Партнёр создан в системе",
      hint: "Email, пароль для входа в дашборд — передаёте партнёру вручную.",
      done: !!p.email,
    },
    {
      id: "profi",
      title: "Profi.ru: логин и пароль на хабе",
      hint: "Вводите здесь, на VPS пароль не нужен — агент получит конфиг с хаба.",
      done: hasProfi,
    },
    {
      id: "telegram",
      title: "Telegram: Chat ID и Bot Token",
      hint: "Партнёр создаёт бота в @BotFather, Chat ID — через @getmyid_bot.",
      done: hasTg,
    },
    {
      id: "vps",
      title: "VPS куплен и доступен по SSH",
      hint: "4 GB RAM, Ubuntu 24.04, KZ/РФ. Отметьте IP ниже после покупки.",
      done: vpsMarked,
    },
    {
      id: "install",
      title: "Agent v2 установлен на VPS",
      hint: "Одна curl-команда на сервере. PM2: leads-agent-v2 online.",
      done: online || !!a?.lastHeartbeat,
    },
    {
      id: "heartbeat",
      title: "Heartbeat с VPS (агент виден в админке)",
      hint: "Обновление каждые 5 мин. Если «Нет связи» > 15 мин — проверьте VPS.",
      done: online,
    },
    {
      id: "telegram_test",
      title: "Тест Telegram (опционально)",
      hint: "Кнопка 🧪 в списке партнёров — партнёр должен получить сообщение.",
      done: hasTg && online,
    },
    {
      id: "first_lead",
      title: "Первые заявки в системе",
      hint: "Может занять до нескольких часов — зависит от ниши и Profi.",
      done: hasLead,
    },
    {
      id: "cb_ok",
      title: "Circuit Breaker в норме (не OPEN/BLOCKED)",
      hint: "При OPEN — не рестартить вручную на Profi, ждать кулдаун или сброс CB.",
      done: online && cbOk,
    },
  ];

  const firstPending = steps.find((s) => !s.done);
  if (firstPending) firstPending.current = true;

  return steps;
}

export function onboardingProgress(steps: OnboardingStep[]): number {
  if (steps.length === 0) return 0;
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}

export function onboardingPhase(steps: OnboardingStep[]): string {
  if (steps.every((s) => s.done)) return "Готово — партнёр подключён";
  if (!steps.find((s) => s.id === "created")?.done) return "Создайте партнёра";
  if (!steps.find((s) => s.id === "vps")?.done) return "Купите VPS и введите IP";
  if (!steps.find((s) => s.id === "heartbeat")?.done) return "Установите агент на VPS";
  if (!steps.find((s) => s.id === "first_lead")?.done) return "Ждём первые заявки";
  return "Финальные проверки";
}
