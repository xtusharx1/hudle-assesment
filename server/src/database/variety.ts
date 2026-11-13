import { DataSource } from "typeorm";
import { today } from "../time";
// Fictional assessment data. This batch runs once and never rewrites admin changes.
export const varietyVenues = [
  {
    name: "Shuttle Society",
    sport: "Badminton",
    location: "Rohini",
    address: "Sector 9, Rohini, New Delhi",
    description:
      "A bright indoor wooden court for early birds and after-work doubles. Bring your regular partner or make a new rally ritual.",
    image: "badminton",
    price: 45000,
    rating: 4.6,
    amenities: ["Indoor court", "Equipment rental", "Drinking water"],
    opens: 6,
    closes: 22,
    duration: 60,
  },
  {
    name: "Smash Studio",
    sport: "Badminton",
    location: "Noida",
    address: "Sector 50, Noida",
    description:
      "A premium indoor badminton space with a cushioned surface, clear lighting and room to reset between rallies.",
    image: "badminton",
    price: 85000,
    rating: 4.9,
    amenities: ["Air cooling", "Changing rooms", "Parking"],
    opens: 7,
    closes: 23,
    duration: 60,
  },
  {
    name: "Sunday League Turf",
    sport: "Football",
    location: "Janakpuri",
    address: "District Centre, Janakpuri, New Delhi",
    description:
      "A neighbourhood five-a-side pitch built for quick passes and long-running rivalries. The evening lights are waiting.",
    image: "football",
    price: 140000,
    rating: 4.5,
    amenities: ["Floodlights", "Drinking water", "Parking"],
    opens: 7,
    closes: 23,
    duration: 60,
  },
  {
    name: "Touchline 90",
    sport: "Football",
    location: "Faridabad",
    address: "Sector 15, Faridabad",
    description:
      "Make a full match of it. A spacious turf with 90-minute sessions for teams who want time to settle into the game.",
    image: "football",
    price: 240000,
    rating: 4.7,
    amenities: ["Floodlights", "Changing rooms", "Equipment rental"],
    opens: 6,
    closes: 21,
    duration: 90,
  },
  {
    name: "Clay & Co.",
    sport: "Tennis",
    location: "Defence Colony",
    address: "D Block, Defence Colony, New Delhi",
    description:
      "Slow the game down on an open-air clay court. Morning practice, friendly sets and a little sunshine come naturally here.",
    image: "tennis",
    price: 110000,
    rating: 4.8,
    amenities: ["Outdoor court", "Equipment rental", "Changing rooms"],
    opens: 6,
    closes: 21,
    duration: 60,
  },
  {
    name: "Pickle People",
    sport: "Pickleball",
    location: "Gurugram",
    address: "Sector 43, Gurugram",
    description:
      "Quick games and instant good company. Book a half-hour hit or settle in for a doubles session on our dedicated pickleball court.",
    image: "tennis",
    price: 60000,
    rating: 4.7,
    amenities: ["Equipment rental", "Floodlights", "Parking"],
    opens: 7,
    closes: 22,
    duration: 30,
  },
  {
    name: "Full Court Club",
    sport: "Basketball",
    location: "Mayur Vihar",
    address: "Phase 1, Mayur Vihar, New Delhi",
    description:
      "An open-air full court for pick-up games, team practice and getting your shot back. Make your next evening a court evening.",
    image: "basketball",
    price: 55000,
    rating: 4.4,
    amenities: ["Outdoor court", "Drinking water", "Floodlights"],
    opens: 6,
    closes: 22,
    duration: 60,
  },
  {
    name: "Powerplay Nets",
    sport: "Cricket",
    location: "Pitampura",
    address: "Near District Park, Pitampura, New Delhi",
    description:
      "A dedicated practice lane with bowling-machine access. Short, focused sessions for working on the shot you keep thinking about.",
    image: "cricket",
    price: 70000,
    rating: 4.6,
    amenities: ["Practice nets", "Equipment rental", "Parking"],
    opens: 6,
    closes: 22,
    duration: 30,
  },
  {
    name: "Blue Lane Aquatics",
    sport: "Swimming",
    location: "Saket",
    address: "J Block, Saket, New Delhi",
    description:
      "Book a private training lane for a calm morning swim or an evening reset. A lifeguard is on duty during all sessions.",
    image: "swimming",
    price: 50000,
    rating: 4.8,
    amenities: ["Lifeguard", "Changing rooms", "Showers"],
    opens: 6,
    closes: 21,
    duration: 60,
  },
  {
    name: "The Lap House",
    sport: "Swimming",
    location: "Noida",
    address: "Sector 62, Noida",
    description:
      "An indoor training lane with 30-minute sessions that fit your day. Bring a cap, goggles and a little time for yourself.",
    image: "swimming",
    price: 65000,
    rating: 4.7,
    amenities: ["Indoor pool", "Lifeguard", "Showers"],
    opens: 7,
    closes: 22,
    duration: 30,
  },
  {
    name: "Spin Theory",
    sport: "Table Tennis",
    location: "Hauz Khas",
    address: "Main Market, Hauz Khas, New Delhi",
    description:
      "One table, endless rematches. An indoor table tennis studio with a competition table and paddles available at reception.",
    image: "tabletennis",
    price: 30000,
    rating: 4.5,
    amenities: ["Indoor court", "Equipment rental", "Air cooling"],
    opens: 9,
    closes: 23,
    duration: 30,
  },
  {
    name: "Paddle Room",
    sport: "Table Tennis",
    location: "Indirapuram",
    address: "Ahinsa Khand, Indirapuram, Ghaziabad",
    description:
      "Trade your screen time for table time. A relaxed indoor room for friendly rallies, serious serves and weekend mini tournaments.",
    image: "tabletennis",
    price: 40000,
    rating: 4.8,
    amenities: ["Indoor court", "Drinking water", "Parking"],
    opens: 8,
    closes: 22,
    duration: 60,
  },
];
const venues = varietyVenues;
export const varietySchedules = varietyVenues.map((venue) => ({
  name: venue.name,
  opens: venue.opens,
  closes: venue.closes,
  duration: venue.duration,
  varied: true,
}));

