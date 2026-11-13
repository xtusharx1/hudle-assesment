import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { db } from "./database/source";
import { hash, equal } from "./common";
import { startsAt } from "./time";
import { BookingDto } from "./dtos";
const select = `SELECT b.reference,b.customer_name,b.customer_phone,b.customer_email,b.status,b.amount,b.created_at,b.cancelled_at,b.access_hash,s.id slot_id,s.date,s.start_time,s.end_time,v.id venue_id,v.name venue_name,v.sport,v.location,v.address,v.image_url FROM bookings b JOIN slots s ON s.id=b.slot_id JOIN venues v ON v.id=s.venue_id`;
@Injectable()
export class BookingsService {
  async create(b: BookingDto) {
    const token = randomBytes(32).toString("base64url");
    const reference = "HD-" + randomBytes(6).toString("hex").toUpperCase();
    try {
      await db.transaction(async (m) => {
        // A shared venue lock coordinates with venue deactivation; exclusive slot lock serializes booking edits.
        const [target] = await m.query(
          "SELECT venue_id FROM slots WHERE id=?",
          [b.slotId],
        );
        if (!target) throw new NotFoundException("Slot not found");
        const [v] = await m.query(
          "SELECT is_active FROM venues WHERE id=? FOR SHARE",
          [target.venue_id],
        );
        const [s] = await m.query("SELECT * FROM slots WHERE id=? FOR UPDATE", [
          b.slotId,
        ]);
        if (!s || !v?.is_active)
          throw new NotFoundException("Venue or slot is unavailable");
        if (s.is_blocked || startsAt(s.date, s.start_time) <= Date.now())
          throw new ConflictException("This slot is no longer available");
        const active = await m.query(
          "SELECT id FROM bookings WHERE active_slot_id=? FOR UPDATE",
          [s.id],
        );
        if (active.length)
          throw new ConflictException(
            "Someone has already booked this slot. Please choose another.",
          );
        await m.query(
          "INSERT INTO bookings(reference,access_hash,slot_id,customer_name,customer_phone,customer_email,amount) VALUES(?,?,?,?,?,?,?)",
          [
            reference,
            hash(token),
            s.id,
            b.name.trim(),
            b.phone,
            b.email || null,
            s.price,
          ],
        );
      });
    } catch (e: any) {
      if (
        e.code === "ER_DUP_ENTRY" &&
        e.message.includes("one_active_booking_per_slot")
      )
        throw new ConflictException("This slot has already been booked");
      throw e;
    }
    return { ...(await this.get(reference, token)), accessToken: token };
  }
  async get(reference: string, token: string) {
    const [b] = await db.query(select + " WHERE b.reference=?", [reference]);
    if (!b || !token || !equal(b.access_hash, hash(token)))
      throw new UnauthorizedException("Booking access is invalid");
    delete b.access_hash;
    return b;
  }
  async cancel(reference: string, token: string) {
    await this.get(reference, token);
    await db.transaction(async (m) => {
      const [b] = await m.query(
        "SELECT slot_id FROM bookings WHERE reference=?",
        [reference],
      );
      const [s] = await m.query("SELECT * FROM slots WHERE id=? FOR UPDATE", [
        b.slot_id,
      ]);
      const [current] = await m.query(
        "SELECT status FROM bookings WHERE reference=? FOR UPDATE",
        [reference],
      );
      if (current.status === "CANCELLED") return;
      if (startsAt(s.date, s.start_time) <= Date.now())
        throw new ConflictException(
          "A booking that has started cannot be cancelled",
        );
      await m.query(
        "UPDATE bookings SET status='CANCELLED',cancelled_at=UTC_TIMESTAMP() WHERE reference=?",
        [reference],
      );
    });
    return this.get(reference, token);
  }
  async list(filters: any) {
    const where = ["1=1"];
    const args: any[] = [];
    for (const [key, col] of [
      ["venueId", "v.id"],
      ["date", "s.date"],
      ["status", "b.status"],
    ]) {
      if (filters[key]) {
        where.push(`${col}=?`);
        args.push(filters[key]);
      }
    }
    const rows = await db.query(
      select +
        ` WHERE ${where.join(" AND ")} ORDER BY b.created_at DESC LIMIT 500`,
      args,
    );
    return rows.map(({ access_hash, ...b }: any) => b);
  }
}
