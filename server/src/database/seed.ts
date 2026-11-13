import { db } from "./source";
import { seedVariety } from "./variety";
import { baseVenues as venues, baseSchedules } from "./demo-data";
import { extendDemoSlots } from "./demo-slots";
import { varietySchedules } from "./variety";
import { today } from "../time";
async function seed() {
  await db.initialize();
  const [{ total }] = await db.query("SELECT COUNT(*) total FROM venues");
  if (Number(total) > 0) {
    console.log(
      "Seed skipped: preserving existing venues and admin slot changes.",
    );
    await seedVariety(db);
    await extendDemoSlots(db, [...baseSchedules, ...varietySchedules]);
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
  await extendDemoSlots(db, [...baseSchedules, ...varietySchedules]);
  console.log("Demo venues and future slots are ready.");
  await db.destroy();
}
seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
