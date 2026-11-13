import type { Slot } from "./api";

/** Advance only after every scheduled start has passed, not when a day sells out. */
export function defaultBookingDate(
  date: string,
  slots: Pick<Slot, "date" | "start_time">[],
  now = Date.now(),
): string {
  const currentDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
  if (date < currentDay) return currentDay;
  if (date !== currentDay || slots.length === 0) return date;
  const allStarted = slots.every(
    (slot) =>
      slot.date === date &&
      new Date(`${slot.date}T${slot.start_time}+05:30`).getTime() <= now,
  );
  return allStarted
    ? new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)
    : date;
}
