import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { db } from "./database/source";
import { dateValid, startsAt, today } from "./time";
import { VenueDto, SlotDto, SlotPatchDto, GenerateDto } from "./dtos";
@Injectable()
export class CatalogService {
  async filters() {
    const rows = await db.query(
      "SELECT DISTINCT sport,location FROM venues WHERE is_active=1",
    );
    return {
      sports: [...new Set(rows.map((r: any) => r.sport))].sort(),
      locations: [...new Set(rows.map((r: any) => r.location))].sort(),
    };
  }
  async venues(filters: any = {}, admin = false) {
    const where: string[] = admin ? ["1=1"] : ["v.is_active=1"];
    const params: any[] = [];
    for (const key of ["sport", "location"])
      if (filters[key]) {
        where.push(`v.${key}=?`);
        params.push(filters[key]);
      }
    if (filters.q) {
      const term = String(filters.q)
        .slice(0, 100)
        .replace(/[!%_]/g, (c) => "!" + c);
      where.push(
        "(v.name LIKE ? ESCAPE '!' OR v.location LIKE ? ESCAPE '!' OR v.sport LIKE ? ESCAPE '!')",
      );
      params.push(`%${term}%`, `%${term}%`, `%${term}%`);
    }
    return db.query(
      `SELECT v.* FROM venues v WHERE ${where.join(" AND ")} ORDER BY v.id`,
      params,
    );
  }
  async venue(id: number, admin = false) {
    const [v] = await db.query(
      `SELECT * FROM venues WHERE id=? ${admin ? "" : "AND is_active=1"}`,
      [id],
    );
    if (!v) throw new NotFoundException("Venue not found");
    return v;
  }
  async slots(id: number, date: string, admin = false) {
    await this.venue(id, admin);
    if (!dateValid(date)) throw new BadRequestException("Choose a valid date");
    const rows = await db.query(
      `SELECT s.*, b.reference booking_reference FROM slots s LEFT JOIN bookings b ON b.active_slot_id=s.id WHERE s.venue_id=? AND s.date=? ORDER BY s.start_time`,
      [id, date],
    );
    return rows.map((s: any) => ({
      ...s,
      booking_reference: admin ? s.booking_reference : undefined,
      availability: s.is_blocked
        ? "BLOCKED"
        : startsAt(s.date, s.start_time) <= Date.now()
          ? "PAST"
          : s.booking_reference
            ? "BOOKED"
            : "AVAILABLE",
    }));
  }
  async saveVenue(body: VenueDto, id?: number) {
    if (id) await this.venue(id, true);
    const values = [
      body.name.trim(),
      body.sport,
      body.location.trim(),
      body.address.trim(),
      body.description || "",
      body.image_url || "",
      body.price_per_hour,
    ];
    if (id)
      await db.query(
        "UPDATE venues SET name=?,sport=?,location=?,address=?,description=?,image_url=?,price_per_hour=? WHERE id=?",
        [...values, id],
      );
    else {
      const result = await db.query(
        "INSERT INTO venues(name,sport,location,address,description,image_url,price_per_hour) VALUES(?,?,?,?,?,?,?)",
        values,
      );
      id = result.insertId;
    }
    return this.venue(id!, true);
  }
  async deactivate(id: number) {
    return db.transaction(async (m) => {
      const [v] = await m.query("SELECT id FROM venues WHERE id=? FOR UPDATE", [
        id,
      ]);
      if (!v) throw new NotFoundException();
      await m.query("UPDATE venues SET is_active=0 WHERE id=?", [id]);
      return { success: true };
    });
  }
  async addSlot(id: number, body: SlotDto) {
    if (
      !dateValid(body.date) ||
      body.end_time <= body.start_time ||
      startsAt(body.date, body.start_time) <= Date.now()
    )
      throw new BadRequestException("Slots must be valid future time windows");
    return db.transaction(async (m) => {
      const [v] = await m.query("SELECT id FROM venues WHERE id=? FOR UPDATE", [
        id,
      ]);
      if (!v) throw new NotFoundException();
      const overlaps = await m.query(
        "SELECT id FROM slots WHERE venue_id=? AND date=? AND start_time < ? AND end_time > ?",
        [id, body.date, body.end_time, body.start_time],
      );
      if (overlaps.length)
        throw new ConflictException("This time overlaps an existing slot");
      const r = await m.query(
        "INSERT INTO slots(venue_id,date,start_time,end_time,price) VALUES(?,?,?,?,?)",
        [id, body.date, body.start_time, body.end_time, body.price],
      );
      return { id: r.insertId, ...body };
    });
  }
  async editSlot(id: number, body: SlotPatchDto, remove = false) {
    return db.transaction(async (m) => {
      const [s] = await m.query("SELECT * FROM slots WHERE id=? FOR UPDATE", [
        id,
      ]);
      if (!s) throw new NotFoundException();
      const history = await m.query(
        "SELECT id,status FROM bookings WHERE slot_id=?",
        [id],
      );
      if (remove) {
        if (history.length)
          throw new ConflictException(
            "This slot has booking history. Block it instead.",
          );
        await m.query("DELETE FROM slots WHERE id=?", [id]);
      } else {
        if (
          body.is_blocked &&
          history.some((b: any) => b.status === "CONFIRMED")
        )
          throw new ConflictException("A booked slot cannot be blocked");
        await m.query("UPDATE slots SET is_blocked=?,price=? WHERE id=?", [
          body.is_blocked ?? s.is_blocked,
          body.price ?? s.price,
          id,
        ]);
      }
      return { success: true };
    });
  }
  async generate(id: number, b: GenerateDto) {
    if (
      !dateValid(b.from) ||
      !dateValid(b.to) ||
      b.from < today() ||
      b.to < b.from ||
      b.closes <= b.opens
    )
      throw new BadRequestException("Invalid date or time range");
    const days =
      Math.round((Date.parse(b.to) - Date.parse(b.from)) / 86400000) + 1;
    if (days > 31)
      throw new BadRequestException("Generate up to 31 days at a time");
    const minutes = (s: string) =>
      Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    const time = (n: number) =>
      `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
    return db.transaction(async (m) => {
      const [v] = await m.query("SELECT * FROM venues WHERE id=? FOR UPDATE", [
        id,
      ]);
      if (!v) throw new NotFoundException();
      let created = 0,
        skipped = 0;
      for (let d = 0; d < days; d++) {
        const date = new Date(Date.parse(b.from) + d * 86400000)
          .toISOString()
          .slice(0, 10);
        for (
          let t = minutes(b.opens);
          t + b.duration <= minutes(b.closes);
          t += b.duration
        ) {
          const start = time(t),
            end = time(t + b.duration);
          const overlap = await m.query(
            "SELECT id FROM slots WHERE venue_id=? AND date=? AND start_time < ? AND end_time > ?",
            [id, date, end, start],
          );
          if (overlap.length || startsAt(date, start) <= Date.now()) {
            skipped++;
            continue;
          }
          await m.query(
            "INSERT INTO slots(venue_id,date,start_time,end_time,price) VALUES(?,?,?,?,?)",
            [
              id,
              date,
              start,
              end,
              Math.round((v.price_per_hour * b.duration) / 60),
            ],
          );
          created++;
        }
      }
      return { created, skipped };
    });
  }
}
