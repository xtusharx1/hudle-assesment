import { useState, FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpRight, ChevronLeft, LockKeyhole } from "lucide-react";
import { useAuth } from "../Auth";
import { loginDestination } from "../auth-rules";

export function AdminLogin() {
  const { authenticateAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await authenticateAdmin({
        username: String(f.get("username")),
        password: String(f.get("password")),
      });
      navigate(loginDestination("admin", params.get("next")), {
        replace: true,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="page login-page content-transition">
      <form onSubmit={submit} className="booking-box">
        <span className="success-circle small">
          <LockKeyhole size={24} />
        </span>
        <span className="eyebrow green">FOR THE PEOPLE BEHIND THE PLAY</span>
        <h1>{user ? "Switch to venue admin." : "Welcome back."}</h1>
        <p>Sign in to manage your venues and games.</p>
        <label>
          Username
          <input name="username" required autoComplete="username" />
        </label>
        <label>
          Password
          <input
            name="password"
            required
            type="password"
            autoComplete="current-password"
          />
        </label>
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        <button disabled={pending} className="btn full">
          {pending ? "Signing in…" : user ? "Continue as admin" : "Sign in"}
          <ArrowUpRight size={18} />
        </button>
        <Link className="back-link" to="/">
          <ChevronLeft size={15} />
          Back to discovery
        </Link>
      </form>
    </main>
  );
}