export async function seedVariety(db: DataSource) {
  await db.transaction(async (m) => {
    const result = await m.query(
      "INSERT IGNORE INTO seed_batches(batch_key) VALUES('venue-variety-v1')",
    );
    if (!result.affectedRows) return;
    for (const v of venues) {
      const r = await m.query(
        "INSERT INTO venues(name,sport,location,address,description,image_url,price_per_hour,rating,amenities) VALUES(?,?,?,?,?,?,?,?,?)",
        [
          v.name,
          v.sport,
          v.location,
          v.address,
          v.description,
          `/images/${v.image}.jpg`,
          v.price,
          v.rating,
          JSON.stringify(v.amenities),
        ],
      );
      const time = (n: number) =>
        `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
      for (let day = 0; day < 14; day++) {
        const date = new Date(Date.parse(today()) + day * 86400000)
          .toISOString()
          .slice(0, 10);
        const weekend = [0, 6].includes(
          new Date(date + "T12:00:00Z").getUTCDay(),
        );
        for (
          let t = v.opens * 60;
          t + v.duration <= v.closes * 60;
          t += v.duration
        ) {
          const peak = t >= 18 * 60;
          const price =
            Math.round(
              (((v.price * v.duration) / 60) *
                (weekend ? 1.15 : peak ? 1.1 : 1)) /
                100,
            ) * 100;
          await m.query(
            "INSERT INTO slots(venue_id,date,start_time,end_time,price,is_blocked) VALUES(?,?,?,?,?,?)",
            [
              r.insertId,
              date,
              time(t),
              time(t + v.duration),
              price,
              t === 13 * 60 && day % 3 === 0,
            ],
          );
        }
      }
    }
    console.log(
      `Added ${venues.length} demo venues with varied prices, hours and slot lengths.`,
    );
  });
}
