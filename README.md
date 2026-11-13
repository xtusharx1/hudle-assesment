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

Open **http://localhost:5173**. The Vite proxy forwards `/api` to NestJS on port 3001. Database port 3308 avoids collisions with an existing local MySQL installation. If Docker is stopped on macOS with Colima installed, run `colima start` first.

Admin: **http://localhost:5173/admin**

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
- Registration/login, hashed passwords, account ownership, refresh rotation, logout revocation, and forged/expired JWT rejection.
- Past slots, blocked slots, inactive venues, input validation, and admin authorization.
- Overlap rejection and duplicate-safe bulk slot generation.
- Historical slot deletion refusal and immutable booking price after repricing.

## Stack and structure

- React 18, TypeScript, Vite, React Router, TanStack Query, Lucide icons, custom responsive CSS.
- NestJS controllers and injected services, class-validator DTOs, global role-based access guard, consistent exception responses.
- TypeORM DataSource / transaction manager and explicit SQL migrations on MySQL 8.4 / InnoDB.
- Docker Compose, Nginx, Jest, Supertest.

```text
server/src/
  app.ts                 Nest module and request configuration
  controllers.ts         Public and protected admin HTTP endpoints
  catalog.ts             Venue discovery, slot management, bulk generation
  bookings.ts            Account-owned booking transaction and cancellation
  auth.ts                Customer registration, JWT cookies, rotating sessions
  access.ts / rbac.ts     Public/role declarations and global authorization guard
  common.ts              Error filter and hashing helpers
  dtos.ts                Input contracts and validation
  time.ts                Explicit IST conversion and date validation
  database/source.ts     Connection and migration configuration
  database/schema.ts     Versioned schema migration
  database/seed.ts       Repeatable sample data
server/test/             Real-database HTTP integration tests
web/src/
  App.tsx                Customer routes and booking screens
  Admin.tsx              Admin sign-in, venues, slots, booking dashboard
  Auth.tsx               Registration, login, session context and protected routes
  api.ts                 Typed fetch clients and single-flight session refresh
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

Customers register with name, email, Indian mobile number and a password of at least 10 characters. Email is normalized and unique. Passwords use salted scrypt (N=32768, r=8, p=1), never plaintext. Booking requires login; the server copies contact details from the authenticated profile and stores `user_id` ownership. Only the owner can list, retrieve or cancel a booking. Another account receives 404.

Customer access JWTs last 15 minutes and use issuer/audience/role checks. Random refresh tokens rotate on each refresh; only SHA-256 hashes are stored in MySQL sessions. Sessions expire 30 days after login. Both cookies are HttpOnly and SameSite=Strict; HTTPS deployment uses Secure. JavaScript never stores customer tokens. The frontend refreshes an expired access token once and retries the request. Logout deletes the current session, immediately invalidating its access and refresh tokens. Other devices have independent sessions. Non-GET browser requests check the Origin allowlist, and authentication endpoints are rate limited.

“My bookings” is loaded from MySQL for the account and works on another browser after sign-in. The migration preserves historical guest rows without attaching them to accounts by unverified email/phone; those rows remain admin-visible. Existing local-storage guest tokens no longer grant public access. Email/mobile verification and password recovery are outside the assessment scope.

Admin JWTs expire after eight hours and are kept in session storage. The shared frontend session state controls menus and navigation for guests, customers and admins. Entering admin mode ends the current customer session; admin users are redirected away from customer-only pages. Credentials come from the environment, with constant-time comparisons. Helmet, input allowlisting/validation, and a bounded process-local rate limiter are included. The limiter is suitable for this single-instance demo, not a distributed deployment. Production startup requires explicit `JWT_SECRET` and `ADMIN_PASSWORD`.

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

Customer authentication:

- `POST /api/auth/register` — `{ name, email, phone, password }`
- `POST /api/auth/login` — `{ email, password }`
- `POST /api/auth/refresh` and `POST /api/auth/logout`
- `GET /api/auth/me` — signed-in profile

Customer endpoints (JWT cookie required):

- `POST /api/bookings` — `{ slotId }`
- `GET /api/bookings` — account history
- `GET /api/bookings/:reference` — owned booking
- `POST /api/bookings/:reference/cancel` — owned booking

Admin:

- `POST /api/admin/login` — `{ username, password }`
- `GET /api/admin/me` — validate the admin session and return its identity
- `GET / POST /api/admin/venues`
- `PUT / DELETE /api/admin/venues/:id` — delete means deactivate
- `GET / POST /api/admin/venues/:id/slots`
- `POST /api/admin/venues/:id/slots/generate` — `{ from, to, opens, closes, duration }`
- `PATCH / DELETE /api/admin/slots/:id`
- `GET /api/admin/bookings?venueId=&date=&status=`

Admin endpoints require `Authorization: Bearer <JWT>`; customer endpoints use HttpOnly cookies. Errors use `{ error: { code, message } }`. Amounts in API requests/responses are paise; times are IST. Admin booking lists are capped at 500 records for this demo.

## Demo walkthrough

1. Filter by a sport and open a venue.
2. Pick tomorrow's date, choose a slot, register or sign in, and confirm the booking.
3. View the confirmation and refresh it to verify secure retrieval.
4. Visit “My bookings,” cancel the game, and check availability again.
5. Sign in to admin, edit a venue, generate slots, change a slot price, and view bookings.
6. Run the concurrency test and explain both the slot lock and unique database constraint.
