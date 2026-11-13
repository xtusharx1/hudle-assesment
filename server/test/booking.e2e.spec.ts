import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule, configure } from "../src/app";
import { db } from "../src/database/source";
import { today } from "../src/time";
let app: INestApplication;
let admin: string;
let venue: number;
let slot: number;
const date = new Date(Date.parse(today()) + 86400000 * 2)
  .toISOString()
  .slice(0, 10);
const customer = { name: "Test Player", phone: "9876543210" };
const book = (id = slot) =>
  request(app.getHttpServer())
    .post("/api/bookings")
    .send({ ...customer, slotId: id });
beforeAll(async () => {
  if (!process.env.DB_NAME?.endsWith("_test"))
    throw new Error("Tests require an isolated DB_NAME ending in _test");
  await db.initialize();
  await db.query("DELETE FROM bookings");
  await db.query("DELETE FROM slots");
  await db.query("DELETE FROM venues");
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = module.createNestApplication();
  configure(app);
  await app.init();
  const login = await request(app.getHttpServer())
    .post("/api/admin/login")
    .send({
      username: process.env.ADMIN_USERNAME || "admin",
      password: process.env.ADMIN_PASSWORD || "PlayWithHudle!2026",
    });
  admin = login.body.token;
});
afterAll(async () => {
  if (app) await app.close();
  if (db.isInitialized) await db.destroy();
});
beforeEach(async () => {
  const v = await db.query(
    "INSERT INTO venues(name,sport,location,address,price_per_hour) VALUES('Test Court','Tennis','Delhi','Test Street',50000)",
  );
  venue = v.insertId;
  const s = await db.query(
    "INSERT INTO slots(venue_id,date,start_time,end_time,price) VALUES(?,?,?,?,?)",
    [venue, date, "10:00", "11:00", 50000],
  );
  slot = s.insertId;
});
it("books once and returns 409 for the next attempt", async () => {
  const first = await book();
  expect(first.status).toBe(201);
  expect(first.body.amount).toBe(50000);
  expect(first.body.access_hash).toBeUndefined();
  expect(first.body.accessToken).toHaveLength(43);
  expect((await book()).status).toBe(409);
});
it("serializes ten simultaneous requests: one booking, nine conflicts", async () => {
  const results = await Promise.all(Array.from({ length: 10 }, () => book()));
  expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  expect(results.filter((r) => r.status === 409)).toHaveLength(9);
  const [count] = await db.query(
    "SELECT COUNT(*) total FROM bookings WHERE slot_id=? AND status='CONFIRMED'",
    [slot],
  );
  expect(Number(count.total)).toBe(1);
});
it("database constraint rejects duplicates even without the service lock", async () => {
  const result = await book();
  await expect(
    db.query(
      "INSERT INTO bookings(reference,access_hash,slot_id,customer_name,customer_phone,amount) VALUES('DIRECT-INSERT',REPEAT('a',64),?,'Direct','9876543210',50000)",
      [slot],
    ),
  ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
  expect(result.status).toBe(201);
});
it("cancels, preserves history, and allows rebooking", async () => {
  const b = (await book()).body;
  const r = await request(app.getHttpServer())
    .post(`/api/bookings/${b.reference}/cancel`)
    .set("x-booking-token", b.accessToken);
  expect(r.status).toBe(200);
  expect(r.body.status).toBe("CANCELLED");
  expect((await book()).status).toBe(201);
  const history = await db.query(
    "SELECT status FROM bookings WHERE slot_id=?",
    [slot],
  );
  expect(history).toHaveLength(2);
});
it("does not expose or cancel bookings without their private token", async () => {
  const b = (await book()).body;
  expect(
    (await request(app.getHttpServer()).get(`/api/bookings/${b.reference}`))
      .status,
  ).toBe(401);
  expect(
    (
      await request(app.getHttpServer())
        .post(`/api/bookings/${b.reference}/cancel`)
        .set("x-booking-token", "wrong")
    ).status,
  ).toBe(401);
  expect(
    (
      await request(app.getHttpServer())
        .get(`/api/bookings/${b.reference}`)
        .set("x-booking-token", b.accessToken)
    ).status,
  ).toBe(200);
});
it("rejects booking and cancelling past slots", async () => {
  await db.query("UPDATE slots SET date='2020-01-01' WHERE id=?", [slot]);
  expect((await book()).status).toBe(409);
  await db.query("UPDATE slots SET date=? WHERE id=?", [date, slot]);
  const b = (await book()).body;
  await db.query("UPDATE slots SET date='2020-01-01' WHERE id=?", [slot]);
  expect(
    (
      await request(app.getHttpServer())
        .post(`/api/bookings/${b.reference}/cancel`)
        .set("x-booking-token", b.accessToken)
    ).status,
  ).toBe(409);
});
it("rejects blocked slots and inactive venues", async () => {
  await db.query("UPDATE slots SET is_blocked=1 WHERE id=?", [slot]);
  expect((await book()).status).toBe(409);
  await db.query("UPDATE slots SET is_blocked=0 WHERE id=?", [slot]);
  await db.query("UPDATE venues SET is_active=0 WHERE id=?", [venue]);
  expect((await book()).status).toBe(404);
});
it("protects admin routes and validates input", async () => {
  expect(
    (await request(app.getHttpServer()).get("/api/admin/venues")).status,
  ).toBe(401);
  expect(
    (
      await request(app.getHttpServer())
        .post("/api/bookings")
        .send({ ...customer, slotId: slot, phone: "123", amount: 1 })
    ).status,
  ).toBe(400);
});
it("rejects overlapping windows and bulk generation skips existing rows", async () => {
  expect(
    (
      await request(app.getHttpServer())
        .post(`/api/admin/venues/${venue}/slots`)
        .set("Authorization", "Bearer " + admin)
        .send({ date, start_time: "10:30", end_time: "11:30", price: 50000 })
    ).status,
  ).toBe(409);
  const r = await request(app.getHttpServer())
    .post(`/api/admin/venues/${venue}/slots/generate`)
    .set("Authorization", "Bearer " + admin)
    .send({
      from: date,
      to: date,
      opens: "09:00",
      closes: "12:00",
      duration: 60,
    });
  expect(r.status).toBe(201);
  expect(r.body).toEqual({ created: 2, skipped: 1 });
});
it("refuses slot deletion with cancelled booking history", async () => {
  const b = (await book()).body;
  await request(app.getHttpServer())
    .post(`/api/bookings/${b.reference}/cancel`)
    .set("x-booking-token", b.accessToken);
  expect(
    (
      await request(app.getHttpServer())
        .delete(`/api/admin/slots/${slot}`)
        .set("Authorization", "Bearer " + admin)
    ).status,
  ).toBe(409);
});
it("cannot block a booked slot and repricing preserves booked amount", async () => {
  const b = (await book()).body;
  expect(
    (
      await request(app.getHttpServer())
        .patch(`/api/admin/slots/${slot}`)
        .set("Authorization", "Bearer " + admin)
        .send({ is_blocked: true })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app.getHttpServer())
        .patch(`/api/admin/slots/${slot}`)
        .set("Authorization", "Bearer " + admin)
        .send({ price: 90000 })
    ).status,
  ).toBe(200);
  const r = await request(app.getHttpServer())
    .get(`/api/bookings/${b.reference}`)
    .set("x-booking-token", b.accessToken);
  expect(r.body.amount).toBe(50000);
});
it("derives sport and location filters from active venues in the database", async () => {
  await db.query(
    "INSERT INTO venues(name,sport,location,address,price_per_hour) VALUES('Aqua Test','Swimming','Test Neighbourhood','Aqua Street',30000)",
  );
  await db.query(
    "INSERT INTO venues(name,sport,location,address,price_per_hour,is_active) VALUES('Hidden Test','Hidden Sport','Hidden Location','Hidden Street',30000,0)",
  );
  const response = await request(app.getHttpServer()).get("/api/venue-filters");
  expect(response.status).toBe(200);
  expect(response.body.sports).toContain("Swimming");
  expect(response.body.locations).toContain("Test Neighbourhood");
  expect(response.body.sports).not.toContain("Hidden Sport");
  expect(response.body.locations).not.toContain("Hidden Location");
  expect(
    (
      await request(app.getHttpServer()).get(
        "/api/venues?sport=Swimming&location=Test%20Neighbourhood",
      )
    ).body,
  ).toHaveLength(1);
});
it("adds the variety batch once, preserving existing venues and creating varied slot lengths", async () => {
  const { seedVariety } = await import("../src/database/variety");
  await db.query("DELETE FROM seed_batches WHERE batch_key='venue-variety-v1'");
  const [{ total: before }] = await db.query(
    "SELECT COUNT(*) total FROM venues",
  );
  await seedVariety(db);
  const [{ total: after }] = await db.query(
    "SELECT COUNT(*) total FROM venues",
  );
  expect(Number(after) - Number(before)).toBe(12);
  await seedVariety(db);
  const [{ total: again }] = await db.query(
    "SELECT COUNT(*) total FROM venues",
  );
  expect(Number(again)).toBe(Number(after));
  const rows = await db.query(
    "SELECT DISTINCT TIME_TO_SEC(TIMEDIFF(end_time,start_time))/60 duration FROM slots",
  );
  expect(rows.map((r: any) => Number(r.duration))).toEqual(
    expect.arrayContaining([30, 60, 90]),
  );
  const [{ overlaps }] = await db.query(
    "SELECT COUNT(*) overlaps FROM slots a JOIN slots b ON a.venue_id=b.venue_id AND a.date=b.date AND a.id<b.id AND a.start_time<b.end_time AND a.end_time>b.start_time",
  );
  expect(Number(overlaps)).toBe(0);
});
