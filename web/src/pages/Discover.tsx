import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Search,
  SlidersHorizontal,
  CalendarDays,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import { api, Venue } from "../api";
import { Status } from "../Status";
import { VenueCard } from "../components/VenueCard";
import { sportIcons } from "../lib/sports";
import { sportImages } from "../lib/sports";

export function Discover() {
  const [params, setParams] = useSearchParams();
  const sport = params.get("sport") || "All sports";
  const search = params.get("q") || "";
  const location = params.get("location") || "";
  const sort = ["price", "rating"].includes(params.get("sort") || "")
    ? params.get("sort")!
    : "recommended";
  const [q, setQ] = useState(search);
  const [filters, setFilters] = useState(false);
  useEffect(() => setQ(search), [search]);
  function updateFilter(key: string, value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (!value || value === "All sports" || value === "recommended")
          next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }
  const setSport = (value: string) => updateFilter("sport", value);
  const setLocation = (value: string) => updateFilter("location", value);
  const setSort = (value: string) => updateFilter("sort", value);
  const setSearch = (value: string) => updateFilter("q", value);
  const clearFilters = () => {
    setParams({}, { replace: true });
    setQ("");
  };
  const {
    data: venues,
    error,
    isPending,
    refetch,
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
              setSearch(q.trim());
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
                  aria-label="Search venues, sports or neighbourhoods"
                  placeholder="Venue, sport or neighbourhood"
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
                <option value="">All locations</option>
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
            <MapPin size={15} /> Explore available locations
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
            <button className="text-btn" onClick={clearFilters}>
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
        <Status error={error} loading={isPending} retry={() => refetch()} />
        {venues?.length === 0 && (
          <div className="empty">
            <Search size={36} />
            <h3>No courts on this side of town.</h3>
            <p>Try another sport or clear your filters.</p>
            <button className="btn" onClick={clearFilters}>
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
