import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { Controller, Get, INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule, configure } from "../src/app";
import { db } from "../src/database/source";
import { today } from "../src/time";
@Controller("api/rbac-test")
class UnannotatedController {
  @Get() closed() {
    return { shouldNeverBeReturned: true };
  }
}
let app: INestApplication;
let admin: string;
let player: ReturnType<typeof request.agent>;
let venue: number;
let slot: number;
const date = new Date(Date.parse(today()) + 86400000 * 2)
  .toISOString()
  .slice(0, 10);
const customer = { name: "Test Player", phone: "9876543210" };
const book = (id = slot) => player.post("/api/bookings").send({ slotId: id });
beforeAll(async () => {
  if (!process.env.DB_NAME?.endsWith("_test"))
    throw new Error("Tests require an isolated DB_NAME ending in _test");
  await db.initialize();
  await db.query("DELETE FROM bookings");
  await db.query("DELETE FROM auth_sessions");
  await db.query("DELETE FROM users");
  await db.query("DELETE FROM slots");
  await db.query("DELETE FROM venues");
  const module = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [UnannotatedController],
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
  player = request.agent(app.getHttpServer());
  await player
    .post("/api/auth/register")
    .send({
      ...customer,
      email: "player@example.com",
      password: "PlayerPassword!2026",
    })
    .expect(201);
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
  expect(first.body.accessToken).toBeUndefined();
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
  const r = await player.post(`/api/bookings/${b.reference}/cancel`);
  expect(r.status).toBe(200);
  expect(r.body.status).toBe("CANCELLED");
  expect((await book()).status).toBe(201);
  const history = await db.query(
    "SELECT status FROM bookings WHERE slot_id=?",
    [slot],
  );
  expect(history).toHaveLength(2);
});
it("does not expose or cancel bookings without signing in", async () => {
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
  expect((await player.get(`/api/bookings/${b.reference}`)).status).toBe(200);
});
it("rejects booking and cancelling past slots", async () => {
  await db.query("UPDATE slots SET date='2020-01-01' WHERE id=?", [slot]);
  expect((await book()).status).toBe(409);
  await db.query("UPDATE slots SET date=? WHERE id=?", [date, slot]);
  const b = (await book()).body;
  await db.query("UPDATE slots SET date='2020-01-01' WHERE id=?", [slot]);
  expect(
    (await player.post(`/api/bookings/${b.reference}/cancel`)).status,
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
    (await player.post("/api/bookings").send({ slotId: slot, amount: 1 }))
      .status,
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
  await player.post(`/api/bookings/${b.reference}/cancel`);
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
  const r = await player.get(`/api/bookings/${b.reference}`);
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

it("requires registration before booking and isolates bookings by account", async () => {
  await request(app.getHttpServer())
    .post("/api/bookings")
    .send({ slotId: slot })
    .expect(401);
  const outsider = request.agent(app.getHttpServer());
  await outsider
    .post("/api/auth/register")
    .send({
      name: "Other Player",
      email: "other@example.com",
      phone: "9876543211",
      password: "OtherPassword!2026",
    })
    .expect(201);
  const b = (await book()).body;
  await outsider.get(`/api/bookings/${b.reference}`).expect(404);
  await outsider.post(`/api/bookings/${b.reference}/cancel`).expect(404);
  expect((await outsider.get("/api/bookings")).body).toEqual([]);
  const mine = await player.get("/api/bookings").expect(200);
  expect(mine.body.some((x: any) => x.reference === b.reference)).toBe(true);
  expect(
    mine.body.every((x: any) => x.customer_email === "player@example.com"),
  ).toBe(true);
});
it("hashes passwords, normalizes email, and issues only HttpOnly session cookies", async () => {
  const agent = request.agent(app.getHttpServer());
  const input = {
    name: "Session Player",
    email: "SESSION@example.com",
    phone: "9876543212",
    password: "SessionPassword!2026",
  };
  const result = await agent.post("/api/auth/register").send(input).expect(201);
  expect(result.body).toMatchObject({
    name: input.name,
    email: "session@example.com",
  });
  expect(result.body.password_hash).toBeUndefined();
  expect(result.body.token).toBeUndefined();
  const cookies = result.headers["set-cookie"] as unknown as string[];
  expect(cookies).toHaveLength(2);
  for (const cookie of cookies) {
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
  }
  const [u] = await db.query("SELECT password_hash FROM users WHERE email=?", [
    "session@example.com",
  ]);
  expect(u.password_hash).toMatch(/^scrypt\$/);
  expect(u.password_hash).not.toContain(input.password);
  await agent
    .post("/api/auth/register")
    .send({ ...input, email: "session@example.com" })
    .expect(409);
  await agent
    .post("/api/auth/login")
    .send({ email: input.email, password: "wrong-password" })
    .expect(401);
  await agent
    .post("/api/auth/login")
    .send({ email: input.email, password: input.password })
    .expect(200);
  await agent.get("/api/auth/me").expect(200);
  await agent.get("/api/admin/venues").expect(403);
});
it("rotates refresh tokens, restores a session, and revokes access on logout", async () => {
  const agent = request.agent(app.getHttpServer());
  const login = await agent
    .post("/api/auth/login")
    .send({ email: "session@example.com", password: "SessionPassword!2026" })
    .expect(200);
  const cookies = login.headers["set-cookie"] as unknown as string[];
  const access = cookies
    .find((c) => c.startsWith("hudle_access="))!
    .split(";")[0];
  const refresh = cookies
    .find((c) => c.startsWith("hudle_refresh="))!
    .split(";")[0];
  const restored = await request(app.getHttpServer())
    .post("/api/auth/refresh")
    .set("Cookie", refresh)
    .expect(200);
  expect(restored.body.email).toBe("session@example.com");
  await request(app.getHttpServer())
    .post("/api/auth/refresh")
    .set("Cookie", refresh)
    .expect(401);
  const rotated = (restored.headers["set-cookie"] as unknown as string[])
    .find((c) => c.startsWith("hudle_refresh="))!
    .split(";")[0];
  await request(app.getHttpServer())
    .get("/api/auth/me")
    .set("Cookie", access)
    .expect(200);
  await request(app.getHttpServer())
    .post("/api/auth/logout")
    .set("Cookie", rotated)
    .expect(200);
  await request(app.getHttpServer())
    .get("/api/auth/me")
    .set("Cookie", access)
    .expect(401);
  await request(app.getHttpServer())
    .post("/api/auth/refresh")
    .set("Cookie", rotated)
    .expect(401);
});
it("rejects forged JWTs, expired access tokens, foreign origins, and weak passwords", async () => {
  await request(app.getHttpServer())
    .get("/api/auth/me")
    .set("Cookie", "hudle_access=forged")
    .expect(401);
  const { JwtService } = await import("@nestjs/jwt");
  const expired = app
    .get(JwtService)
    .sign(
      { role: "customer", sub: "1", sid: "anything" },
      { expiresIn: -1, issuer: "hudle-api", audience: "hudle-customer" },
    );
  await request(app.getHttpServer())
    .get("/api/auth/me")
    .set("Cookie", "hudle_access=" + expired)
    .expect(401);
  await request(app.getHttpServer())
    .get("/api/auth/me")
    .set("Cookie", "hudle_access=" + admin)
    .expect(401);
  await player
    .post("/api/bookings")
    .set("Origin", "https://untrusted.example")
    .send({ slotId: slot })
    .expect(403);
  await request(app.getHttpServer())
    .post("/api/auth/register")
    .send({
      name: "Weak Player",
      email: "weak@example.com",
      phone: "9876543210",
      password: "short",
    })
    .expect(400);
  await player
    .post("/api/bookings")
    .send({ slotId: slot, name: "Spoofed Owner" })
    .expect(400);
});

it("finds venues by sport keywords as well as venue names", async () => {
  const response = await request(app.getHttpServer())
    .get("/api/venues?q=Tennis")
    .expect(200);
  expect(response.body.some((v: any) => v.id === venue)).toBe(true);
});
it("rejects whitespace-only venue details after normalization", async () => {
  await request(app.getHttpServer())
    .post("/api/admin/venues")
    .set("Authorization", "Bearer " + admin)
    .send({
      name: "   ",
      sport: "Tennis",
      location: "  ",
      address: "      ",
      price_per_hour: 50000,
    })
    .expect(400);
});
it("rejects malformed photo URLs and repeated query parameters", async () => {
  await request(app.getHttpServer())
    .post("/api/admin/venues")
    .set("Authorization", "Bearer " + admin)
    .send({
      name: "Invalid image",
      sport: "Tennis",
      location: "Delhi",
      address: "Test Street",
      price_per_hour: 50000,
      image_url: "https://",
    })
    .expect(400);
  await request(app.getHttpServer())
    .get("/api/venues?sport=Tennis&sport=Football")
    .expect(400);
  await request(app.getHttpServer())
    .get(`/api/venues/${venue}/slots?date=${date}&date=${date}`)
    .expect(400);
});
it("rejects impossible dates and out-of-order or overlong slot generation", async () => {
  const auth = "Bearer " + admin;
  await request(app.getHttpServer())
    .get(`/api/venues/${venue}/slots?date=2026-02-30`)
    .expect(400);
  await request(app.getHttpServer())
    .post(`/api/admin/venues/${venue}/slots`)
    .set("Authorization", auth)
    .send({ date, start_time: "11:00", end_time: "10:00", price: 50000 })
    .expect(400);
  await request(app.getHttpServer())
    .post(`/api/admin/venues/${venue}/slots/generate`)
    .set("Authorization", auth)
    .send({
      from: date,
      to: "2099-01-01",
      opens: "09:00",
      closes: "12:00",
      duration: 60,
    })
    .expect(400);
});
it("keeps cancellation idempotent and booking data private from public slots", async () => {
  const b = (await book()).body;
  const slots = await request(app.getHttpServer())
    .get(`/api/venues/${venue}/slots?date=${date}`)
    .expect(200);
  expect(slots.body[0].booking_reference).toBeUndefined();
  await player.post(`/api/bookings/${b.reference}/cancel`).expect(200);
  await player.post(`/api/bookings/${b.reference}/cancel`).expect(200);
});
it("refuses a stale price quote without creating a booking", async () => {
  await player
    .post("/api/bookings")
    .send({ slotId: slot, expectedPrice: 49999 })
    .expect(409);
  const [{ total }] = await db.query(
    "SELECT COUNT(*) total FROM bookings WHERE slot_id=?",
    [slot],
  );
  expect(Number(total)).toBe(0);
  await player
    .post("/api/bookings")
    .send({ slotId: slot, expectedPrice: 50000 })
    .expect(201);
});
it("validates admin booking filters and protected mutations", async () => {
  await request(app.getHttpServer())
    .get("/api/admin/bookings?status=INVALID")
    .set("Authorization", "Bearer " + admin)
    .expect(400);
  await request(app.getHttpServer())
    .get("/api/admin/bookings?venueId=abc")
    .set("Authorization", "Bearer " + admin)
    .expect(400);
  await request(app.getHttpServer())
    .patch(`/api/admin/slots/${slot}`)
    .send({ price: 1 })
    .expect(401);
});
it("supports independent sessions and expires a session at its absolute deadline", async () => {
  // Create the session directly in this isolated test DB to keep rate-limit counters independent.
  const { randomUUID, randomBytes } = await import("crypto");
  const { hash } = await import("../src/common");
  const { JwtService } = await import("@nestjs/jwt");
  const [u] = await db.query("SELECT id FROM users WHERE email=?", [
    "player@example.com",
  ]);
  const sid = randomUUID(),
    refresh = randomBytes(32).toString("base64url");
  await db.query(
    "INSERT INTO auth_sessions(id,user_id,refresh_hash,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY))",
    [sid, u.id, hash(refresh)],
  );
  const access = app
    .get(JwtService)
    .sign(
      { role: "customer", sub: String(u.id), sid },
      { expiresIn: "15m", issuer: "hudle-api", audience: "hudle-customer" },
    );
  await request(app.getHttpServer())
    .get("/api/auth/me")
    .set("Cookie", "hudle_access=" + access)
    .expect(200);
  await db.query(
    "UPDATE auth_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY) WHERE id=?",
    [sid],
  );
  await request(app.getHttpServer())
    .get("/api/auth/me")
    .set("Cookie", "hudle_access=" + access)
    .expect(401);
  await request(app.getHttpServer())
    .post("/api/auth/refresh")
    .set("Cookie", "hudle_refresh=" + refresh)
    .expect(401);
  await player.get("/api/auth/me").expect(200);
});
it("revokes the access session on logout even if the refresh cookie is missing", async () => {
  const { randomUUID, randomBytes } = await import("crypto");
  const { hash } = await import("../src/common");
  const { JwtService } = await import("@nestjs/jwt");
  const [u] = await db.query("SELECT id FROM users WHERE email=?", [
    "player@example.com",
  ]);
  const sid = randomUUID();
  await db.query(
    "INSERT INTO auth_sessions(id,user_id,refresh_hash,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY))",
    [sid, u.id, hash(randomBytes(32).toString("hex"))],
  );
  const access = app
    .get(JwtService)
    .sign(
      { role: "customer", sub: String(u.id), sid },
      { expiresIn: "15m", issuer: "hudle-api", audience: "hudle-customer" },
    );
  await request(app.getHttpServer())
    .post("/api/auth/logout")
    .set("Cookie", "hudle_access=" + access)
    .expect(200);
  await request(app.getHttpServer())
    .get("/api/auth/me")
    .set("Cookie", "hudle_access=" + access)
    .expect(401);
});
it("treats wildcard-looking search text literally and rejects expired admin JWTs", async () => {
  const response = await request(app.getHttpServer())
    .get("/api/venues?q=%25")
    .expect(200);
  expect(response.body).toEqual([]);
  const { JwtService } = await import("@nestjs/jwt");
  const expired = app
    .get(JwtService)
    .sign({ role: "admin" }, { expiresIn: -1 });
  await request(app.getHttpServer())
    .get("/api/admin/venues")
    .set("Authorization", "Bearer " + expired)
    .expect(401);
});
it("preserves owner access and cancellation after venue deactivation", async () => {
  const b = (await book()).body;
  await request(app.getHttpServer())
    .delete(`/api/admin/venues/${venue}`)
    .set("Authorization", "Bearer " + admin)
    .expect(200);
  await request(app.getHttpServer()).get(`/api/venues/${venue}`).expect(404);
  const history = await player.get(`/api/bookings/${b.reference}`).expect(200);
  expect(history.body.venue_is_active).toBe(0);
  await player.post(`/api/bookings/${b.reference}/cancel`).expect(200);
});
it("deletes an unbooked slot without leaving an availability record", async () => {
  await request(app.getHttpServer())
    .delete(`/api/admin/slots/${slot}`)
    .set("Authorization", "Bearer " + admin)
    .expect(200);
  const rows = await db.query("SELECT id FROM slots WHERE id=?", [slot]);
  expect(rows).toEqual([]);
});
it("identifies an admin session independently from customer login", async () => {
  const identity = await request(app.getHttpServer())
    .get("/api/admin/me")
    .set("Authorization", "Bearer " + admin)
    .expect(200);
  expect(identity.body).toEqual({
    role: "admin",
    username: process.env.ADMIN_USERNAME || "admin",
  });
  await request(app.getHttpServer()).get("/api/admin/me").expect(401);
  await player.get("/api/admin/me").expect(403);
});

it("RBAC denies every customer action to admin credentials", async () => {
  for (const [method, path, body] of [
    ["get", "/api/auth/me"],
    ["get", "/api/bookings"],
    ["get", "/api/bookings/unknown"],
    ["post", "/api/bookings", { slotId: slot }],
    ["post", "/api/bookings/unknown/cancel", {}],
  ] as const) {
    const response = await (request(app.getHttpServer()) as any)
      [method](path)
      .set("Authorization", "Bearer " + admin)
      .send(body);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  }
});
it("RBAC denies every admin operation to a signed-in customer", async () => {
  for (const [method, path] of [
    ["get", "/api/admin/me"],
    ["get", "/api/admin/venues"],
    ["post", "/api/admin/venues"],
    ["put", `/api/admin/venues/${venue}`],
    ["delete", `/api/admin/venues/${venue}`],
    ["get", `/api/admin/venues/${venue}/slots`],
    ["post", `/api/admin/venues/${venue}/slots`],
    ["post", `/api/admin/venues/${venue}/slots/generate`],
    ["patch", `/api/admin/slots/${slot}`],
    ["delete", `/api/admin/slots/${slot}`],
    ["get", "/api/admin/bookings"],
  ]) {
    const response = await (player as any)[method](path).send({});
    expect(response.status).toBe(403);
  }
});
it("RBAC rejects missing and malformed credentials without falling back to another identity", async () => {
  await request(app.getHttpServer()).get("/api/bookings").expect(401);
  await request(app.getHttpServer()).get("/api/admin/bookings").expect(401);
  await player
    .get("/api/bookings")
    .set("Authorization", "Bearer invalid")
    .expect(401);
  await player
    .get("/api/bookings")
    .set("Authorization", "Basic invalid")
    .expect(401);
  await player.get("/api/bookings").expect(200);
});
it("RBAC rejects admin tokens with the wrong audience or an unsupported role", async () => {
  const { JwtService } = await import("@nestjs/jwt");
  for (const token of [
    app
      .get(JwtService)
      .sign(
        { role: "admin", sub: "admin" },
        { issuer: "hudle-api", audience: "hudle-customer" },
      ),
    app
      .get(JwtService)
      .sign(
        { role: "superadmin", sub: "admin" },
        { issuer: "hudle-api", audience: "hudle-admin" },
      ),
  ]) {
    await request(app.getHttpServer())
      .get("/api/admin/venues")
      .set("Authorization", "Bearer " + token)
      .expect(401);
  }
});
it("admin login revokes the same browser's customer session on the server", async () => {
  const { randomUUID, randomBytes } = await import("crypto");
  const { hash } = await import("../src/common");
  const { JwtService } = await import("@nestjs/jwt");
  const [u] = await db.query("SELECT id FROM users WHERE email=?", [
    "player@example.com",
  ]);
  const sid = randomUUID();
  await db.query(
    "INSERT INTO auth_sessions(id,user_id,refresh_hash,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY))",
    [sid, u.id, hash(randomBytes(32).toString("hex"))],
  );
  const access = app
    .get(JwtService)
    .sign(
      { role: "customer", sub: String(u.id), sid },
      { issuer: "hudle-api", audience: "hudle-customer" },
    );
  const cookie = "hudle_access=" + access;
  await request(app.getHttpServer())
    .post("/api/admin/login")
    .set("Cookie", cookie)
    .send({
      username: process.env.ADMIN_USERNAME || "admin",
      password: process.env.ADMIN_PASSWORD || "PlayWithHudle!2026",
    })
    .expect(200);
  await request(app.getHttpServer())
    .get("/api/auth/me")
    .set("Cookie", cookie)
    .expect(401);
  // Other devices remain independent.
  await player.get("/api/auth/me").expect(200);
});

it("RBAC denies unannotated routes by default, including to admins", async () => {
  await request(app.getHttpServer()).get("/api/rbac-test").expect(401);
  await player.get("/api/rbac-test").expect(403);
  await request(app.getHttpServer())
    .get("/api/rbac-test")
    .set("Authorization", "Bearer " + admin)
    .expect(403);
});
it("a customer cannot promote their role through a booking payload", async () => {
  await player
    .post("/api/bookings")
    .send({ slotId: slot, role: "admin" })
    .expect(400);
  await player.get("/api/admin/venues").expect(403);
});
