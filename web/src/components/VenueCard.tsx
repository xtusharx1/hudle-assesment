import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin, Star, Heart } from "lucide-react";
import { Venue, money } from "../api";
import { VenueImage } from "../VenueImage";
import { favouriteIds } from "../favourites";
import { sportIcons } from "../lib/sports";

export function VenueCard({
  venue: v,
  index,
}: {
  venue: Venue;
  index: number;
}) {
  const [liked, setLiked] = useState(() => {
    try {
      return favouriteIds(localStorage.getItem("hudle-favourites")).includes(
        v.id,
      );
    } catch {
      return false;
    }
  });
  function like() {
    setLiked(!liked);
    let a: number[];
    try {
      a = favouriteIds(localStorage.getItem("hudle-favourites"));
    } catch {
      a = [];
    }
    try {
      localStorage.setItem(
        "hudle-favourites",
        JSON.stringify(liked ? a.filter((id) => id !== v.id) : [...a, v.id]),
      );
    } catch {
      setLiked(liked);
    }
  }
  return (
    <article className="venue-card">
      <div className="card-photo">
        <Link to={"/venues/" + v.id} tabIndex={-1}>
          <VenueImage
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
          {v.rating != null && (
            <span className="rating">
              <Star size={12} fill="currentColor" />
              {v.rating}
            </span>
          )}
        </div>
        <p>
          <MapPin size={13} />
          {v.location}
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
