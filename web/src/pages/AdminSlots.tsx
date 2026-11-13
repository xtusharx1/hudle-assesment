import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Plus, CalendarDays, ChevronLeft, Pencil, Trash2 } from "lucide-react";
import {
  adminApi,
  Venue,
  Slot,
  today,
  money,
  timeLabel,
  dateLabel,
} from "../api";
import { Status } from "../Status";
import { AdminModal } from "../components/AdminModal";

export function AdminSlots() {
  const { id } = useParams();
  const [date, setDate] = useState(today());
  const [form, setForm] = useState<"single" | "bulk" | null>(null);
  const [message, setMessage] = useState("");
  const [removing, setRemoving] = useState<Slot | null>(null);
  const [repricing, setRepricing] = useState<Slot | null>(null);
  const client = useQueryClient();
  const venues = useQuery({
    queryKey: ["admin-venues"],
    queryFn: () => adminApi<Venue[]>("/venues"),
  });
  const venue = venues.data?.find((v) => String(v.id) === id);
  const query = useQuery({
    queryKey: ["admin-slots", id, date],
    queryFn: () => adminApi<Slot[]>(`/venues/${id}/slots?date=${date}`),
  });
  const invalidate = () => {
    client.invalidateQueries({ queryKey: ["admin-slots"] });
    client.invalidateQueries({ queryKey: ["slots"] });
  };
  const mutation = useMutation({
    mutationFn: ({
      slot,
      remove,
      price,
    }: {
      slot: Slot;
      remove?: boolean;
      price?: number;
    }) =>
      adminApi("/slots/" + slot.id, {
        method: remove ? "DELETE" : "PATCH",
        ...(!remove
          ? {
              body: JSON.stringify(
                price !== undefined
                  ? { price }
                  : { is_blocked: !slot.is_blocked },
              ),
            }
          : {}),
      }),
    onSuccess: () => {
      invalidate();
      setRemoving(null);
      setRepricing(null);
    },
  });
  const generate = useMutation({
    mutationFn: ({ path, body }: { path: string; body: any }) =>
      adminApi<{ created?: number; skipped?: number }>(
        `/venues/${id}/slots${path}`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: (r, variables) => {
      setDate(variables.body.from || variables.body.date);
      setForm(null);
      invalidate();
      setMessage(
        r.created !== undefined
          ? `${r.created} slots created · ${r.skipped} overlapping or past slots skipped.`
          : "Slot added. Ready for a game.",
      );
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (form === "bulk")
      generate.mutate({
        path: "/generate",
        body: { ...Object.fromEntries(f), duration: Number(f.get("duration")) },
      });
    else
      generate.mutate({
        path: "",
        body: {
          ...Object.fromEntries(f),
          price: Math.round(Number(f.get("price")) * 100),
        },
      });
  }
  return (
    <>
      <Link className="back-link" to="/admin/venues">
        <ChevronLeft size={15} />
        All venues
      </Link>
      <div className="section-heading">
        <div>
          <h2>{venue?.name || "Venue slots"}</h2>
          <p>Add playtimes, update prices, and manage availability.</p>
        </div>
        <div className="table-actions">
          <button
            className="btn secondary"
            onClick={() => {
              generate.reset();
              setForm("single");
            }}
          >
            <Plus size={15} />
            Add slot
          </button>
          <button
            className="btn"
            onClick={() => {
              generate.reset();
              setForm("bulk");
            }}
          >
            Generate slots <CalendarDays size={16} />
          </button>
        </div>
      </div>
      <label className="date-input">
        Date
        <input
          aria-label="Slot date"
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
        />
      </label>
      {message && (
        <div role="status" className="notice success">
          {message}
        </div>
      )}
      <Status
        loading={query.isPending}
        error={query.error}
        retry={() => query.refetch()}
      />
      {mutation.error && !removing && !repricing && (
        <div role="alert" className="notice error">
          {mutation.error.message}
        </div>
      )}
      <div className="table-wrap content-transition" key={date}>
        <table>
          <thead>
            <tr>
              <th>Time · IST</th>
              <th>Price</th>
              <th>Availability</th>
              <th>Booking</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>
                    {timeLabel(s.start_time)} – {timeLabel(s.end_time)}
                  </strong>
                </td>
                <td>{money(s.price)}</td>
                <td>
                  <span
                    className={
                      "status-badge " +
                      (s.availability !== "AVAILABLE" ? "cancelled" : "")
                    }
                  >
                    {s.availability}
                  </span>
                </td>
                <td>{s.booking_reference || "—"}</td>
                <td>
                  <div className="table-actions">
                    <button
                      className="icon-btn"
                      title="Change slot price"
                      onClick={() => {
                        mutation.reset();
                        setRepricing(s);
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="text-btn"
                      disabled={
                        s.availability === "BOOKED" || mutation.isPending
                      }
                      onClick={() => {
                        mutation.reset();
                        mutation.mutate({ slot: s });
                      }}
                    >
                      {s.is_blocked ? "Unblock" : "Block"}
                    </button>
                    <button
                      className="icon-btn danger"
                      title="Delete slot"
                      disabled={s.availability === "BOOKED"}
                      onClick={() => {
                        mutation.reset();
                        setRemoving(s);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.data?.length === 0 && (
          <div className="empty">
            <CalendarDays />
            <h3>A clear calendar.</h3>
            <p>Add a slot or generate a whole day's play.</p>
          </div>
        )}
      </div>
      {form && (
        <AdminModal
          busy={generate.isPending}
          title={form === "bulk" ? "Fill the calendar." : "Add a playtime."}
          close={() => setForm(null)}
        >
          <form className="form-grid" onSubmit={submit}>
            {form === "bulk" ? (
              <>
                <label>
                  From
                  <input
                    name="from"
                    type="date"
                    min={today()}
                    defaultValue={date}
                    required
                  />
                </label>
                <label>
                  To
                  <input
                    name="to"
                    type="date"
                    min={today()}
                    defaultValue={date}
                    required
                  />
                </label>
                <label>
                  Opening time
                  <input
                    name="opens"
                    type="time"
                    defaultValue="06:00"
                    required
                  />
                </label>
                <label>
                  Closing time
                  <input
                    name="closes"
                    type="time"
                    defaultValue="23:00"
                    required
                  />
                </label>
                <label className="span-2">
                  Slot length
                  <select name="duration">
                    <option value="60">60 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">120 minutes</option>
                  </select>
                </label>
                <p className="browser-note span-2">
                  Up to 31 days. Overlapping and past slots are skipped. Prices
                  follow the venue's hourly rate.
                </p>
              </>
            ) : (
              <>
                <label className="span-2">
                  Date
                  <input
                    name="date"
                    type="date"
                    min={today()}
                    defaultValue={date}
                    required
                  />
                </label>
                <label>
                  Starts
                  <input name="start_time" type="time" required />
                </label>
                <label>
                  Ends
                  <input name="end_time" type="time" required />
                </label>
                <label className="span-2">
                  Price (₹)
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={(venue?.price_per_hour || 65000) / 100}
                    required
                  />
                </label>
              </>
            )}
            {generate.error && (
              <div className="notice error span-2">
                {generate.error.message}
              </div>
            )}
            <button className="btn span-2" disabled={generate.isPending}>
              {generate.isPending
                ? "Creating…"
                : form === "bulk"
                  ? "Generate slots"
                  : "Add slot"}
              <Plus size={16} />
            </button>
          </form>
        </AdminModal>
      )}
      {removing && (
        <AdminModal
          busy={mutation.isPending}
          title="Delete this slot?"
          close={() => setRemoving(null)}
        >
          <p>
            {dateLabel(date)} · {timeLabel(removing.start_time)}. Slots with
            booking history cannot be deleted.
          </p>
          {mutation.error && (
            <div className="notice error">{mutation.error.message}</div>
          )}
          <button
            className="btn full"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ slot: removing, remove: true })}
          >
            Delete slot
          </button>
        </AdminModal>
      )}
      {repricing && (
        <AdminModal
          busy={mutation.isPending}
          title="Update slot price"
          close={() => setRepricing(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({
                slot: repricing,
                price: Math.round(
                  Number(new FormData(e.currentTarget).get("price")) * 100,
                ),
              });
            }}
          >
            <label>
              New price (₹)
              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                max="100000"
                defaultValue={repricing.price / 100}
                required
              />
            </label>
            <p>Existing bookings keep their original price.</p>
            {mutation.error && (
              <div className="notice error">{mutation.error.message}</div>
            )}
            <button className="btn full" disabled={mutation.isPending}>
              Save price
            </button>
          </form>
        </AdminModal>
      )}
    </>
  );
}
