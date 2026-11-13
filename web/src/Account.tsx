import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  UserRound,
  LayoutDashboard,
  ChevronDown,
  ArrowUpRight,
  Ticket,
  LogOut,
  LogIn,
  UserPlus,
  Mail,
  Phone,
} from "lucide-react";
import { accountActions } from "./auth-rules";
import { useAuth } from "./Auth";
import { useNow } from "./useNow";
import { api, Booking } from "./api";
export function ProfileMenu() {
  const { user, admin, role, loading, logout } = useAuth();
  const displayName = admin ? "Admin" : user?.name;
  const actions = accountActions(role);
  const icons: Record<string, typeof UserRound> = {
    admin: LayoutDashboard,
    profile: UserRound,
    bookings: Ticket,
    logout: LogOut,
    login: LogIn,
    register: UserPlus,
  };
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const location = useLocation(),
    navigate = useNavigate();
  useEffect(() => {
    setOpen(false);
    setError("");
  }, [location.pathname, location.search, user?.id, role]);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>(".profile-card")?.focus();
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const initials = displayName
    ?.split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  async function signOut() {
    setError("");
    try {
      await logout();
      setOpen(false);
      navigate("/");
    } catch (e: any) {
      setError(e.message || "Could not sign out. Please try again.");
      setOpen(true);
    }
  }
  return (
    <div
      className="profile-menu"
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className={"profile-trigger" + (open ? " is-open" : "")}
        aria-label={
          role === "admin"
            ? "Open admin account"
            : user
              ? "Open your account"
              : "Open account options"
        }
        aria-expanded={open}
        aria-controls="profile-panel"
        onClick={() => setOpen(!open)}
        disabled={loading}
      >
        <span className="profile-avatar">
          {initials || <UserRound size={19} />}
        </span>
        <span className="profile-trigger-label">
          {displayName ? displayName.split(" ")[0] : "Account"}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <section
          className="profile-panel"
          id="profile-panel"
          aria-label="Your account"
        >
          <div className="profile-panel-heading">
            <span className="profile-avatar large">
              {initials || <UserRound size={24} />}
            </span>
            <div>
              <h2>{displayName || "Account"}</h2>
              {admin && <p>{admin.username}</p>}
              {user && <p>{user.email}</p>}
            </div>
          </div>
          <div className="profile-list">
            {actions.map((action) => {
              const Icon = icons[action.icon];
              return action.to ? (
                <Link
                  key={action.label}
                  className="profile-card"
                  to={action.to}
                >
                  <Icon size={18} />
                  <span>{action.label}</span>
                </Link>
              ) : (
                <button
                  key={action.label}
                  className="profile-card profile-card-logout"
                  onClick={signOut}
                >
                  <Icon size={18} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
export function ProfilePage() {
  const now = useNow();
  const { user } = useAuth();
  const query = useQuery({
    refetchInterval: 15000,
    queryKey: ["my-bookings", user?.id],
    queryFn: async () => ({
      bookings: await api<Booking[]>("/bookings"),
      failed: 0,
    }),
  });
  const bookings = query.data?.bookings;
  const upcoming = bookings?.filter(
    (b) =>
      b.status === "CONFIRMED" &&
      new Date(`${b.date}T${b.start_time}+05:30`).getTime() > now,
  ).length;
  return (
    <main className="page profile-page">
      <span className="eyebrow green">A LITTLE MORE YOU</span>
      <h1>Your player profile.</h1>
      <p>The details behind every good game.</p>
      <div className="profile-layout">
        <section className="player-card">
          <span className="player-avatar">
            {user?.name
              .split(/\s+/)
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </span>
          <span className="eyebrow green">PART OF THE HUDLE</span>
          <h2>{user?.name}</h2>
          <p>Always room for one more game.</p>
          <Link className="btn" to="/">
            Find your next game <ArrowUpRight size={17} />
          </Link>
        </section>
        <div className="profile-detail-stack">
          <section className="profile-details">
            <h2>Account details</h2>
            <p>Your bookings use these details automatically.</p>
            <dl>
              <div>
                <dt>
                  <UserRound size={17} /> Full name
                </dt>
                <dd>{user?.name}</dd>
              </div>
              <div>
                <dt>
                  <Mail size={17} /> Email address
                </dt>
                <dd>{user?.email}</dd>
              </div>
              <div>
                <dt>
                  <Phone size={17} /> Mobile number
                </dt>
                <dd>+91 {user?.phone}</dd>
              </div>
            </dl>
          </section>
          <div className="player-stats">
            <Link to="/my-bookings">
              <strong>{query.isError ? "—" : (upcoming ?? "…")}</strong>
              <span>
                Upcoming games <ArrowUpRight size={14} />
              </span>
            </Link>
            <Link to="/my-bookings">
              <strong>{query.isError ? "—" : (bookings?.length ?? "…")}</strong>
              <span>
                Total bookings <ArrowUpRight size={14} />
              </span>
            </Link>
          </div>
          {query.isError && (
            <p className="notice error">
              Your booking totals could not load.{" "}
              <button className="text-btn" onClick={() => query.refetch()}>
                Try again
              </button>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
