import { useState, useEffect, useRef, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { api, Venue, Slot, Booking, money, dateLabel, timeLabel } from "../api";
import { useAuth } from "../Auth";
import { BookingPending } from "../BookingPending";

export function BookingForm({
  venue,
  slot,
  date,
  onConflict,
}: {
  venue: Venue;
  slot: Slot | null;
  date: string;
  onConflict: () => void;
}) {
  const navigate = useNavigate();
  const { user, loading, role } = useAuth();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  useEffect(() => setError(""), [date]);
  useEffect(() => {
    if (slot) setError("");
  }, [slot?.id]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slot || !user || submitting.current) return;
    submitting.current = true;
    setError("");
    setPending(true);
    try {
      const booking = await api<Booking>("/bookings", {
        method: "POST",
        body: JSON.stringify({ slotId: slot.id, expectedPrice: slot.price }),
      });
      client.invalidateQueries({ queryKey: ["slots"] });
      client.invalidateQueries({ queryKey: ["my-bookings"] });
      navigate("/booking/" + booking.reference);
    } catch (e: any) {
      setError(e.message);
      if (e.status === 409) onConflict();
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <form className="booking-box" onSubmit={submit} aria-busy={pending}>
      {pending && slot && (
        <BookingPending
          venue={venue.name}
          when={`${dateLabel(date)} · ${timeLabel(slot.start_time)} – ${timeLabel(slot.end_time)} IST`}
        />
      )}
      <span className="eyebrow green">YOUR NEXT GOOD PLAN</span>
      <h2>Let's get you playing.</h2>
      <div className="booking-summary">
        <span>{dateLabel(date)}</span>
        <strong>
          {slot
            ? `${timeLabel(slot.start_time)} – ${timeLabel(slot.end_time)}`
            : "Select a slot to get started"}
        </strong>
        <small>
          {venue.name} · {venue.sport}
        </small>
      </div>
      {user && (
        <div className="account-details">
          <strong>Booking as {user.name}</strong>
          <span>{user.email}</span>
          <span>+91 {user.phone}</span>
        </div>
      )}
      <div className="total">
        <span>
          Total <small>All inclusive</small>
        </span>
        <strong>{slot ? money(slot.price) : "—"}</strong>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {role === "admin" ? (
        <Link className="btn full" to="/admin/venues">
          Manage venues <ArrowUpRight size={19} />
        </Link>
      ) : user ? (
        <button className="btn full" disabled={!slot || pending}>
          {pending ? "Reserving your court…" : "Confirm booking"}
          <ArrowUpRight size={19} />
        </button>
      ) : (
        <Link
          className="btn full"
          to={
            "/login?next=" +
            encodeURIComponent(
              `/venues/${venue.id}?date=${date}${slot ? `&slot=${slot.id}` : ""}`,
            )
          }
        >
          {loading ? "Loading account…" : "Sign in to book"}
          <ArrowUpRight size={19} />
        </Link>
      )}
      {role === "admin" && (
        <p className="browser-note">
          You are signed in as a venue admin. Log out to book with a player
          account.
        </p>
      )}
      <p className="secure-note">
        <ShieldCheck size={13} />
        Instant confirmation. No hidden charges.
      </p>
      <p className="browser-note">
        Your bookings are linked to your account. Sign in on any device to
        manage them.
      </p>
    </form>
  );
}
