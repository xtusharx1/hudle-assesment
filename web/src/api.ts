export interface Venue {
  id: number;
  name: string;
  sport: string;
  location: string;
  address: string;
  description: string;
  image_url: string;
  price_per_hour: number;
  rating: string;
  amenities: string[] | string | null;
  is_active: number;
}
export interface Slot {
  id: number;
  venue_id: number;
  date: string;
  start_time: string;
  end_time: string;
  price: number;
  is_blocked: number;
  availability: "AVAILABLE" | "BOOKED" | "BLOCKED" | "PAST";
  booking_reference?: string;
}
export interface Booking {
  reference: string;
  customer_name: string;
  customer_phone: string;
  status: "CONFIRMED" | "CANCELLED";
  amount: number;
  date: string;
  start_time: string;
  end_time: string;
  venue_id: number;
  venue_name: string;
  sport: string;
  location: string;
  address: string;
  image_url: string;
  accessToken?: string;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const r = await fetch((import.meta.env.VITE_API_URL || "") + "/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await r.json();
  if (!r.ok)
    throw new ApiError(
      Array.isArray(data.error?.message)
        ? data.error.message.join(". ")
        : data.error?.message || "Something went wrong",
      r.status,
    );
  return data;
}
export const adminApi = <T>(path: string, options: RequestInit = {}) =>
  api<T>("/admin" + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + sessionStorage.getItem("hudle-admin"),
      ...options.headers,
    },
  });
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateLabel = (
  d: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    weekday: "short",
  },
) => new Date(d + "T12:00:00+05:30").toLocaleDateString("en-IN", options);
export const timeLabel = (t: string) => {
  const h = Number(t.slice(0, 2));
  return `${h % 12 || 12}:${t.slice(3, 5)} ${h >= 12 ? "PM" : "AM"}`;
};
export function savedBookings(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem("hudle-bookings") || "{}");
  } catch {
    return {};
  }
}
export function saveBooking(ref: string, token: string) {
  localStorage.setItem(
    "hudle-bookings",
    JSON.stringify({ ...savedBookings(), [ref]: token }),
  );
}
