import { useState, useEffect, useRef, FormEvent } from "react";
import {
  Link,
  NavLink,
  Routes,
  Route,
  useParams,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  Heart,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ShieldCheck,
  X,
  Ticket,
  Plus,
  Wind,
  Car,
  Droplets,
  CheckCircle2,
  Menu,
  Activity,
} from "lucide-react";
import {
  api,
  Venue,
  Slot,
  Booking,
  money,
  today,
  dateLabel,
  timeLabel,
} from "./api";
import { AuthPage, RequireUser, useAuth } from "./Auth";
import { ProfileMenu, ProfilePage } from "./Account";
import Admin from "./Admin";
import { Status } from "./Status";
import { BookingPending } from "./BookingPending";
import { defaultBookingDate } from "./booking-date";
const sportIcons: Record<string, string> = {
  "All sports": "✳",
  Badminton: "↗",
  Football: "⚽",
  Tennis: "◉",
  Pickleball: "◈",
  Basketball: "◍",
  Cricket: "╱",
  Swimming: "≈",
  "Table Tennis": "◒",
};
const sportImages: Record<string, string> = {
  Badminton: "/images/badminton.jpg",
  Football: "/images/football.jpg",
  Tennis: "/images/tennis.jpg",
  Pickleball: "/images/tennis.jpg",
  Basketball: "/images/basketball.jpg",
  Cricket: "/images/cricket.jpg",
  Swimming: "/images/swimming.jpg",
  "Table Tennis": "/images/tabletennis.jpg",
};
function RouteScroll() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
export default function App() {
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <RouteScroll />
      <header className="header">
        <Link to="/" className="logo" aria-label="Hudle home">
          HUDLE<span>↗</span>
        </Link>
        <nav className={menu ? "nav open" : "nav"}>
          <NavLink to="/" end onClick={() => setMenu(false)}>
            Discover venues
          </NavLink>
          <NavLink to="/my-bookings" onClick={() => setMenu(false)}>
            My bookings
          </NavLink>
        </nav>
        <div className="header-right">
          <ProfileMenu />
          <span className="city">
            <MapPin size={15} /> Delhi NCR
          </span>
          <Link className="admin-link" to="/admin">
            For venue partners <ArrowUpRight size={15} />
          </Link>
          <button
            className="mobile-menu icon-btn"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
        </div>
      </header>
      <div className="route-transition" key={location.pathname}>
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/venues/:id" element={<VenueDetails />} />
          <Route
            path="/booking/:reference"
            element={
              <RequireUser>
                <Confirmation />
              </RequireUser>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <RequireUser>
                <MyBookings />
              </RequireUser>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireUser>
                <ProfilePage />
              </RequireUser>
            }
          />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage register />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route
            path="*"
            element={
              <main className="page empty">
                <h1>Out of bounds.</h1>
                <Link className="btn" to="/">
                  Back to discovery
                </Link>
              </main>
            }
          />
        </Routes>
      </div>
      <footer>
        <Link to="/" className="logo">
          HUDLE<span>↗</span>
        </Link>
        <span>A little less scrolling. A lot more playing.</span>
        <small>
          Made for the love of the game. © {new Date().getFullYear()}
        </small>
      </footer>
    </>
  );
}
function Discover() {
  const [sport, setSport] = useState("All sports");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [filters, setFilters] = useState(false);
  const [sort, setSort] = useState("recommended");
  const {
    data: venues,
    error,
    isPending,
  } = useQuery({
    queryKey: ["venues", sport, search, location],
    queryFn: () =>
      api<Venue[]>(
        "/venues?" +
          new URLSearchParams({
            ...(sport !== "All sports" ? { sport } : {}),
            q: search,
            location,
          }),
      ),
  });
  const { data: filterOptions } = useQuery({
    queryKey: ["venue-filters"],
    queryFn: () =>
      api<{ sports: string[]; locations: string[] }>("/venue-filters"),
  });
  const sports = ["All sports", ...(filterOptions?.sports || [])];
  const locations = filterOptions?.locations || [];
  const sorted = [...(venues || [])].sort((a, b) =>
    sort === "price"
      ? a.price_per_hour - b.price_per_hour
      : sort === "rating"
        ? Number(b.rating) - Number(a.rating)
        : a.id - b.id,
  );
  return (
    <>
      <section className="hero brand-hero">
        <img
          className="brand-hero-image"
          src="/images/tennis.jpg"
          alt="A tennis player serving on a sunlit court"
        />
        <div className="brand-hero-shade" />
        <div className="brand-hero-content">
          <span className="eyebrow">
            <span className="live-dot" /> WHERE YOUR NEXT GAME BEGINS
          </span>
          <h1>
            Find your sport.
            <br />
            <span>Make it a game.</span>
          </h1>
          <p>
            Discover great places to play. Book your time. Bring your people.
          </p>
          <form
            className="brand-search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q);
              document
                .getElementById("venues")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <label className="brand-search-name">
              <span>FIND A VENUE</span>
              <div>
                <Search size={18} />
                <input
                  aria-label="Search venues or neighbourhoods"
                  placeholder="Venue or neighbourhood"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </label>
            <label>
              <span>YOUR SPORT</span>
              <select
                aria-label="Search sport"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
              >
                {sports.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span>NEIGHBOURHOOD</span>
              <select
                aria-label="Search neighbourhood"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="">All Delhi NCR</option>
                {locations.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <button className="btn">
              Find venues <ArrowRight size={19} />
            </button>
          </form>
          <div className="brand-hero-promises">
            <span>
              <ShieldCheck size={15} />
              Instant confirmation
            </span>
            <span>
              <CalendarDays size={15} />
              Easy cancellations
            </span>
            <span>
              <MapPin size={15} />
              {locations.length} neighbourhoods. Your next game.
            </span>
          </div>
        </div>
        <span className="brand-hero-caption">
          MORE SPORT. MORE CONNECTION. MORE YOU.
        </span>
      </section>
      <div className="ticker">
        <span>MORE PLAY. MORE LIFE.</span>
        <i>✳</i>
        <span>FIND YOUR PEOPLE</span>
        <i>✳</i>
        <span>MAKE THE NEXT MOVE</span>
        <i>✳</i>
        <span>YOUR CITY. YOUR COURT.</span>
        <i>✳</i>
        <span>MORE PLAY. MORE LIFE.</span>
      </div>
      <main id="venues" className="page discovery">
        <div className="section-heading">
          <div>
            <span className="eyebrow green">EXPLORE. BOOK. PLAY.</span>
            <h2>Where do you want to play?</h2>
            <p>Find a sport you love. Discover a place to play it.</p>
          </div>
          <span className="small-label">
            <MapPin size={15} /> In and around Delhi NCR
          </span>
        </div>
        <div className="sport-bar">
          <div className="sport-tabs" role="group" aria-label="Filter by sport">
            {sports.map((s) => (
              <button
                key={s}
                className={"sport-tab " + (s === sport ? "selected" : "")}
                onClick={() => setSport(s)}
                aria-pressed={s === sport}
              >
                {s !== "All sports" && (
                  <img src={sportImages[s] || "/images/tennis.jpg"} alt="" />
                )}
                <span className="sport-tab-label">
                  <span>{sportIcons[s] || "✳"}</span>
                  {s}
                </span>
              </button>
            ))}
          </div>
          <button
            className={"filter-btn " + (filters ? "selected" : "")}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={16} />
            Filters{location && <span className="live-dot" />}
          </button>
        </div>
        {filters && (
          <div className="filter-panel">
            <label>
              Neighbourhood
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="">All neighbourhoods</option>
                {locations.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <button
              className="text-btn"
              onClick={() => {
                setLocation("");
                setSport("All sports");
                setSearch("");
                setQ("");
              }}
            >
              Reset filters
            </button>
          </div>
        )}
        <div className="results-bar">
          <span>
            <strong>{venues?.length || 0} venues</strong> to make your next move
            {search && (
              <>
                {" "}
                · “{search}”{" "}
                <button
                  className="text-btn"
                  onClick={() => {
                    setSearch("");
                    setQ("");
                  }}
                >
                  Clear
                </button>
              </>
            )}
          </span>
          <label>
            Sort by{" "}
            <select
              aria-label="Sort venues"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recommended">Recommended</option>
              <option value="price">Price: low to high</option>
              <option value="rating">Top rated</option>
            </select>
          </label>
        </div>
        <Status error={error} loading={isPending} />
        {venues?.length === 0 && (
          <div className="empty">
            <Search size={36} />
            <h3>No courts on this side of town.</h3>
            <p>Try another sport or clear your filters.</p>
            <button
              className="btn"
              onClick={() => {
                setSport("All sports");
                setLocation("");
                setSearch("");
                setQ("");
              }}
            >
              Explore all venues
            </button>
          </div>
        )}
        <div
          className="venue-grid content-transition"
          key={`${sport}-${search}-${location}-${sort}`}
        >
          {sorted.map((v, i) => (
            <VenueCard key={v.id} venue={v} index={i} />
          ))}
        </div>
        <section className="play-banner">
          <span className="banner-icon">✳</span>
          <div>
            <span className="eyebrow">
              THE BEST PART OF YOUR DAY IS OUT THERE.
            </span>
            <h2>Make room for a little more play.</h2>
            <p>One court. Your favourite people. A plan worth keeping.</p>
          </div>
          <a href="#venues" className="btn lime">
            Find your game <ArrowUpRight size={19} />
          </a>
        </section>
        <div className="promise-row">
          <span>
            <ShieldCheck /> Secure bookings
          </span>
          <span>
            <Clock3 /> Real-time availability
          </span>
          <span>
            <CalendarDays /> Easy cancellations
          </span>
        </div>
      </main>
    </>
  );
}
function VenueCard({ venue: v, index }: { venue: Venue; index: number }) {
  const [liked, setLiked] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("hudle-favourites") || "[]",
      ).includes(v.id);
    } catch {
      return false;
    }
  });
  function like() {
    setLiked(!liked);
    let a: number[];
    try {
      a = JSON.parse(localStorage.getItem("hudle-favourites") || "[]");
    } catch {
      a = [];
    }
    localStorage.setItem(
      "hudle-favourites",
      JSON.stringify(liked ? a.filter((id) => id !== v.id) : [...a, v.id]),
    );
  }
  return (
    <article className="venue-card">
      <div className="card-photo">
        <Link to={"/venues/" + v.id} tabIndex={-1}>
          <img
            src={v.image_url}
            alt={`${v.sport} court at ${v.name}`}
            loading="lazy"
          />
        </Link>
        <span className="sport-badge">
          {sportIcons[v.sport]} {v.sport}
        </span>
        <button
          onClick={like}
          className={"heart-btn " + (liked ? "liked" : "")}
          aria-label={`${liked ? "Unsave" : "Save"} ${v.name}`}
          aria-pressed={liked}
        >
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
        </button>
        {index === 0 && (
          <span className="card-tag">
            A local favourite <span>↗</span>
          </span>
        )}
      </div>
      <div className="card-info">
        <div className="card-title">
          <Link to={"/venues/" + v.id}>
            <h3>{v.name}</h3>
          </Link>
          <span className="rating">
            <Star size={12} fill="currentColor" />
            {v.rating}
          </span>
        </div>
        <p>
          <MapPin size={13} />
          {v.location}, Delhi NCR
        </p>
        <div className="card-bottom">
          <span>
            <strong>{money(v.price_per_hour)}</strong>
            <small> / hour</small>
          </span>
          <Link to={"/venues/" + v.id} aria-label={`Book ${v.name}`}>
            View venue <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
function VenueDetails() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const requestedDate = params.get("date");
  const initialDate =
    requestedDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    requestedDate >= today()
      ? requestedDate
      : today();
  const restoredSlot = useRef(false);
  const [date, setDate] = useState(initialDate);
  const [dateWasChosen, setDateWasChosen] = useState(false);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    setDate(initialDate);
    setDateWasChosen(Boolean(requestedDate));
    restoredSlot.current = false;
  }, [id]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const [selected, setSelected] = useState<Slot | null>(null);
  const {
    data: v,
    isPending,
    error,
  } = useQuery({
    queryKey: ["venue", id],
    queryFn: () => api<Venue>("/venues/" + id),
  });
  const slots = useQuery({
    queryKey: ["slots", id, date],
    queryFn: () => api<Slot[]>(`/venues/${id}/slots?date=${date}`),
    refetchInterval: 15000,
  });
  useEffect(() => {
    if (!dateWasChosen && slots.data && !slots.isFetching) {
      const next = defaultBookingDate(date, slots.data, clock);
      if (next !== date) setDate(next);
    }
  }, [date, dateWasChosen, slots.data, slots.isFetching, clock]);
  const dates = Array.from({ length: 14 }, (_, i) =>
    new Date(Date.parse(today()) + i * 86400000).toISOString().slice(0, 10),
  );
  useEffect(() => setSelected(null), [date]);
  useEffect(() => {
    if (!restoredSlot.current && slots.data) {
      const match = slots.data.find(
        (s) =>
          s.id === Number(params.get("slot")) && s.availability === "AVAILABLE",
      );
      if (match) setSelected(match);
      restoredSlot.current = true;
    }
  }, [slots.data, params]);
  const amenities = v
    ? (typeof v.amenities === "string"
        ? JSON.parse(v.amenities)
        : v.amenities) || ["Parking", "Drinking water"]
    : [];
  return (
    <main className="page details">
      <Link to="/" className="back-link">
        <ChevronLeft size={16} />
        All venues
      </Link>
      <Status error={error} loading={isPending} />
      {v && (
        <>
          <div className="detail-heading">
            <div>
              <span className="eyebrow green">
                {v.sport.toUpperCase()} · DELHI NCR
              </span>
              <h1>{v.name}</h1>
              <p>
                <MapPin size={16} />
                {v.address}
              </p>
            </div>
            <span className="rating large">
              <Star size={17} fill="currentColor" />
              {v.rating}
              <small>Venue rating</small>
            </span>
          </div>
          <div className="detail-photo">
            <img src={v.image_url} alt={v.name} />
            <span className="photo-chip">
              <ShieldCheck size={15} /> Your next favourite place to play
            </span>
          </div>
          <div className="detail-layout">
            <section>
              <h2>A good game starts here.</h2>
              <p className="description">{v.description}</p>
              <div className="amenities">
                {amenities.map((a: string, i: number) => (
                  <span key={a}>
                    {i === 0 ? (
                      <Car size={18} />
                    ) : i === 1 ? (
                      <Droplets size={18} />
                    ) : (
                      <Wind size={18} />
                    )}{" "}
                    {a}
                  </span>
                ))}
              </div>
              <div className="booking-section">
                <div className="section-heading">
                  <div>
                    <h2>Pick your playtime.</h2>
                    <p>All times in India Standard Time (IST).</p>
                  </div>
                  <span className="availability-dot">Live availability</span>
                </div>
                <div className="dates">
                  {dates.map((d, i) => (
                    <button
                      key={d}
                      className={
                        "date-button " + (d === date ? "selected" : "")
                      }
                      onClick={() => {
                        setDateWasChosen(true);
                        setDate(d);
                      }}
                    >
                      <small>
                        {i === 0 ? "Today" : dateLabel(d, { weekday: "short" })}
                      </small>
                      <strong>{dateLabel(d, { day: "2-digit" })}</strong>
                      <small>{dateLabel(d, { month: "short" })}</small>
                    </button>
                  ))}
                </div>
                <div className="slots-legend">
                  <span>
                    <i />
                    Available
                  </span>
                  <span>
                    <i className="chosen" />
                    Selected
                  </span>
                  <span>
                    <i className="unavailable" />
                    Unavailable
                  </span>
                </div>
                <Status loading={slots.isPending} error={slots.error} />
                <div className="slots-grid content-transition" key={date}>
                  {slots.data?.map((s) => (
                    <button
                      key={s.id}
                      disabled={s.availability !== "AVAILABLE"}
                      className={
                        "slot " + (s.id === selected?.id ? "selected" : "")
                      }
                      onClick={() => setSelected(s)}
                    >
                      <strong>{timeLabel(s.start_time)}</strong>
                      <small>
                        {s.availability === "AVAILABLE"
                          ? money(s.price)
                          : s.availability.toLowerCase()}
                      </small>
                    </button>
                  ))}
                </div>
                {slots.data?.length === 0 && (
                  <div className="notice">
                    No slots have been added for this date. Try another day.
                  </div>
                )}
              </div>
              <div className="good-to-know">
                <ShieldCheck size={23} />
                <div>
                  <h3>A little peace of mind.</h3>
                  <p>
                    Cancel free before your slot starts. Your booking is
                    confirmed instantly, and your court is reserved just for
                    you.
                  </p>
                </div>
              </div>
            </section>
            <aside className="booking-sidebar">
              <BookingForm
                venue={v}
                slot={selected}
                date={date}
                onConflict={() => {
                  setSelected(null);
                  slots.refetch();
                }}
              />
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
function BookingForm({
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
  const { user, loading } = useAuth();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slot || !user || submitting.current) return;
    submitting.current = true;
    setError("");
    setPending(true);
    // Send immediately; keep the visual transition on screen for at least two seconds.
    // allSettled also preserves the animation duration for failed requests.
    const request = api<Booking>("/bookings", {
      method: "POST",
      body: JSON.stringify({
        slotId: slot.id,
      }),
    });
    try {
      const [result] = await Promise.allSettled([
        request,
        new Promise<void>((resolve) => window.setTimeout(resolve, 2000)),
      ]);
      if (result.status === "rejected") throw result.reason;
      client.invalidateQueries({ queryKey: ["slots"] });
      client.invalidateQueries({ queryKey: ["my-bookings"] });
      navigate("/booking/" + result.value.reference);
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
      {user ? (
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
function useBooking(ref: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["booking", user?.id, ref],
    queryFn: () => api<Booking>("/bookings/" + ref),
    retry: false,
  });
}

function Confirmation() {
  const { reference = "" } = useParams();
  const { data: b, error, isPending } = useBooking(reference);
  return (
    <main className="page confirmation">
      <Status error={error} loading={isPending} />
      {b && (
        <>
          <span className="success-circle">
            <Check size={34} />
          </span>
          <span className="eyebrow green">IT'S OFFICIAL. YOU'RE PLAYING.</span>
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
function MyBookings() {
  const { user } = useAuth();
  const [tab, setTab] = useState("upcoming");
  const query = useQuery({
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
    new Date(`${b.date}T${b.start_time}+05:30`).getTime() > Date.now();
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
      <div className="tabs">
        <button
          className={tab === "upcoming" ? "active" : ""}
          onClick={() => setTab("upcoming")}
        >
          Upcoming games{" "}
          <span>{query.data?.bookings.filter(isUpcoming).length || 0}</span>
        </button>
        <button
          className={tab === "past" ? "active" : ""}
          onClick={() => setTab("past")}
        >
          Past & cancelled
        </button>
      </div>
      <div className="content-transition" key={tab}>
        <Status loading={query.isPending} error={query.error} />
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
              <img src={b.image_url} alt={b.venue_name} />
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
                  <Link to={"/venues/" + b.venue_id} className="text-btn">
                    Play again <ArrowUpRight size={15} />
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
        <div
          className="modal-backdrop"
          onClick={() => !mutation.isPending && setCancel(null)}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-btn"
              aria-label="Close"
              onClick={() => setCancel(null)}
            >
              <X />
            </button>
            <CalendarDays size={30} />
            <h2 id="cancel-title">Change of plans?</h2>
            <p>
              Cancel your game at {cancel.venue_name} on{" "}
              {dateLabel(cancel.date)}? Your slot will be released for someone
              else.
            </p>
            {mutation.error && (
              <div className="notice error" role="alert">
                {mutation.error.message}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setCancel(null)}>
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
          </section>
        </div>
      )}
    </main>
  );
}
