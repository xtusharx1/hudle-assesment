import { db } from "./source";
import { seedVariety } from "./variety";
import { today } from "../time";
const venues = [
  [
    "The Rally Club",
    "Badminton",
    "Vasant Kunj",
    "Pocket C, Vasant Kunj, New Delhi",
    "A little competition. A lot of good energy. Play on tournament-grade wooden courts, under bright lights, with room for your whole crew.",
    "/images/badminton.jpg",
    65000,
    ["Parking", "Changing rooms", "Equipment rental"],
  ],
  [
    "Extra Time Arena",
    "Football",
    "Chhatarpur",
    "100 Feet Road, Chhatarpur, New Delhi",
    "Your evening deserves a better pitch. A premium floodlit turf made for five-a-side games and last-minute winners.",
    "/images/football.jpg",
    180000,
    ["Floodlights", "Parking", "Drinking water"],
  ],
  [
    "Baseline Social",
    "Tennis",
    "Greater Kailash",
    "M Block, Greater Kailash II, New Delhi",
    "Find your rhythm on beautifully maintained outdoor courts. Bring a friend, work on your serve, and stay for one more set.",
    "/images/tennis.jpg",
    90000,
    ["Equipment rental", "Changing rooms", "Parking"],
  ],
  [
    "The Pickle Yard",
    "Pickleball",
    "Saket",
    "District Centre, Saket, New Delhi",
    "Big rallies, small paddles, and a sport you will want to play again. A welcoming space for first-timers and regulars alike.",
    "/images/badminton.jpg",
    75000,
    ["Equipment rental", "Drinking water", "Parking"],
  ],
  [
    "Hoop District",
    "Basketball",
    "Dwarka",
    "Sector 12, Dwarka, New Delhi",
    "From casual shootarounds to full-court games. An outdoor court with great bounce, open skies, and proper game-day energy.",
    "/images/basketball.jpg",
    80000,
    ["Floodlights", "Parking", "Changing rooms"],
  ],
  [
    "Boundary House",
    "Cricket",
    "Gurugram",
    "Golf Course Extension, Gurugram",
    "Get the squad together for box cricket under the lights. Well-kept nets, a lively atmosphere, and all the space you need to swing.",
    "/images/cricket.jpg",
    120000,
    ["Equipment rental", "Floodlights", "Parking"],
  ],
];
async function seed() {
  await db.initialize();
  const [{ total }] = await db.query("SELECT COUNT(*) total FROM venues");
  if (Number(total) > 0) {
    console.log(
      "Seed skipped: preserving existing venues and admin slot changes.",
    );
    await seedVariety(db);
    await db.destroy();
    return;
  }
  for (const v of venues) {
    const [exists] = await db.query("SELECT id FROM venues WHERE name=?", [
      v[0],
    ]);
    let id = exists?.id;
    if (!id) {
      const r = await db.query(
        "INSERT INTO venues(name,sport,location,address,description,image_url,price_per_hour,amenities) VALUES(?,?,?,?,?,?,?,?)",
        [...v.slice(0, 7), JSON.stringify(v[7])],
      );
      id = r.insertId;
    }
    await db.query(
      "UPDATE venues SET image_url=? WHERE id=? AND image_url LIKE ?",
      [v[5], id, "https://images.unsplash.com/%"],
    );
    for (let day = 0; day < 14; day++) {
      const date = new Date(Date.parse(today()) + day * 86400000)
        .toISOString()
        .slice(0, 10);
      for (let h = 6; h < 23; h++) {
        const t = `${String(h).padStart(2, "0")}:00`;
        await db.query(
          "INSERT IGNORE INTO slots(venue_id,date,start_time,end_time,price) VALUES(?,?,?,?,?)",
          [id, date, t, `${String(h + 1).padStart(2, "0")}:00`, Number(v[6])],
        );
      }
    }
  }
  await seedVariety(db);
  console.log("Seed complete: 18 demo venues, 14 days of slots.");
  await db.destroy();
}
seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
