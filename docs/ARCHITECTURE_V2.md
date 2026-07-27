# Architecture V2 — Microservices

## Goal
Replace fragile 1000-line worker.ts with isolated collectors.
Each collector = one PM2 process. Crash isolation.

## File structure

src/collectors/
  shared.ts          — saveAndNotify(), saveStatus()
  profi-watcher.ts   — Profi watcher only (~100 lines)
  kwork-poller.ts    — Kwork cyclic only (~100 lines)

## PM2 processes
- leads-worker (keep current, phase out)
- leads-profi   → tsx src/collectors/profi-watcher.ts
- leads-kwork   → tsx src/collectors/kwork-poller.ts

## Implementation plan

### Step 1: Create src/collectors/shared.ts
- saveAndNotify(lead, source, settings) — upsert + Telegram
- saveStatus(info) — write .collector-status.json
- mskNow() — helper

### Step 2: Create src/collectors/profi-watcher.ts
- Import shared, startWatching from profi connector
- For each enabled profi source: start watcher
- onLead → check dup → saveAndNotify → saveStatus
- No cyclic poll, no global vars

### Step 3: Create src/collectors/kwork-poller.ts
- Import shared, kworkConnector
- Poll loop: check hours → fetchLeads → for each: check dup → saveAndNotify
- Random interval 2-10 min
- saveStatus after each cycle

### Step 4: Update PM2
pm2 delete leads-worker
pm2 start src/collectors/profi-watcher.ts --name leads-profi --interpreter tsx
pm2 start src/collectors/kwork-poller.ts --name leads-kwork --interpreter tsx

### Step 5: Update health-check
Read .collector-status.json instead of .worker-status.json

## Benefits
- Profi crash → Kwork still runs
- Each file ~100 lines (understandable)
- No global variable conflicts
- Easy to add new sources

## Time estimate: 3-4 hours
