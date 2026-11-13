import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, MapPin, CalendarDays, Ticket } from "lucide-react";
import { api, Booking, money, dateLabel, timeLabel } from "../api";
import { useAuth } from "../Auth";
import { useNow } from "../useNow";
import { Dialog } from "../Dialog";
import { VenueImage } from "../VenueImage";
import { Status } from "../Status";

export function MyBookings() {
  const { user } = useAuth();
  const now = useNow();
  const [tab, setTab] = useState("upcoming");
  const query = useQuery({
    refetchInterval: 15000,
    queryKey: ["my-bookings", user?.id],
    queryFn: async () => ({
      bookings: await api<Booking[]>("/bookings"),
      failed: 0,
    }),
  });
  const [cancel, setCancel] = useState<Booking | null>(null);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (b: Booking) =>
      api<Booking>(`/bookings/${b.reference}/cancel`, {
        method: "POST",
      }),
    onSuccess: () => {
      setCancel(null);
      client.invalidateQueries({ queryKey: ["my-bookings"] });
      client.invalidateQueries({ queryKey: ["booking"] });
      client.invalidateQueries({ queryKey: ["slots"] });
    },
  });
  const isUpcoming = (b: Booking) =>
    b.status === "CONFIRMED" &&
    new Date(`${b.date}T${b.start_time}+05:30`).getTime() > now;
  const bookings = query.data?.bookings
    .filter((b) => (tab === "upcoming" ? isUpcoming(b) : !isUpcoming(b)))
    .sort((a, b) =>
      (a.date + a.start_time).localeCompare(b.date + b.start_time),
    );
  return (
    <main className="page my-bookings">
      <span className="eyebrow green">GOOD PLANS, ALL IN ONE PLACE</span>
      <h1>Your next move.</h1>
      <p>Your courts, your crew, your calendar.</p>
      <div className="tabs" role="group" aria-label="Booking view">
        <button
          aria-pressed={tab === "upcoming"}
          className={tab === "upcoming" ? "active" : ""}
          onClick={() => setTab("upcoming")}
        >
          Upcoming games{" "}
          <span>{query.data?.bookings.filter(isUpcoming).length || 0}</span>
        </button>
        <button
          aria-pressed={tab === "past"}
          className={tab === "past" ? "active" : ""}
          onClick={() => setTab("past")}
        >
          Past & cancelled
        </button>
      </div>
      <div className="content-transition" key={tab}>
        <Status
          loading={query.isPending}
          error={query.error}
          retry={() => query.refetch()}
        />
        {!!query.data?.failed && (
          <div className="notice">
            Some bookings could not be loaded. Refresh to try again.
          </div>
        )}
        {bookings?.length === 0 && (
          <div className="empty">
            <Ticket size={44} />
            <h2>
              {tab === "upcoming"
                ? "Your next game is waiting."
                : "A clean scorecard."}
            </h2>
            <p>
              {tab === "upcoming"
                ? "You haven't booked a court yet. Let's change that."
                : "Your past and cancelled games will appear here."}
            </p>
            <Link to="/" className="btn">
              Find your game <ArrowUpRight size={18} />
            </Link>
          </div>
        )}
        <div className="bookings-list">
          {bookings?.map((b) => (
            <article className="booking-card" key={b.reference}>
              <VenueImage src={b.image_url} alt={b.venue_name} />
              <div>
                <span
                  className={
                    "status-badge " +
                    (b.status === "CANCELLED" ? "cancelled" : "")
                  }
                >
                  {b.status === "CANCELLED"
                    ? "Cancelled"
                    : isUpcoming(b)
                      ? "Upcoming"
                      : "Completed"}
                </span>
                <h2>
                  <Link to={"/booking/" + b.reference}>{b.venue_name}</Link>
                </h2>
                <p>
                  <MapPin size={14} />
                  {b.location} · {b.sport}
                </p>
                <p>
                  <CalendarDays size={14} />
                  {dateLabel(b.date)} <span>·</span> {timeLabel(b.start_time)} –{" "}
                  {timeLabel(b.end_time)} IST
                </p>
                <small className="reference">{b.reference}</small>
              </div>
              <div className="booking-card-right">
                <strong>{money(b.amount)}</strong>
                {isUpcoming(b) ? (
                  <button
                    className="text-btn danger"
                    onClick={() => {
                      mutation.reset();
                      setCancel(b);
                    }}
                  >
                    Cancel booking
                  </button>
                ) : (
                  <Link
                    to={b.venue_is_active ? "/venues/" + b.venue_id : "/"}
                    className="text-btn"
                  >
                    {b.venue_is_active ? "Play again" : "Find another venue"}{" "}
                    <ArrowUpRight size={15} />
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
      <p className="browser-note">
        Bookings belong to your account. Sign in on any device to view or manage
        your games.
      </p>
      {cancel && (
        <Dialog
          title="Change of plans?"
          close={() => setCancel(null)}
          busy={mutation.isPending}
        >
          <CalendarDays size={30} />
          <p>
            Cancel your game at {cancel.venue_name} on {dateLabel(cancel.date)}?
            Your slot will be released for someone else.
          </p>
          {mutation.error && (
            <div className="notice error" role="alert">
              {mutation.error.message}
            </div>
          )}
          <div className="modal-actions">
            <button
              className="btn secondary"
              disabled={mutation.isPending}
              onClick={() => setCancel(null)}
            >
              Keep my game
            </button>
            <button
              className="btn"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(cancel)}
            >
              {mutation.isPending ? "Cancelling…" : "Cancel booking"}
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
