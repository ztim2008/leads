"use client";

import { useMemo, useState } from "react";
import type { CalendarSlot } from "@/lib/billing/payment-calendar";
import { formatRub } from "@/lib/billing/operator-pricing";
import { PaidBadge } from "./paid-badge";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function PaymentCalendar({
  slots,
  interactive,
  onTogglePaid,
}: {
  slots: CalendarSlot[];
  interactive?: boolean;
  onTogglePaid?: (slot: CalendarSlot, paid: boolean) => void;
}) {
  const current = slots.find((s) => s.role === "current") || slots[0];
  const [month, setMonth] = useState(() =>
    startOfMonth(current ? new Date(current.periodStart) : new Date()),
  );

  const rangeStart = current ? new Date(current.periodStart) : null;
  const rangeEnd = current ? new Date(current.periodEnd) : null;
  const paid = current?.paid ?? false;

  const cells = useMemo(() => {
    const first = startOfMonth(month);
    const startWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: { date: Date | null; inPeriod: boolean; isDue: boolean; isToday: boolean }[] = [];
    for (let i = 0; i < startWeekday; i++) out.push({ date: null, inPeriod: false, isDue: false, isToday: false });
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const inPeriod = !!(
        rangeStart &&
        rangeEnd &&
        date.getTime() >= new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime() &&
        date.getTime() <= new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()).getTime()
      );
      out.push({
        date,
        inPeriod,
        isDue: !!(rangeEnd && isSameDay(date, rangeEnd)),
        isToday: isSameDay(date, today),
      });
    }
    return out;
  }, [month, rangeStart, rangeEnd]);

  const monthLabel = month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button type="button" onClick={() => setMonth(addMonths(month, -1))} style={navBtn}>
          ←
        </button>
        <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", textTransform: "capitalize" }}>{monthLabel}</span>
        <button type="button" onClick={() => setMonth(addMonths(month, 1))} style={navBtn}>
          →
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 14 }}>
        {WEEKDAYS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "0.65rem", color: "var(--ink-muted)", fontWeight: 600 }}>
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          if (!c.date) return <div key={`e-${i}`} />;
          let bg = "transparent";
          let color = "var(--ink-body)";
          if (c.inPeriod) {
            bg = paid ? "var(--green-soft)" : "var(--red-soft)";
            color = paid ? "var(--green)" : "var(--red)";
          }
          return (
            <div
              key={dateKey(c.date)}
              title={c.isDue ? "день оплаты / конец периода" : undefined}
              style={{
                textAlign: "center",
                padding: "6px 0",
                borderRadius: 8,
                fontSize: "var(--text-xs)",
                fontWeight: c.isDue || c.isToday ? 800 : 500,
                background: bg,
                color,
                outline: c.isToday ? "1px solid var(--accent)" : c.isDue ? "1px solid currentColor" : "none",
              }}
            >
              {c.date.getDate()}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: "0.65rem", color: "var(--ink-muted)", marginBottom: 12 }}>
        Цветные дни — текущий период. Обводка — день оплаты (конец периода). Сегодня с рамкой акцента.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {slots.map((slot) => (
          <div
            key={slot.periodStart}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              border: slot.role === "current" ? "1px solid var(--accent)" : "1px solid var(--border)",
              background: "var(--bg-layer)",
            }}
          >
            <div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 650 }}>
                {slot.title}
                {slot.role === "current" ? " · текущий" : slot.role === "upcoming" ? " · следующий" : ""}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{formatRub(slot.amountRub)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PaidBadge paid={slot.paid} size="sm" />
              {interactive && onTogglePaid && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={slot.paid}
                    onChange={(e) => onTogglePaid(slot, e.target.checked)}
                  />
                  {slot.paid ? "оплачен" : "не оплачен"}
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--bg-layer)",
  borderRadius: "var(--radius-sm)",
  width: 32,
  height: 32,
  cursor: "pointer",
  fontWeight: 700,
};
