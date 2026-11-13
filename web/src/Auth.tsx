import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
  FormEvent,
} from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AuthTransition, AuthAction } from "./AuthTransition";
import {
  AuthRole,
  resolveRole,
  loginDestination,
  customerRouteRedirect,
} from "./auth-rules";
import { ApiError, api, adminApi } from "./api";
export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
}
interface AdminIdentity {
  role: "admin";
  username: string;
}
interface AuthContext {
  user: User | null;
  admin: AdminIdentity | null;
  role: AuthRole;
  loading: boolean;
  logout: () => Promise<void>;
  authenticate: (
    action: "login" | "register",
    body: Record<string, unknown>,
  ) => Promise<User>;
  authenticateAdmin: (body: {
    username: string;
    password: string;
  }) => Promise<void>;
}
const Context = createContext<AuthContext>({
  user: null,
  admin: null,
  role: "loading",
  loading: true,
  logout: async () => {},
  authenticate: async () => {
    throw new Error("Missing auth provider");
  },
  authenticateAdmin: async () => {
    throw new Error("Missing auth provider");
  },
});
export const useAuth = () => useContext(Context);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [admin, setAdmin] = useState<AdminIdentity | null>(null),
    [loading, setLoading] = useState(true);
  const [transition, setTransition] = useState<AuthAction | null>(null);
  const busy = useRef(false),
    version = useRef(0);
  const client = useQueryClient();
  const clearPrivateData = () => {
    const predicate = (q: { queryKey: readonly unknown[] }) =>
      ["booking", "my-bookings"].includes(String(q.queryKey[0])) ||
      String(q.queryKey[0]).startsWith("admin-");
    void client.cancelQueries({ predicate });
    client.removeQueries({ predicate });
  };
  const clearAdmin = () => {
    sessionStorage.removeItem("hudle-admin");
    setAdmin(null);
  };
  const announce = (role: AuthRole) => {
    try {
      localStorage.setItem(
        "hudle-account-change",
        JSON.stringify({ role, nonce: Date.now() + Math.random() }),
      );
    } catch {}
  };
  useEffect(() => {
    let active = true;
    const sync = async () => {
      if (busy.current) return;
      const current = version.current;
      const apply = (fn: () => void) => {
        if (active && current === version.current) fn();
      };
      try {
        if (sessionStorage.getItem("hudle-admin")) {
          try {
            const identity = await adminApi<AdminIdentity>("/me");
            apply(() => {
              setAdmin(identity);
              setUser(null);
            });
            return;
          } catch (e) {
            if (!(e instanceof ApiError) || e.status !== 401) throw e;
            if (current !== version.current) return;
            clearAdmin();
            clearPrivateData();
          }
        }
        const customer = await api<User>("/auth/me");
        apply(() => {
          setAdmin(null);
          setUser(customer);
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401)
          apply(() => {
            setUser(null);
            setAdmin(null);
            clearPrivateData();
          });
      } finally {
        apply(() => setLoading(false));
      }
    };
    const changed = (e: StorageEvent) => {
      if (e.key !== "hudle-account-change") return;
      version.current++;
      setLoading(true);
      try {
        if (JSON.parse(e.newValue || "{}").role !== "admin") clearAdmin();
      } catch {
        clearAdmin();
      }
      clearPrivateData();
      void sync();
    };
    const adminExpired = () => {
      version.current++;
      setLoading(true);
      clearAdmin();
      clearPrivateData();
      void sync();
    };
    void sync();
    window.addEventListener("storage", changed);
    window.addEventListener("focus", sync);
    window.addEventListener("hudle-session-expired", sync);
    window.addEventListener("hudle-admin-expired", adminExpired);
    return () => {
      active = false;
      window.removeEventListener("storage", changed);
      window.removeEventListener("focus", sync);
      window.removeEventListener("hudle-session-expired", sync);
      window.removeEventListener("hudle-admin-expired", adminExpired);
    };
  }, [client]);
  async function run<T>(
    action: AuthAction,
    request: () => Promise<T>,
  ): Promise<T> {
    if (busy.current)
      throw new Error("Please wait for the current account action.");
    busy.current = true;
    version.current++;
    setTransition(action);
    try {
      const [result] = await Promise.allSettled([
        request(),
        new Promise((resolve) => window.setTimeout(resolve, 850)),
      ]);
      if (result.status === "rejected") throw result.reason;
      return result.value;
    } finally {
      busy.current = false;
      setTransition(null);
      setLoading(false);
    }
  }
  async function authenticate(
    action: "login" | "register",
    body: Record<string, unknown>,
  ) {
    const customer = await run(action, () =>
      api<User>("/auth/" + action, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    clearAdmin();
    clearPrivateData();
    setUser(customer);
    announce("customer");
    return customer;
  }
  async function authenticateAdmin(body: {
    username: string;
    password: string;
  }) {
    const result = await run("login", async () => {
      const login = await api<{ token: string; username: string }>(
        "/admin/login",
        { method: "POST", body: JSON.stringify(body) },
      );
      // End the player session before entering the admin role; logout must not reveal a hidden second account.
      await api("/auth/logout", { method: "POST" });
      return login;
    });
    sessionStorage.setItem("hudle-admin", result.token);
    clearPrivateData();
    setUser(null);
    setAdmin({ role: "admin", username: result.username });
    announce("admin");
  }
  async function logout() {
    await run("logout", () => api("/auth/logout", { method: "POST" }));
    clearAdmin();
    clearPrivateData();
    setUser(null);
    announce("guest");
  }
  const role = resolveRole(loading, !!admin, !!user);
  return (
    <Context.Provider
      value={{
        user,
        admin,
        role,
        loading,
        logout,
        authenticate,
        authenticateAdmin,
      }}
    >
      {children}
      {transition && <AuthTransition action={transition} />}
    </Context.Provider>
  );
}
export function RequireUser({ children }: { children: ReactNode }) {
  const { role } = useAuth(),
    loc = useLocation();
  if (role === "loading")
    return (
      <main className="page empty" role="status">
        Loading your account…
      </main>
    );
  const redirect = customerRouteRedirect(role, loc.pathname + loc.search);
  return redirect ? <Navigate to={redirect} replace /> : <>{children}</>;
}
export function AuthPage({ register = false }: { register?: boolean }) {
  const { role, authenticate, loading } = useAuth(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const target = loginDestination(
    role === "admin" ? "admin" : "customer",
    params.get("next"),
  );
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const f = new FormData(e.currentTarget);
    if (register && f.get("password") !== f.get("confirm")) {
      setError("Your passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await authenticate(register ? "register" : "login", {
        email: f.get("email"),
        password: f.get("password"),
        ...(register ? { name: f.get("name"), phone: f.get("phone") } : {}),
      });
      navigate(target, { replace: true });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }
  if (loading)
    return (
      <main className="page empty" role="status">
        Loading your account…
      </main>
    );
  if (role === "customer" || role === "admin")
    return <Navigate to={target} replace />;
  return (
    <main className="auth-page">
      <section className="auth-story">
        <span className="eyebrow">MAKE TIME FOR PLAY</span>
        <h2>
          Your game.
          <br />
          Your people.
          <br />
          <em>Your account.</em>
        </h2>
        <p>
          Find your next court, keep every booking together, and get back to
          what you love.
        </p>
        <div className="auth-perks">
          <span>↗ One account, every game</span>
          <span>✓ Your bookings, on any device</span>
          <span>✳ More play. Less planning.</span>
        </div>
      </section>
      <section className="auth-card" key={register ? "register" : "login"}>
        <span className="eyebrow green">
          {register ? "JOIN THE HUDLE" : "WELCOME BACK"}
        </span>
        <h1>
          {register
            ? "Let’s get you in the game."
            : "Ready for your next game?"}
        </h1>
        <p>
          {register
            ? "Create your account to reserve a court."
            : "Sign in to book and manage your games."}
        </p>
        <form
          className={register ? "auth-form registration-form" : "auth-form"}
          onSubmit={submit}
        >
          {register && (
            <>
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Tushar Sharma"
                />
              </label>
              <label>
                Mobile number
                <div className="phone-input">
                  <span>+91</span>
                  <input
                    aria-label="Mobile number"
                    name="phone"
                    autoComplete="tel-national"
                    inputMode="tel"
                    required
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    placeholder="9876543210"
                    title="Enter a 10-digit Indian mobile number"
                  />
                </div>
              </label>
            </>
          )}
          <label className="auth-email">
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={register ? 10 : 1}
              maxLength={128}
              placeholder={
                register ? "At least 10 characters" : "Your password"
              }
            />
          </label>
          {register && (
            <label>
              Confirm password
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={128}
                placeholder="Enter your password again"
              />
            </label>
          )}
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          <button className="btn full" disabled={pending}>
            {pending
              ? "Please wait…"
              : register
                ? "Create account ↗"
                : "Sign in ↗"}
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Already playing with us?" : "New to Hudle?"}{" "}
          <Link
            to={
              (register ? "/login" : "/register") +
              "?next=" +
              encodeURIComponent(target)
            }
          >
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <small className="secure-note">
          Your session stays signed in securely on this device.
        </small>
      </section>
    </main>
  );
}
