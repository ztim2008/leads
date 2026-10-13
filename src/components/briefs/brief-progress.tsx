"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BRIEF_STAGES, stageIndex } from "@/lib/briefs/progress";

type Summary = { beforeLaunch: number; later: number; good: number; groups: number };

type Status = {
  status: string;
  stage: string | null;
  stageDetail: string | null;
  startedAt: string | null;
  error: string | null;
  percent: number;
  summary: Summary | null;
};

function stepDetail(stage: string, detail: string | null | undefined): string {
  if (stage === "pages" && detail) return `страница ${detail}`;
  if (stage === "model") return "обычно 20–40 с";
  if (stage === "home") return "идёт";
  return detail || "идёт";
}

export default function BriefProgress({
  projectId,
  active,
  host,
}: {
  projectId: string;
  active: boolean;
  host: string;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<Status | null>(null);
  const [watching, setWatching] = useState(active);
  const [now, setNow] = useState(() => Date.now());
  const [doneIn, setDoneIn] = useState<number | null>(null);
  const [modelSince, setModelSince] = useState<number | null>(null);
  const stage = state?.stage || null;

  useEffect(() => {
    if (active) setWatching(true);
  }, [active]);

  useEffect(() => {
    setModelSince(stage === "model" ? Date.now() : null);
  }, [stage]);

  useEffect(() => {
    if (!watching) return;
    let stopped = false;
    async function poll() {
      const res = await fetch(`/api/admin/briefs/${projectId}/status`, { cache: "no-store" }).catch(() => null);
      const data: Status | null = res?.ok ? await res.json() : null;
      if (stopped || !data) return;
      setState(data);
      if (data.status === "ready" || data.status === "failed") {
        setWatching(false);
        if (data.startedAt) setDoneIn(Math.max(1, Math.round((Date.now() - Date.parse(data.startedAt)) / 1000)));
        router.refresh();
        if (data.status === "ready") dialog.current?.showModal();
      }
    }
    void poll();
    const timer = setInterval(poll, 1500);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stopped = true;
      clearInterval(timer);
      clearInterval(clock);
    };
  }, [watching, projectId, router]);

  const current = stageIndex(state?.stage || null);
  const queued = !state || state.status === "queued";
  const base = state?.percent ?? 3;
  const percent =
    modelSince !== null && watching
      ? Math.min(90, Math.max(base, Math.round(base + ((now - modelSince) / 30000) * (90 - base))))
      : base;
  const elapsed = state?.startedAt ? Math.max(0, Math.round((now - Date.parse(state.startedAt)) / 1000)) : 0;

  return (
    <>
      {(watching || state?.status === "failed") && (
        <section className="brief-progress" aria-live="polite">
          <div className="brief-progress-head">
            <strong>{state?.status === "failed" ? "Разбор не выполнился" : queued ? "Разбор в очереди" : `Идёт разбор · ${percent}%`}</strong>
            {!queued && state?.status !== "failed" && <span>{elapsed} с</span>}
          </div>
          <div
            className="brief-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Ход разбора"
          >
            <div className="brief-progress-fill" style={{ width: `${percent}%` }} />
          </div>
          {state?.status === "failed" ? (
            <p className="brief-progress-note">{state.error || "Причина не записана."}</p>
          ) : (
            <ol className="brief-steps">
              {BRIEF_STAGES.map((item, index) => {
                const done = index < current;
                const running = index === current;
                return (
                  <li key={item.id} data-state={done ? "done" : running ? "now" : "next"}>
                    <span>{item.label}</span>
                    <span>{done ? "готово" : running ? stepDetail(item.id, state?.stageDetail) : ""}</span>
                  </li>
                );
              })}
            </ol>
          )}
          {state?.status !== "failed" && (
            <p className="brief-progress-note">Обычно 30–60 секунд. Можно уйти со страницы: отчёт сохранится.</p>
          )}
        </section>
      )}

      <dialog ref={dialog} className="brief-dialog" aria-labelledby="brief-dialog-title">
        <h2 id="brief-dialog-title">Отчёт готов</h2>
        <p>
          {host}
          {doneIn ? ` · за ${doneIn} с` : ""}
        </p>
        {state?.summary && (
          <dl>
            <div>
              <dt>Решить до запуска</dt>
              <dd>{state.summary.beforeLaunch}</dd>
            </div>
            <div>
              <dt>Можно позже</dt>
              <dd>{state.summary.later}</dd>
            </div>
            <div>
              <dt>Уже хорошо</dt>
              <dd>{state.summary.good}</dd>
            </div>
            <div>
              <dt>Групп объявлений</dt>
              <dd>{state.summary.groups}</dd>
            </div>
          </dl>
        )}
        <div className="brief-dialog-actions">
          <button type="button" onClick={() => dialog.current?.close()}>
            Смотреть отчёт
          </button>
          <a href={`/api/admin/briefs/${projectId}/pdf?for=client`}>PDF клиенту</a>
          <a href={`/api/admin/briefs/${projectId}/pdf`}>PDF команде</a>
        </div>
      </dialog>
    </>
  );
}
