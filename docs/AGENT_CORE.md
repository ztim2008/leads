# Agent Core — API и контракт

> Phase 1 ядро VPS-агента. Код: `src/agent-core/`.  
> **Не запускать Playwright Profi на хабе** (`profiOnHub: false`).

## Зачем

После инцидента 30.07.2026 (3277 рестартов → бан аккаунтов) сбор Profi должен:

1. Иметь **один** координатор жизненного цикла.
2. Останавливаться после N ошибок (**Circuit Breaker**), а не рестартить.
3. Хранить сессию на диске (**Persistent Profile**), а не логиниться каждый раз.
4. Переживать рестарт PM2 без сброса кулдауна.

## Структура

```
src/agent-core/
├── index.ts              # публичный API
├── types.ts
├── paths.ts              # ~/.leads-agent
├── circuit-breaker.ts    # CLOSED → OPEN → HALF_OPEN → BLOCKED
├── profile-store.ts      # cookies + chromium dir
├── profiles.ts           # UA / viewport пул
├── human.ts              # humanType / humanClick / humanScroll
├── profi-collector.ts    # один цикл сбора
└── circuit-breaker.test.ts
```

## Диск

```
~/.leads-agent/
└── profiles/{sourceId}/
    ├── state.json          # Circuit Breaker (persistent)
    ├── cookies.json
    ├── localStorage.json
    ├── meta.json
    ├── browser-profile.json
    └── chromium/           # userDataDir (зарезервировано)
```

Переопределение корня: `LEADS_AGENT_HOME` или `agentHome` в конфиге.

## Circuit Breaker

| Правило | Значение |
|---------|----------|
| Порог | 3 ошибки за 10 мин → `OPEN` |
| Кулдаун | `OPEN` 60 мин → `HALF_OPEN` (одна проба) |
| Провал пробы | снова `OPEN` на 120 мин |
| 5 циклов OPEN | `BLOCKED` — только `reset()` |
| В `OPEN`/`BLOCKED` | **0** попыток входа |

```ts
import { CircuitBreaker } from "@/agent-core";

const cb = new CircuitBreaker({ statePath: ".../state.json" });
if (!cb.canAttempt()) { /* тихий режим */ }
cb.recordFailure("login_failed");
cb.recordSuccess();
cb.reset(); // кнопка админки
```

## ProfiCollector

```ts
import { ProfiCollector } from "@/agent-core";

const collector = new ProfiCollector({
  sourceId: "clx...",
  login: "...",
  password: "...",
  keywords: "ремонт,сантехник",
});

await collector.start({
  onLead: async (lead) => { /* POST /api/v2/agent/leads */ },
  onError: (e) => console.error(e),
  onStatus: (s) => console.log(s),
  onCircuitChange: (snap) => { /* POST /api/v2/agent/alert */ },
});

// Единственный stop path:
collector.stop();
```

### Чего больше нет (осознанно)

| Было в `profi.ts` | Теперь |
|-------------------|--------|
| `globalThis.__lastNewLead` | удалено |
| SILENT 30min → restart | удалено |
| health-check 10min → restart | только STOP |
| SESSION EXPIRED → `startWatching` рекурсия | STOP + CB |
| Три независимых рестарта | один `stop()` / внешний start |

## Тест (DoD этапа 1)

```bash
npm run test:agent-core
```

Ожидание: 3 ошибки → `OPEN` → `runOnce()` не увеличивает счётчик логинов в течение окна кулдауна.

## Связь с этапами

| Этап | Что берёт из core |
|------|-------------------|
| 2 | `public/agent/v2` — обёртка над `ProfiCollector` |
| 3 | Хаб API читает CB snapshot из heartbeat |
| 4 | Пилот на отдельном VPS |

## Источники правды

- `docs/TZ_LEADS_AI_V2.md` §4.3–4.5
- `docs/ANTI_BLOCK_PLAN.md` §Circuit Breaker
- `docs/PLAN_2026-08-10.md` Этап 1
