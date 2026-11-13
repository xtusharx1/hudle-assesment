import {
  createContext,
  useContext,
  useEffect,
  useState,
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
import { api } from "./api";
export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
}
const Context = createContext<{
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}>({ user: null, loading: true, setUser: () => {}, logout: async () => {} });
export const useAuth = () => useContext(Context);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  const client = useQueryClient();
  useEffect(() => {
    let active = true;
    api<User>("/auth/me")
      .then((u) => {
        if (active) setUser(u);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const expired = () => {
      setUser(null);
      client.clear();
    };
    window.addEventListener("hudle-session-expired", expired);
    return () => window.removeEventListener("hudle-session-expired", expired);
  }, [client]);
  async function logout() {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
    client.clear();
  }
  return (
    <Context.Provider
      value={{
        user,
        loading,
        setUser: (u) => {
          client.clear();
          setUser(u);
        },
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function RequireUser({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth(),
    loc = useLocation();
  if (loading)
    return (
      <main className="page empty" role="status">
        Loading your account…
      </main>
    );
  return user ? (
    <>{children}</>
  ) : (
    <Navigate
      replace
      to={"/login?next=" + encodeURIComponent(loc.pathname + loc.search)}
    />
  );
}
export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, setUser, loading } = useAuth(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const next = params.get("next") || "/my-bookings";
  const target =
    next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
      ? next
      : "/my-bookings";
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
      const u = await api<User>("/auth/" + (register ? "register" : "login"), {
        method: "POST",
        body: JSON.stringify({
          email: f.get("email"),
          password: f.get("password"),
          ...(register ? { name: f.get("name"), phone: f.get("phone") } : {}),
        }),
      });
      setUser(u);
      navigate(target, { replace: true });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }
  if (user && !loading) return <Navigate to={target} replace />;
  return (
    <main className="auth-page">
      <section className="auth-story">
        <span className="eyebrow">MAKE TIME FOR PLAY</span>
        <h1>
          Your game.
          <br />
          Your people.
          <br />
          <em>Your account.</em>
        </h1>
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
        <h2>
          {register
            ? "Let’s get you in the game."
            : "Ready for your next game?"}
        </h2>
        <p>
          {register
            ? "Create your account to reserve a court."
            : "Sign in to book and manage your games."}
        </p>
        <form onSubmit={submit}>
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
          <label>
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
