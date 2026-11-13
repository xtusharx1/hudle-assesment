# Hudle — Make time for play.

A full-stack sports venue booking app for the Hudle engineering assignment. Discover venues, check live slot availability, book a court, manage private bookings, and run venues through an admin dashboard.

## Documentation

- [Complete installation, environment and troubleshooting guide](docs/SETUP.md)
- [Backend architecture, database rules and API reference](docs/BACKEND.md)
- [Project context and development handoff](PROJECT_CONTEXT.md)

## Run locally

Requires Node.js 22+, npm, and Docker with Compose.

```bash
npm ci
cp .env.example .env
docker compose up -d --wait db
npm run db:seed
npm run dev
```

Open **http://127.0.0.1:5173**. The Vite proxy forwards `/api` to NestJS on port 3001. Database port 3308 avoids collisions with an existing local MySQL installation. If Docker is stopped on macOS with Colima installed, run `colima start` first.

Admin: **http://127.0.0.1:5173/admin**

Local demo credentials: `admin` / `PlayWithHudle!2026` (override in `.env`). These are development defaults, not production credentials.

Eighteen fictional demo venues span eight sports and fifteen neighbourhoods, with 14 days of availability. Slots include 30-, 60-, and 90-minute sessions, varied opening hours, peak/weekend prices, and maintenance blocks. Prices start at ₹300 per hour. Seeding is repeatable and does not delete bookings or overwrite admin changes. The expansion batch is tracked in `seed_batches` and is applied once. Venue photos are illustrative, bundled locally under `web/public/images`, and sourced from Unsplash. Ratings are sample data, not real reviews. Web fonts require internet; the booking app itself runs against your local API and database.

## Run everything in Docker

```bash
cp .env.example .env
docker compose up --build -d --wait
```

Open **http://localhost:8080**. Nginx serves the SPA and proxies the API. API startup runs migrations and seeds demo data. Stop with `docker compose down`; database records persist in a named volume. Do not run the Docker API and the local API simultaneously: both use port 3001.

## Verify

```bash
npm run build
# Creates a separate test database in the local Docker MySQL instance:
docker compose exec db mysql -uroot -p
# Enter the local root password (default root_local_only), then run:
# CREATE DATABASE IF NOT EXISTS hudle_test;
# GRANT ALL PRIVILEGES ON hudle_test.* TO 'hudle'@'%';
# exit
DB_NAME=hudle_test npm test
```

Tests refuse to run unless the database name ends in `_test`. They reset data only in that isolated test database. Jest + Supertest tests hit real MySQL rather than mocking transactions.

Coverage includes:

- Successful booking and sequential conflict.
- Ten concurrent attempts: one success, nine conflicts, one confirmed database record.
- Direct duplicate insert rejected by the database constraint.
- Cancellation releases availability, rebooking succeeds, history remains.
- Private access token required to retrieve and cancel bookings.
- Past slots, blocked slots, inactive venues, input validation, and admin authorization.
- Overlap rejection and duplicate-safe bulk slot generation.
- Historical slot deletion refusal and immutable booking price after repricing.

## Stack and structure

- React 18, TypeScript, Vite, React Router, TanStack Query, Lucide icons, custom responsive CSS.
- NestJS controllers and injected services, class-validator DTOs, JWT admin guard, consistent exception responses.
- TypeORM DataSource / transaction manager and explicit SQL migrations on MySQL 8.4 / InnoDB.
- Docker Compose, Nginx, Jest, Supertest.

```text
server/src/
  app.ts                 Nest module and request configuration
  controllers.ts         Public and protected admin HTTP endpoints
  catalog.ts             Venue discovery, slot management, bulk generation
  bookings.ts            Booking transaction, private access, cancellation
  common.ts              JWT guard, error filter, hashing helpers
  dtos.ts                Input contracts and validation
  time.ts                Explicit IST conversion and date validation
  database/source.ts     Connection and migration configuration
  database/schema.ts     Versioned schema migration
  database/seed.ts       Repeatable sample data
server/test/             Real-database HTTP integration tests
web/src/
  App.tsx                Customer routes and booking screens
  Admin.tsx              Admin sign-in, venues, slots, booking dashboard
  api.ts                 Typed fetch clients, display helpers, private browser storage
  styles.css             Responsive design system
```

SQL is parameterized. Raw SQL through TypeORM keeps lock ordering and the generated-column constraint visible to reviewers; schema synchronization is disabled.

## Booking correctness

A booking transaction obtains a shared lock on the venue and an exclusive lock on its slot. It checks active venue state, blocking, future start time, and current confirmed booking before inserting the server-controlled price. The venue lock coordinates with deactivation. Cancellation, blocking, deletion, and repricing coordinate through the slot lock.

The database independently enforces one confirmed booking per slot:

```sql
active_slot_id INT GENERATED ALWAYS AS
  (IF(status = 'CONFIRMED', slot_id, NULL)) STORED,
UNIQUE KEY one_active_booking_per_slot (active_slot_id)
```

Cancelled rows generate NULL and remain as history. Duplicate active-slot errors return HTTP 409. Slot generation and manual additions lock the venue to serialize overlap checks. A time window overlaps when `existing.start < proposed.end AND existing.end > proposed.start`; adjacent slots are valid.

