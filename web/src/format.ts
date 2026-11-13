export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function bookingDate(value: string | null, current = today()): string {
  const last = new Date(Date.parse(current) + 13 * 86400000)
    .toISOString()
    .slice(0, 10);
  return value && validDate(value) && value >= current && value <= last
    ? value
    : current;
}
export const dateLabel = (
  d: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    weekday: "short",
  },
) =>
  validDate(d)
    ? new Date(d + "T12:00:00+05:30").toLocaleDateString("en-IN", {
        ...options,
        timeZone: "Asia/Kolkata",
      })
    : "Choose a valid date";
export const timeLabel = (t: string) => {
  const h = Number(t.slice(0, 2));
  return `${h % 12 || 12}:${t.slice(3, 5)} ${h >= 12 ? "PM" : "AM"}`;
};
