import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin, Check, X } from "lucide-react";
import { api, Booking, money, dateLabel, timeLabel } from "../api";
import { useAuth } from "../Auth";
import { Status } from "../Status";

function useBooking(ref: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["booking", user?.id, ref],
    queryFn: () => api<Booking>("/bookings/" + ref),
    retry: false,
  });
}

export function Confirmation() {
  const { reference = "" } = useParams();
  const { data: b, error, isPending, refetch } = useBooking(reference);
  return (
    <main className="page confirmation">
      <Status error={error} loading={isPending} retry={() => refetch()} />
      {b && (
        <>
          <span
            className={
              "success-circle" + (b.status === "CANCELLED" ? " cancelled" : "")
            }
          >
            {b.status === "CANCELLED" ? <X size={34} /> : <Check size={34} />}
          </span>
          <span className="eyebrow green">
            {b.status === "CANCELLED"
              ? "YOUR CANCELLATION IS CONFIRMED"
              : "IT'S OFFICIAL. YOU'RE PLAYING."}
          </span>
          <h1>
            {b.status === "CANCELLED"
              ? "Booking cancelled."
              : "You've got a game."}
          </h1>
          <p>
            {b.status === "CANCELLED"
              ? "Your slot has been released. There is always another game."
              : "Court booked. Group chat sorted. See you out there."}
          </p>
          <div className="ticket">
            <div className="ticket-heading">
              <span className="logo">
                HUDLE<span>↗</span>
              </span>
              <span
                className={
                  "status-badge " +
                  (b.status === "CANCELLED" ? "cancelled" : "")
                }
              >
                {b.status}
              </span>
            </div>
            <h2>{b.venue_name}</h2>
            <p>
              <MapPin size={14} />
              {b.address}
            </p>
            <div className="ticket-grid">
              <div>
                <small>DATE</small>
                <strong>{dateLabel(b.date)}</strong>
              </div>
              <div>
                <small>TIME · IST</small>
                <strong>
                  {timeLabel(b.start_time)} – {timeLabel(b.end_time)}
                </strong>
              </div>
              <div>
                <small>PLAYER</small>
                <strong>{b.customer_name}</strong>
              </div>
              <div>
                <small>TOTAL</small>
                <strong>{money(b.amount)}</strong>
              </div>
            </div>
            <div className="ticket-reference">
              <span>BOOKING REFERENCE</span>
              <strong>{b.reference}</strong>
            </div>
          </div>
          <Link className="btn" to="/my-bookings">
            Manage my bookings <ArrowRight size={17} />
          </Link>
          <Link className="text-btn" to="/">
            Find another game
          </Link>
        </>
      )}
    </main>
  );
}