Slots with booking history cannot be deleted. Blocking an actively booked slot is refused. Time windows cannot be edited through the API. Changing slot price affects new bookings only. Deactivating a venue hides it from discovery and prevents new bookings while preserving existing booking access and cancellation.

## Identity and security

Signup and OTP are outside the assignment scope. Booking creation issues a random 256-bit capability token. Only its SHA-256 hash is stored in MySQL. The browser retains the token in local storage and supplies it in the `x-booking-token` header to read or cancel that booking. Display references and phone numbers do not grant access. The access hash is excluded from API responses.

“My bookings” lists the references stored in the current browser. It deliberately has no phone-number search endpoint. Clearing browser storage loses access; cross-device recovery needs verified identity/OTP. Treat the browser/device as trusted; local storage tokens are accessible to scripts on the same origin, so preventing XSS remains important.

Admin JWTs expire after eight hours and are kept in session storage. Credentials come from the environment, with constant-time comparisons. Helmet, input allowlisting/validation, and a bounded process-local rate limiter are included. The limiter is suitable for this single-instance demo, not a distributed deployment. Production startup requires explicit `JWT_SECRET` and `ADMIN_PASSWORD`.

## Time and money

All venues are assumed to be in India. Slot date/time values are venue-local IST; checks convert them with the explicit `+05:30` offset. Metadata timestamps use UTC. Cancellation is free until the slot starts; repeat cancellation is idempotent. Overnight slots are not supported.

All prices are integer **paise**. For example, `65000` means ₹650. Booking amounts are copied from the slot inside the transaction. There is no payment processor; “confirmed” means a reserved slot, not money collected.

## API overview

Public:

- `GET /api/health`
- `GET /api/venue-filters` — distinct sports and neighbourhoods from active database venues
- `GET /api/venues?sport=&location=&q=`
- `GET /api/venues/:id`
- `GET /api/venues/:id/slots?date=YYYY-MM-DD`
- `POST /api/bookings` — `{ slotId, name, phone, email? }`
- `GET /api/bookings/:reference` — private booking token header
- `POST /api/bookings/:reference/cancel` — private booking token header

Admin:

- `POST /api/admin/login` — `{ username, password }`
- `GET / POST /api/admin/venues`
- `PUT / DELETE /api/admin/venues/:id` — delete means deactivate
- `GET / POST /api/admin/venues/:id/slots`
- `POST /api/admin/venues/:id/slots/generate` — `{ from, to, opens, closes, duration }`
- `PATCH / DELETE /api/admin/slots/:id`
- `GET /api/admin/bookings?venueId=&date=&status=`

Protected endpoints require `Authorization: Bearer <JWT>`. Errors use `{ error: { code, message } }`. Amounts in API requests/responses are paise; times are IST. Admin booking lists are capped at 500 records for this demo; production needs pagination.

## Demo walkthrough

1. Filter by a sport and open a venue.
2. Pick tomorrow's date, choose a slot, and book using sample details.
3. View the confirmation and refresh it to verify secure retrieval.
4. Visit “My bookings,” cancel the game, and check availability again.
5. Sign in to admin, edit a venue, generate slots, change a slot price, and view bookings.
6. Run the concurrency test and explain both the slot lock and unique database constraint.

## Tradeoffs and future work

One venue represents one bookable resource; separate courts require a resource entity and resource-level overlap rules. No payments, holds, notifications, user accounts, OTP recovery, multi-slot booking, image uploads, or recurring opening-hours engine. Venue deactivation is intentionally one-way in this demo admin UI. The customer booking form stacks below slot selection on mobile rather than using a bottom sheet.

Before production: verified customer identity and recovery, hardened admin authentication, secret rotation, HTTPS, backup/restore, pagination, shared rate limiting, observability, idempotency keys for safe POST retries, and bounded deadlock retry handling. Cache venue discovery only after measuring need; availability must always be validated against MySQL in the booking transaction. Add Redis or search infrastructure when traffic/search requirements justify them.

Dependency audit at implementation time reported no high/critical runtime advisories and five moderate runtime findings through the TypeORM and React Router dependency trees. Review those advisories and their major-version upgrade paths before a production deployment; no forced major upgrades were applied during the assessment build.

Additional illustrative photography: [swimming lanes by Markus Spiske](https://unsplash.com/photos/a-row-of-blue-and-white-striped-swimming-lanes-OAg9u5E1ju0) and [table tennis by Anshul Gurjar](https://unsplash.com/photos/blue-ping-pong-table-with-white-net-Nteb1TZR4Jo), via Unsplash.

## Design reference

The visual direction was reviewed against [Hudle's official website](https://www.hudle.in/): teal identity, blue calls to action, Inter typography, a full-width sports hero, search by venue/sport/location, and image-led sport categories. The assessment app adapts these cues with its own layout and copy. It uses fictional demo venues and is not the official Hudle service.

Venue details automatically selects tomorrow once every scheduled slot start for today has passed (IST). It checks every 15 seconds while open. Explicit date selections remain under the user's control. Run `npm run test -w web` for the six date-selection checks, including 11:55 PM and year rollover.
