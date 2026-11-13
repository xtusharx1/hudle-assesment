# Project context: Hudle venue booking assessment

Read this file first when continuing development. It describes the implemented project, its constraints, and decisions that must survive a handoff.

## Purpose and scope

A two-day full-stack engineering assessment for Hudle. Required flows are venue discovery, venue details with date-based slots, booking using basic customer details, preventing duplicate bookings, viewing/cancelling upcoming bookings, a simple admin, and responsive screens. AI-assisted implementation was allowed by the supplied brief.

The application is an assessment demo, not Hudle's official service. Venue names, addresses, prices, ratings and descriptions are fictional sample content. Do not imply these are verified real-world facilities.

## Implementation

- Monorepo with npm workspaces: `server` and `web`.
- Frontend: React 18, Vite, TypeScript, React Router, TanStack Query, Lucide, custom CSS.
- API: NestJS, class-validator DTOs, injected services, JWT admin guard, consistent exception filter.
- Persistence: MySQL 8.4 / InnoDB, TypeORM DataSource, explicit versioned migrations and parameterized SQL. No schema synchronization and no in-memory mock booking store.
- Runtime: Docker Compose (`db`, `api`, `web`); Nginx serves the SPA and proxies `/api`.
- Tests: 13 real-database API integration tests and 6 frontend date-logic tests.

Start with [the full setup guide](docs/SETUP.md) and [backend documentation](docs/BACKEND.md).

## Product and design decisions

The design was reviewed against https://www.hudle.in/ and adapted to the assessment: teal identity, blue primary actions, Inter type, boxed uppercase wordmark, sports photography, a full-width hero and combined venue/sport/neighbourhood search. Copy and layout are adapted for this app. There is no real payment flow or celebrity endorsement.

The catalogue contains 18 sample venues across 8 sports and 15 neighbourhoods. The initial six use hourly slots; twelve additional venues use 30-, 60- and 90-minute sessions, different opening hours, peak/weekend pricing and maintenance blocks. Filters derive distinct sports and locations from active MySQL venue records. Admin sport choices are a validated supported list, not unrestricted user input.

Venue details defaults to today in IST. Once all scheduled start times for today have passed, an untouched date automatically advances to tomorrow. A 15-second timer checks the boundary while the screen remains open. Explicit user date choices are respected. A fully booked day is not automatically skipped solely because it is sold out; an empty schedule does not trigger the same fallback.

## Critical invariants

1. At most one confirmed booking per slot. A transaction locks the venue for sharing and slot for update. A generated-column unique index independently enforces the invariant.
2. Booking amount comes from the locked slot, never from a client-supplied price. Persist it as a historical snapshot.
3. Cancelled booking rows remain in the database. Cancellation releases uniqueness, enabling rebooking.
4. A private booking token is required for reading/cancelling bookings. A phone number or display reference is insufficient.
5. Admin routes require an admin JWT, except login.
6. Slot creation and bulk generation serialize through the venue lock and reject/skip overlapping windows. Adjacent windows are valid.
7. Historical slots cannot be deleted. A confirmed booking prevents blocking its slot. Date/time edits are not exposed.
8. Inactive venues reject new bookings, but existing customer booking access remains valid.
9. API business-time comparisons explicitly use IST. Money is integer paise.
10. Integration tests may reset only an isolated database ending in `_test`.

## Data and identity

`venues` -> `slots` -> `bookings`; `seed_batches` records the one-time expansion seed. Foreign keys restrict destructive deletes.

Customer bookings live in MySQL. The creation response includes a random 256-bit access token once; only its hash is stored in MySQL. The browser stores reference/token pairs in local storage and supplies `x-booking-token` for retrieval and cancellation. “My bookings” is therefore browser-local discovery of database-backed records. Clearing storage loses customer access; no OTP recovery exists.

Admin credentials are environment variables. Eight-hour admin JWTs are stored in session storage. There is one admin account; no admin user table or role-management screen.

Favourites are local storage. Web fonts require internet. Sport/venue photography is bundled in `web/public/images`; venue image paths are stored in MySQL. Ratings are seeded values without a review system.

## Source map

| Area                                    | Files                                                      |
| --------------------------------------- | ---------------------------------------------------------- |
| Bootstrap, validation, rate limiter     | `server/src/main.ts`, `server/src/app.ts`                  |
| HTTP routes                             | `server/src/controllers.ts`                                |
| Venue, filter, slot rules               | `server/src/catalog.ts`                                    |
| Booking transactions and private access | `server/src/bookings.ts`                                   |
| JWT guard and errors                    | `server/src/common.ts`                                     |
| DTOs and IST helpers                    | `server/src/dtos.ts`, `server/src/time.ts`                 |
| Database, migrations, seeds             | `server/src/database/`                                     |
| API tests                               | `server/test/booking.e2e.spec.ts`                          |
| Customer routes                         | `web/src/App.tsx`                                          |
| Admin interface                         | `web/src/Admin.tsx`                                        |
| API types and browser storage           | `web/src/api.ts`                                           |
| Automatic date selection                | `web/src/booking-date.ts`, `web/test/booking-date.test.ts` |
| Shared loading/error UI                 | `web/src/Status.tsx`                                       |
| Styling                                 | `web/src/styles.css`                                       |

## Running and validation

Docker preview is port 8080, API 3001, MySQL 3308. Local frontend development uses 5173. Run one API at a time to avoid a port collision. See `docs/SETUP.md` for exact commands and test database setup.

After frontend changes, build and check relevant desktop/mobile screens. For booking mutations, run the MySQL integration suite; mocks cannot verify row locks or unique constraints. Do not reset the normal `hudle` database to run tests.

## Known limits and follow-up work

- One bookable resource per venue; multiple courts require a resource entity.
- No payments, slot holds, OTP/account recovery, notifications, multi-slot reservations, uploads or recurring schedule engine.
- Admin venue deactivation has no reactivation UI.
- Admin booking list is capped at 500 without pagination.
- Process-local rate limiting; use a shared store for multiple API instances.
- No POST idempotency key, distributed deadlock retry policy or observability/backup automation.
- Local storage capability tokens require a trusted browser and XSS prevention.
- Demo passwords must be changed before an external deployment.
- Existing README records moderate dependency advisories; assess upgrades before production.
- The CSS includes base rules and a later brand adaptation block; consolidate when redesigning further.

Prefer completing assessment flows over adding infrastructure. Redis, Elasticsearch and AWS are potential future decisions, not current dependencies. Never publish real customer records, local `.env` values, database volumes, private access tokens or browser session data.
