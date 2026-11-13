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
  venue_is_active: number;
  sport: string;
  location: string;
  address: string;
  image_url: string;
}
import { ApiError, readResponse } from "./http";
export { ApiError } from "./http";
let refreshing: Promise<boolean> | null = null;
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  let r: Response;
  try {
    r = await fetch((import.meta.env?.VITE_API_URL || "") + "/api" + path, {
      ...options,
      credentials: "include",
      signal: options.signal || AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      0,
    );
  }
  if (
    r.status === 401 &&
    !retried &&
    !path.startsWith("/admin") &&
    (!path.startsWith("/auth/") || path === "/auth/me")
  ) {
    if (!refreshing)
      refreshing = (async () => {
        const renew = async () => {
          // Another tab may have refreshed while this tab waited for the lock.
          try {
            await api("/auth/me", {}, true);
            return true;
          } catch (e) {
            if (!(e instanceof ApiError) || e.status !== 401) throw e;
          }
          await api("/auth/refresh", { method: "POST" }, true);
          return true;
        };
        return navigator.locks
          ? navigator.locks.request("hudle-refresh", renew)
          : renew();
      })()
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) return false;
          throw e;
        })
        .finally(() => {
          refreshing = null;
        });
    if (await refreshing) return api<T>(path, options, true);
    window.dispatchEvent(new Event("hudle-session-expired"));
  }
  if (
    r.status === 401 &&
    path.startsWith("/admin") &&
    path !== "/admin/login"
  ) {
    sessionStorage.removeItem("hudle-admin");
    window.dispatchEvent(new Event("hudle-admin-expired"));
  }
  return readResponse<T>(r);
}
export const adminApi = <T>(path: string, options: RequestInit = {}) =>
  api<T>("/admin" + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + sessionStorage.getItem("hudle-admin"),
      ...options.headers,
    },
  });
export { money, today, dateLabel, timeLabel } from "./format";
