import { DataSource } from "typeorm";
import { today } from "../time";

interface DemoSchedule {
  name: string;
  opens: number;
  closes: number;
  duration: number;
  varied: boolean;
}
const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
const time = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Append demo availability only beyond its recorded horizon; never recreate edited/deleted days. */
export async function extendDemoSlots(
  db: DataSource,
  schedules: DemoSchedule[],
  current = today(),
) {
  const until = addDays(current, 13);
  for (const schedule of schedules) {
    await db.transaction(async (manager) => {
      const [venue] = await manager.query(
        "SELECT id,price_per_hour FROM venues WHERE name=? AND is_active=1 ORDER BY id LIMIT 1 FOR UPDATE",
        [schedule.name],
      );
      if (!venue) return;
      const prefix = `demo-horizon:${venue.id}:`;
      const [saved] = await manager.query(
        "SELECT MAX(RIGHT(batch_key,10)) last_date FROM seed_batches WHERE batch_key LIKE ?",
        [prefix + "%"],
      );
      const [existing] = await manager.query(
        "SELECT MAX(date) last_date FROM slots WHERE venue_id=?",
        [venue.id],
      );
      const horizon = [saved.last_date, existing.last_date]
        .filter(Boolean)
        .sort()
        .at(-1);
      // An empty schedule may have been deliberately cleared by an admin.
      if (!horizon) return;
      const first = horizon < current ? current : addDays(horizon, 1);
      for (let date = first; date <= until; date = addDays(date, 1)) {
        const weekend = [0, 6].includes(
          new Date(date + "T12:00:00Z").getUTCDay(),
        );
        for (
          let start = schedule.opens * 60;
          start + schedule.duration <= schedule.closes * 60;
          start += schedule.duration
        ) {
          const base = (venue.price_per_hour * schedule.duration) / 60;
          const price = schedule.varied
            ? Math.round(
                (base * (weekend ? 1.15 : start >= 18 * 60 ? 1.1 : 1)) / 100,
              ) * 100
            : Math.round(base);
          const maintenance =
            schedule.varied &&
            start === 13 * 60 &&
            Math.floor(Date.parse(date) / 86400000) % 3 === 0;
          await manager.query(
            "INSERT INTO slots(venue_id,date,start_time,end_time,price,is_blocked) VALUES(?,?,?,?,?,?)",
            [
              venue.id,
              date,
              time(start),
              time(start + schedule.duration),
              price,
              maintenance,
            ],
          );
        }
      }
      const nextHorizon = horizon > until ? horizon : until;
      await manager.query(
        "INSERT IGNORE INTO seed_batches(batch_key) VALUES(?)",
        [prefix + nextHorizon],
      );
    });
  }
}
