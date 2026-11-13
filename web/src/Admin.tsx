import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ArrowUpRight,
  Plus,
  X,
  LogOut,
  CalendarDays,
  Building2,
  Ticket,
  ChevronLeft,
  LockKeyhole,
  Pencil,
  Ban,
  Trash2,
} from "lucide-react";
import {
  adminApi,
  api,
  Venue,
  Slot,
  Booking,
  today,
  money,
  timeLabel,
  dateLabel,
} from "./api";
import { Status } from "./Status";
export default function Admin() {
  const [signed, setSigned] = useState(!!sessionStorage.getItem("hudle-admin"));
  const navigate = useNavigate();
  if (!signed) return <Login done={() => setSigned(true)} />;
  return (
    <main className="page admin-page">
      <div className="admin-top">
        <div>
          <span className="eyebrow green">THE OTHER SIDE OF THE GAME</span>
          <h1>Partner dashboard.</h1>
          <p>Great games start with well-run spaces.</p>
        </div>
        <button
          className="text-btn"
          onClick={() => {
            sessionStorage.removeItem("hudle-admin");
            setSigned(false);
            navigate("/admin");
          }}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
      <nav className="admin-nav">
        <Link to="/admin/venues">
          <Building2 size={16} />
          Venues & slots
        </Link>
        <Link to="/admin/bookings">
          <Ticket size={16} />
          All bookings
        </Link>
      </nav>
      <Routes>
        <Route index element={<Navigate to="venues" replace />} />
        <Route path="login" element={<Navigate to="/admin/venues" replace />} />
        <Route path="venues" element={<Venues />} />
        <Route path="venues/:id/slots" element={<Slots />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="*" element={<Navigate to="/admin/venues" replace />} />
      </Routes>
    </main>
  );
}
function Login({ done }: { done: () => void }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await api<{ token: string }>("/admin/login", {
        method: "POST",
        body: JSON.stringify({
          username: f.get("username"),
          password: f.get("password"),
        }),
      });
      sessionStorage.setItem("hudle-admin", r.token);
      done();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="page login-page">
      <form onSubmit={submit} className="booking-box">
        <span className="success-circle small">
          <LockKeyhole size={24} />
        </span>
        <span className="eyebrow green">FOR THE PEOPLE BEHIND THE PLAY</span>
        <h1>Welcome back.</h1>
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
          {pending ? "Signing in…" : "Sign in"}
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
function Venues() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-venues"],
    queryFn: () => adminApi<Venue[]>("/venues"),
  });
  const [editing, setEditing] = useState<Venue | null | undefined>(undefined);
  const [deactivate, setDeactivate] = useState<Venue | null>(null);
  const mutation = useMutation({
    mutationFn: (v: Venue) => adminApi("/venues/" + v.id, { method: "DELETE" }),
    onSuccess: () => {
      setDeactivate(null);
      client.invalidateQueries({ queryKey: ["admin-venues"] });
      client.invalidateQueries({ queryKey: ["venues"] });
      client.invalidateQueries({ queryKey: ["venue-filters"] });
    },
  });
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Your venues</h2>
          <p>Keep the lights on and the courts full.</p>
        </div>
        <button className="btn" onClick={() => setEditing(null)}>
          <Plus size={17} />
          Add venue
        </button>
      </div>
      <Status loading={query.isPending} error={query.error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Venue</th>
              <th>Sport</th>
              <th>Price / hour</th>
              <th>Status</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.map((v) => (
              <tr key={v.id}>
                <td>
                  <div className="table-venue">
                    <img src={v.image_url} alt="" />
                    <div>
                      <strong>{v.name}</strong>
                      <small>{v.location}</small>
                    </div>
                  </div>
                </td>
                <td>{v.sport}</td>
                <td>{money(v.price_per_hour)}</td>
                <td>
                  <span
                    className={
                      "status-badge " + (!v.is_active ? "cancelled" : "")
                    }
                  >
                    {v.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <Link
                      className="text-btn"
                      to={`/admin/venues/${v.id}/slots`}
                    >
                      <CalendarDays size={15} />
                      Slots
                    </Link>
                    <button
                      className="icon-btn"
                      title="Edit venue"
                      onClick={() => setEditing(v)}
                    >
                      <Pencil size={15} />
                    </button>
                    {!!v.is_active && (
                      <button
                        className="icon-btn danger"
                        title="Deactivate venue"
                        onClick={() => {
                          mutation.reset();
                          setDeactivate(v);
                        }}
                      >
                        <Ban size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing !== undefined && (
        <VenueForm venue={editing} close={() => setEditing(undefined)} />
      )}
      {deactivate && (
        <Modal
          title="Take this venue off sale?"
          close={() => setDeactivate(null)}
        >
          <p>
            {deactivate.name} will be hidden from discovery. Existing bookings
            will remain accessible.
          </p>
          {mutation.error && (
            <div className="notice error">{mutation.error.message}</div>
          )}
          <button
            className="btn full"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(deactivate)}
          >
            {mutation.isPending ? "Updating…" : "Deactivate venue"}
          </button>
        </Modal>
      )}
    </>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="modal wide"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="icon-btn modal-close"
          aria-label="Close"
          onClick={close}
        >
          <X />
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
function VenueForm({
  venue: v,
  close,
}: {
  venue: Venue | null;
  close: () => void;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: any) =>
      adminApi("/venues" + (v ? "/" + v.id : ""), {
        method: v ? "PUT" : "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin-venues"] });
      client.invalidateQueries({ queryKey: ["venues"] });
      client.invalidateQueries({ queryKey: ["venue-filters"] });
      client.invalidateQueries({ queryKey: ["venue"] });
      close();
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    mutation.mutate({
      ...Object.fromEntries(f),
      price_per_hour: Math.round(Number(f.get("price_per_hour")) * 100),
    });
  }
  return (
    <Modal title={v ? "Edit venue" : "A new place to play."} close={close}>
      <form onSubmit={submit} className="form-grid">
        <label>
          Venue name
          <input
            name="name"
            defaultValue={v?.name}
            required
            minLength={2}
            maxLength={150}
          />
        </label>
        <label>
          Sport
          <select name="sport" defaultValue={v?.sport}>
            {[
              "Badminton",
              "Football",
              "Tennis",
              "Basketball",
              "Cricket",
              "Swimming",
              "Table Tennis",
              "Pickleball",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Neighbourhood
          <input
            name="location"
            defaultValue={v?.location}
            required
            minLength={2}
            maxLength={100}
          />
        </label>
        <label>
          Price per hour (₹)
          <input
            name="price_per_hour"
            type="number"
            min="0"
            max="100000"
            step="0.01"
            defaultValue={v ? v.price_per_hour / 100 : 650}
            required
          />
        </label>
        <label className="span-2">
          Address
          <input
            name="address"
            defaultValue={v?.address}
            required
            minLength={5}
            maxLength={300}
          />
        </label>
        <label className="span-2">
          Description
          <textarea
            name="description"
            defaultValue={v?.description}
            maxLength={3000}
          />
        </label>
        <label className="span-2">
          Photo URL (HTTPS or bundled image)
          <input
            name="image_url"
            type="text"
            defaultValue={
              v?.image_url ||
              "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=85"
            }
            required
            pattern="(https://.*|/images/[a-z]+[.]jpg)"
          />
        </label>
        {mutation.error && (
          <div className="notice error span-2">{mutation.error.message}</div>
        )}
        <button className="btn span-2" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save venue"}
          <ArrowUpRight size={17} />
        </button>
      </form>
    </Modal>
  );
}
function Slots() {
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
    onSuccess: (r) => {
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
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      {message && (
        <div role="status" className="notice success">
          {message}
        </div>
      )}
      <Status loading={query.isPending} error={query.error} />
      {mutation.error && !removing && !repricing && (
        <div role="alert" className="notice error">
          {mutation.error.message}
        </div>
      )}
      <div className="table-wrap">
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
        <Modal
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
        </Modal>
      )}
      {removing && (
        <Modal title="Delete this slot?" close={() => setRemoving(null)}>
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
        </Modal>
      )}
      {repricing && (
        <Modal title="Update slot price" close={() => setRepricing(null)}>
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
        </Modal>
      )}
    </>
  );
}
function Bookings() {
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
      <Status loading={query.isPending} error={query.error} />
      <div className="table-wrap">
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
