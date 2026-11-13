import { venueAmenities } from "../lib/venue";
import { useState, useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  Star,
  ChevronLeft,
  ShieldCheck,
  Wind,
  Car,
  Droplets,
} from "lucide-react";
import { api, Venue, Slot, money, today, dateLabel, timeLabel } from "../api";
import { bookingDate } from "../format";
import { useNow } from "../useNow";
import { VenueImage } from "../VenueImage";
import { Status } from "../Status";
import { defaultBookingDate } from "../booking-date";
import { BookingForm } from "./BookingForm";

export function VenueDetails() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const requestedDate = params.get("date");
  const initialDate = bookingDate(requestedDate);
  const restoredSlot = useRef(false);
  const [date, setDate] = useState(initialDate);
  const [dateWasChosen, setDateWasChosen] = useState(false);
  const clock = useNow();
  useEffect(() => {
    setDate(initialDate);
    setDateWasChosen(requestedDate === initialDate);
    restoredSlot.current = false;
  }, [id]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const {
    data: v,
    isPending,
    error,
    refetch,
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
  const availableSelected =
    (selected &&
      slots.data?.find(
        (s) =>
          s.id === selected.id &&
          s.availability === "AVAILABLE" &&
          new Date(`${s.date}T${s.start_time}+05:30`).getTime() > clock,
      )) ||
    null;
  const amenities = venueAmenities(v?.amenities);
  return (
    <main className="page details">
      <Link to="/" className="back-link">
        <ChevronLeft size={16} />
        All venues
      </Link>
      <Status error={error} loading={isPending} retry={() => refetch()} />
      {v && (
        <>
          <div className="detail-heading">
            <div>
              <span className="eyebrow green">
                {v.sport.toUpperCase()} · {v.location}
              </span>
              <h1>{v.name}</h1>
              <p>
                <MapPin size={16} />
                {v.address}
              </p>
            </div>
            {v.rating != null && (
              <span className="rating large">
                <Star size={17} fill="currentColor" />
                {v.rating}
                <small>Venue rating</small>
              </span>
            )}
          </div>
          <div className="detail-photo">
            <VenueImage src={v.image_url} alt={v.name} />
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
                <label className="booking-date-picker">
                  Booking date
                  <input
                    type="date"
                    aria-label="Booking date"
                    min={today()}
                    value={date}
                    onChange={(event) => {
                      const chosen = bookingDate(event.target.value);
                      if (chosen === event.target.value) {
                        setDateWasChosen(true);
                        setDate(chosen);
                      }
                    }}
                  />
                </label>
                <div className="dates">
                  {dates.map((d, i) => (
                    <button
                      key={d}
                      aria-pressed={d === date}
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
                <Status
                  loading={slots.isPending}
                  error={slots.error}
                  retry={() => slots.refetch()}
                />
                <div className="slots-grid content-transition" key={date}>
                  {slots.data?.map((s) => (
                    <button
                      key={s.id}
                      aria-pressed={s.id === availableSelected?.id}
                      disabled={s.availability !== "AVAILABLE"}
                      className={
                        "slot " +
                        (s.id === availableSelected?.id ? "selected" : "")
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
                slot={availableSelected}
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
