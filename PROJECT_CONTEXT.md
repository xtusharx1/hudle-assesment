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
4. Customer JWT authentication and user ownership are required for creating, listing, reading and cancelling bookings. Never authorize by phone/email/reference alone.
5. Admin routes require an admin JWT, except login.
6. Slot creation and bulk generation serialize through the venue lock and reject/skip overlapping windows. Adjacent windows are valid.
7. Historical slots cannot be deleted. A confirmed booking prevents blocking its slot. Date/time edits are not exposed.
8. Inactive venues reject new bookings, but existing customer booking access remains valid.
9. API business-time comparisons explicitly use IST. Money is integer paise.
10. Integration tests may reset only an isolated database ending in `_test`.

## Data and identity

`venues` -> `slots` -> `bookings`; `seed_batches` records the one-time expansion seed. Foreign keys restrict destructive deletes.

Customer accounts and bookings live in MySQL. Registration uses unique normalized email, name, phone and a scrypt-hashed password. `auth_sessions` stores rotating refresh hashes with an absolute 30-day expiry. Access JWTs last 15 minutes, have customer issuer/audience/role/session claims, and require a live session. HttpOnly SameSite=Strict cookies keep customer tokens out of JavaScript; production cookies require HTTPS. Frontend automatic refresh is single-flight. Logout deletes the current session. Customer and admin authentication stay separate.

`bookings.user_id` owns new bookings; contact details come from the authenticated profile. Account history is available across browsers after login. Historical guest bookings have null ownership and stay admin-visible; never auto-claim them by unverified contact details. The legacy nullable access_hash is retained but unused for public access. Auth pages preserve venue/date/slot selection through a validated local return URL.

Admin credentials are environment variables. Eight-hour admin JWTs are stored in session storage. There is one admin account; no admin user table or role-management screen.

Favourites are local storage. Web fonts require internet. Sport/venue photography is bundled in `web/public/images`; venue image paths are stored in MySQL. Ratings are seeded values without a review system.

## Source map

| Area                                | Files                                                      |
| ----------------------------------- | ---------------------------------------------------------- |
| Bootstrap, validation, rate limiter | `server/src/main.ts`, `server/src/app.ts`                  |
| HTTP routes                         | `server/src/controllers.ts`                                |
| Venue, filter, slot rules           | `server/src/catalog.ts`                                    |
| Booking transactions and ownership  | `server/src/bookings.ts`                                   |
| JWT guard and errors                | `server/src/common.ts`                                     |
| DTOs and IST helpers                | `server/src/dtos.ts`, `server/src/time.ts`                 |
| Database, migrations, seeds         | `server/src/database/`                                     |
| API tests                           | `server/test/booking.e2e.spec.ts`                          |
| Customer authentication             | `server/src/auth.ts`, `web/src/Auth.tsx`                   |
| Customer routes                     | `web/src/App.tsx`                                          |
| Admin interface                     | `web/src/Admin.tsx`                                        |
| API types and session refresh       | `web/src/api.ts`                                           |
| Automatic date selection            | `web/src/booking-date.ts`, `web/test/booking-date.test.ts` |
| Shared loading/error UI             | `web/src/Status.tsx`                                       |
| Styling                             | `web/src/styles.css`                                       |

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
- Email/mobile verification, password recovery, profile editing and expired-session pruning are not implemented.
- Demo passwords must be changed before an external deployment.
- Existing README records moderate dependency advisories; assess upgrades before production.
- The CSS includes base rules and a later brand adaptation block; consolidate when redesigning further.

Prefer completing assessment flows over adding infrastructure. Redis, Elasticsearch and AWS are potential future decisions, not current dependencies. Never publish real customer records, local `.env` values, database volumes, passwords, tokens or browser session data.

## Booking transition

`web/src/BookingPending.tsx` renders an accessible overlay with a court/ball animation while submitting a booking. The API request starts immediately and runs alongside a minimum two-second display timer. Both success and failure wait for that timer; requests taking longer remain pending. A synchronous ref prevents duplicate submissions, the overlay captures focus and blocks background interaction, and CSS respects reduced-motion preferences. Confirmation is shown only after API success; conflicts return to the form with the API error.

## Account menu and motion

`web/src/Account.tsx` owns the header profile disclosure and the protected `/profile` page. Signed-in users get four cards: My profile, My bookings, Discover venues, Sign out. Guests get Sign in, Create account, Discover venues, Venue partners. The dropdown supports Escape, outside-pointer dismissal, focus leaving the panel, route dismissal and a viewport-contained mobile layout. Profile details come from the authenticated API profile; booking totals use the account-scoped bookings query.

`web/src/AuthTransition.tsx` provides the customer and partner login/logout modal animation, also used for customer registration. A native modal dialog makes the background inert and contains focus. Requests start immediately; the transition remains for at least 850ms, including failures, and longer while waiting for the server. Errors return to the form/menu. Customer actions have a synchronous concurrency guard. Logout clears UI identity only after API success.

The top-level route wrapper animates when the pathname changes. Booking tabs (including empty states), discovery filters/sorting, slot dates and admin table filters animate their updated content; controls have short active/hover transitions. Motion uses CSS only. `prefers-reduced-motion` disables all new decorative animations and transitions. The existing minimum two-second booking animation remains separate.

## QA audit and regressions (14 November 2026)

See `docs/QA_AUDIT.md` for the complete 26-item defect log, reproduction evidence, retests, and explicit remaining release limits. The regression suite now contains 29 real-MySQL API tests and 12 frontend tests.

Important changes from the audit:

- Never clear public/admin queries when changing customer identity. Only cancel/remove account booking queries. Synchronize other tabs via token-free storage events and focus checks; modern browsers coordinate refresh using Web Locks.
- Booking clients send `expectedPrice` in paise; reject a changed quote inside the slot lock with 409. Resolve selected slots from current availability. Booking responses include `venue_is_active` so past history does not send users to inactive venues.
- Query DTOs validate scalar filters and real dates. Venue text is trimmed before validation; photo URLs are parsed. Keyword search covers sports and escapes SQL wildcard characters as literals.
- Revoke logout sessions through either refresh hash or verified access JWT session claim, including a missing refresh-cookie case.
- `format.ts` handles exact paise and explicit IST dates; incoming booking links must fit the visible 14-day window. Frontend tests independently cover non-IST host timezones.
- `Dialog.tsx` is the shared native modal with Escape, explicit focus wrapping, scroll lock and busy-state dismissal guards. Auth transitions also contain focus. Keep pending cancellation actions disabled.
- Discovery committed filters/sort are stored in URL parameters so Back restores them. Mobile details require shrinking grid children (`min-width:0`); preserve this when changing layouts.
- `http.ts` decodes error responses safely, including proxy HTML and null JSON. API fetches have a 20-second bound; queries expose retry actions. `VenueImage.tsx` provides a bundled photo fallback.

The fictional QA venue was deactivated after testing; one cancelled QA booking and its user remain as audit history. Do not treat them as production customers or reset existing records to remove them.

## Compact account screens

Login and registration use an `auth-route` wrapper sized to the available viewport, without the marketing footer. Signup pairs name/mobile and password/confirmation on desktop; email spans both columns. At mobile widths the promotional panel is hidden and fields form one column. Reset global label/input margins inside `.auth-card` to avoid adding them to the grid gaps. Inputs keep at least 44px touch height, with 16px text on mobile. Do not use `overflow:hidden` or a hard fixed form height: validation errors, browser zoom, tiny viewports and the on-screen keyboard must remain scrollable when necessary. The primary account-page heading is the form title; the desktop promotional heading is secondary.
