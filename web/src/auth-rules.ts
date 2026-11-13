export type AuthRole = "loading" | "guest" | "customer" | "admin";
export function resolveRole(
  loading: boolean,
  hasAdmin: boolean,
  hasCustomer: boolean,
): AuthRole {
  if (loading) return "loading";
  if (hasAdmin) return "admin";
  return hasCustomer ? "customer" : "guest";
}
export function accountActions(role: AuthRole) {
  switch (role) {
    case "admin":
      return [
        { label: "Admin dashboard", to: "/admin/venues", icon: "admin" },
        { label: "All bookings", to: "/admin/bookings", icon: "bookings" },
        { label: "Log out", icon: "logout" },
      ];
    case "customer":
      return [
        { label: "Profile", to: "/profile", icon: "profile" },
        { label: "My bookings", to: "/my-bookings", icon: "bookings" },
        { label: "Log out", icon: "logout" },
      ];
    case "guest":
      return [
        { label: "Sign in", to: "/login", icon: "login" },
        { label: "Sign up", to: "/register", icon: "register" },
      ];
    default:
      return [];
  }
}
export function loginDestination(
  role: AuthRole,
  requested: string | null = null,
) {
  const fallback = role === "admin" ? "/admin/venues" : "/my-bookings";
  if (
    !requested ||
    !requested.startsWith("/") ||
    requested.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(requested)
  )
    return fallback;
  const rawPath = requested.split(/[?#]/)[0];
  // Reject encoded separators and dot segments before the router/browser can
  // normalize an apparently allowed path into a different role's route.
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return fallback;
  }
  if (
    /[\\%]/.test(decoded) ||
    decoded.startsWith("//") ||
    decoded.split("/").some((part) => part === "." || part === "..")
  )
    return fallback;
  const path = decoded.replace(/\/+$/, "") || "/";
  if (role === "admin")
    return path.startsWith("/admin/") && path !== "/admin/login"
      ? requested
      : fallback;
  return path.startsWith("/admin") || path === "/login" || path === "/register"
    ? fallback
    : requested;
}
export function customerRouteRedirect(
  role: AuthRole,
  path: string,
): string | null {
  if (role === "admin") return "/admin/venues";
  if (role === "guest") return "/login?next=" + encodeURIComponent(path);
  return null;
}
