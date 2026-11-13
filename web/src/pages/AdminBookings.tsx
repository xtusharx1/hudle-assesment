import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ticket } from "lucide-react";
import { adminApi, Venue, Booking, money, timeLabel, dateLabel } from "../api";
import { Status } from "../Status";

export function AdminBookings() {
  const [venueId, setVenue] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const venues = useQuery({
    queryKey: ["admin-venues"],
    queryFn: () => adminApi<Venue[]>("/venues"),
  });
  const query = useQuery({
    queryKey: ["admin-bookings", venueId, date, status],
    queryFn: () =>
      adminApi<Booking[]>(
        "/bookings?" + new URLSearchParams({ venueId, date, status }),
      ),
  });
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Every game, at a glance.</h2>
          <p>Confirmed and cancelled bookings across your venues.</p>
        </div>
        <span className="small-label">{query.data?.length || 0} bookings</span>
      </div>
      <div className="admin-filters">
        <label>
          Venue
          <select value={venueId} onChange={(e) => setVenue(e.target.value)}>
            <option value="">All venues</option>
            {venues.data?.map((v) => (
              <option value={v.id} key={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option>CONFIRMED</option>
            <option>CANCELLED</option>
          </select>
        </label>
        <button
          className="text-btn"
          onClick={() => {
            setVenue("");
            setDate("");
            setStatus("");
          }}
        >
          Reset
        </button>
      </div>
      <Status
        loading={query.isPending}
        error={query.error}
        retry={() => query.refetch()}
      />
      <div
        className="table-wrap content-transition"
        key={`${venueId}-${date}-${status}`}
      >
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Player</th>
              <th>Venue</th>
              <th>Date & time · IST</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.map((b) => (
              <tr key={b.reference}>
                <td className="reference">{b.reference}</td>
                <td>
                  <strong>{b.customer_name}</strong>
                  <small>{b.customer_phone}</small>
                </td>
                <td>{b.venue_name}</td>
                <td>
                  {dateLabel(b.date)}
                  <small>
                    {timeLabel(b.start_time)} – {timeLabel(b.end_time)}
                  </small>
                </td>
                <td>{money(b.amount)}</td>
                <td>
                  <span
                    className={
                      "status-badge " +
                      (b.status === "CANCELLED" ? "cancelled" : "")
                    }
                  >
                    {b.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.data?.length === 0 && (
          <div className="empty">
            <Ticket />
            <h3>No games here yet.</h3>
            <p>Bookings matching these filters will appear here.</p>
          </div>
        )}
      </div>
    </>
  );
}
