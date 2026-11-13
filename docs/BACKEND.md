# Backend implementation guide

## Request path

Browser -> Vite/Nginx `/api` proxy -> NestJS controller -> injected service -> TypeORM transaction manager -> MySQL/InnoDB.

`main.ts` initializes the DataSource and migrations before listening. `app.ts` registers controllers/services/JWT, Helmet, CORS, validated DTO handling, a consistent error filter and a bounded single-process request limiter. The API is stateless apart from that limiter; durable business state is in MySQL.

## Schema

| Table           | Purpose                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `venues`        | Sport, location, address, description, image path, hourly price, rating, amenities, active flag |
| `slots`         | One venue's fixed date/start/end window, price and blocked flag                                 |
| `bookings`      | Historical customer booking, immutable amount, status, account ownership and display reference  |
| `users`         | Customer name, normalized unique email, mobile, salted password hash                            |
| `auth_sessions` | User session, rotating refresh-token hash, absolute expiry                                      |
| `seed_batches`  | Applied sample-content batches                                                                  |

`venues.id` -> `slots.venue_id`; `slots.id` -> `bookings.slot_id`. Restrictive foreign keys retain referenced history. Slots have unique venue/date/start keys, increasing time checks and nonnegative prices. A venue represents one bookable court, pitch, table or swimming lane.

## Booking transaction

1. Find the target slot's venue.
2. Take a shared venue lock to coordinate with deactivation.
3. Lock the slot with `SELECT ... FOR UPDATE`.
4. Reject inactive venues, blocked slots and started slots.
5. Check confirmed occupancy using a locking read.
6. Insert the authenticated user ID/profile, a reference and the locked slot's price.
7. Commit and return the booking (no token in the response).

All operations inside the transaction use its manager. The database additionally guarantees at most one confirmed record:

```sql
active_slot_id INT GENERATED ALWAYS AS
  (IF(status = 'CONFIRMED', slot_id, NULL)) STORED,
UNIQUE KEY one_active_booking_per_slot (active_slot_id)
```

Cancellation changes status to `CANCELLED`; the generated value becomes NULL. The old row stays while the slot becomes bookable. The duplicate occupancy constraint is translated to HTTP 409. The API does not accept the client's price or confirmation status.

## Customer authentication and ownership

`auth.ts` implements registration, login, access verification, refresh rotation and logout. Name/email/mobile are validated; email is lowercase and unique. Passwords have 10–128 characters and use scrypt with a random 16-byte salt, N=32768, r=8, p=1, and a 64-byte key. Invalid login uses a generic response and performs a password derivation even for missing accounts.

A login creates an independent `auth_sessions` row with a 30-day absolute expiry. `hudle_access` is a 15-minute HS256 JWT scoped to `/api`; claims include customer role, user ID, session ID, issuer `hudle-api`, and audience `hudle-customer`. `hudle_refresh` is a random 32-byte opaque token scoped to `/api/auth`. Cookies are HttpOnly, SameSite=Strict, and Secure in production unless explicitly disabled for local HTTP. Only the refresh hash is persisted. The guard checks both JWT validity and live session existence, allowing immediate logout revocation.

Refresh locks the matching live session and replaces its token hash atomically, so the previous token cannot be reused. The frontend coordinates concurrent refresh attempts and retries an expired request once. Logout deletes the current session and clears both cookies. Auth and customer booking responses use `Cache-Control: no-store`. Mutation origins must match `WEB_ORIGIN` when supplied; SameSite cookies add CSRF protection. Serve frontend and API through one site (the provided proxies do this).

All customer booking routes require `UserGuard`; the server uses the authenticated profile rather than client-supplied contact details. Lookup/cancellation include the owner ID; another user receives 404 without learning whether the reference exists. Cancellation is allowed only before the IST start and remains idempotent.

`user-accounts.ts` preserves existing bookings with nullable `user_id`; historical guest rows remain admin-visible and are not claimable by phone/email. The old nullable `access_hash` column is retained for data preservation but no longer authorizes access. Verification, password reset, account editing, session management UI and automated expired-session pruning are follow-up work.

## Slot and venue management

Single additions and bulk generation serialize on the venue row. Reject overlap when `existing.start < new.end AND existing.end > new.start`. Bulk generation accepts at most 31 days and 30–240 minute slots, skipping existing overlaps and past starts. Generated prices follow the venue's hourly rate and duration.

Repricing retains historical booking amounts. Blocking a confirmed slot and deleting any slot with booking history return conflicts. Venue deletion means deactivation, preserving historical customer access. Existing slot time windows are immutable through the API.

## HTTP endpoints

All paths begin `/api`.

| Method       | Path                                | Authorization       | Input / result                                              |
| ------------ | ----------------------------------- | ------------------- | ----------------------------------------------------------- |
| GET          | `/health`                           | Public              | Health and timezone                                         |
| GET          | `/venue-filters`                    | Public              | Distinct active sports/locations                            |
| GET          | `/venues`                           | Public              | Optional `sport`, `location`, `q` filters                   |
| GET          | `/venues/:id`                       | Public              | Active venue details                                        |
| GET          | `/venues/:id/slots?date=YYYY-MM-DD` | Public              | Date slots with availability state                          |
| POST         | `/auth/register`                    | Public              | `{name,email,phone,password}` -> profile and cookies        |
| POST         | `/auth/login`                       | Public              | `{email,password}` -> profile and cookies                   |
| POST         | `/auth/refresh`                     | Refresh cookie      | Rotated cookies and profile                                 |
| POST         | `/auth/logout`                      | Session cookie      | Revoke current session, clear cookies                       |
| GET          | `/auth/me`                          | Customer JWT cookie | Current profile                                             |
| GET          | `/bookings`                         | Customer JWT cookie | Account-owned booking history                               |
| POST         | `/bookings`                         | Customer JWT cookie | `{slotId}` -> 201 booking                                   |
| GET          | `/bookings/:reference`              | Customer JWT cookie | One authorized booking                                      |
| POST         | `/bookings/:reference/cancel`       | Customer JWT cookie | Cancelled booking                                           |
| POST         | `/admin/login`                      | Credentials         | `{username,password}` -> eight-hour JWT                     |
| GET          | `/admin/me`                         | Admin JWT           | Current admin role and username                             |
| GET / POST   | `/admin/venues`                     | Admin JWT           | List all / create                                           |
| PUT / DELETE | `/admin/venues/:id`                 | Admin JWT           | Edit / deactivate                                           |
| GET / POST   | `/admin/venues/:id/slots`           | Admin JWT           | Date query / `{date,start_time,end_time,price}`             |
| POST         | `/admin/venues/:id/slots/generate`  | Admin JWT           | `{from,to,opens,closes,duration}` -> created/skipped counts |
| PATCH        | `/admin/slots/:id`                  | Admin JWT           | `{is_blocked?,price?}`                                      |
| DELETE       | `/admin/slots/:id`                  | Admin JWT           | Delete only without history                                 |
| GET          | `/admin/bookings`                   | Admin JWT           | Optional `venueId`, `date`, `status`; max 500               |

Admin header: `Authorization: Bearer <JWT>`. Customer cookies are sent automatically by the browser; CLI clients can use a cookie jar. JSON requests use `Content-Type: application/json`.

Example booking request (replace `slotId` with a future available slot from the API):

```bash
curl -c /tmp/hudle-cookies -X POST http://localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo Player","email":"demo@example.com","phone":"9876543210","password":"DemoPassword!2026"}'
curl -b /tmp/hudle-cookies -X POST http://localhost:8080/api/bookings \
  -H 'Content-Type: application/json' -d '{"slotId":1}'
# Remove the temporary cookie jar after testing:
rm /tmp/hudle-cookies
```

Never put real tokens in checked-in example files, screenshots or URLs.

## Validation, errors and time

Global `ValidationPipe` transforms inputs, allowlists DTO fields and rejects unknown properties. Supported sports are declared in `VenueDto`; update admin choices alongside this allowlist when adding a sport.

Errors have `{ "error": { "code": "CONFLICT", "message": "..." } }`. Validation errors can have an array of messages. Expected statuses include 400, 401, 404, 409 and 429. Unexpected failures are logged and return a generic 500.

Prices are integer paise; ₹650 is `65000`. Slot date/time values are IST with explicit `+05:30` conversion for business checks. Metadata is UTC. Overnight time windows are unsupported. Public availability is derived at read time as AVAILABLE, BOOKED, BLOCKED or PAST.

## Migrations and tests

Migrations live in `src/database/schema.ts` `seed-batches.ts` and `user-accounts.ts` and are registered in `source.ts`. Add a new timestamped migration for later schema changes rather than rewriting an applied migration. MySQL DDL may commit independently; plan data-preserving migrations and backups.

The integration suite boots NestJS against a separate real MySQL schema, exercises parallel requests, checks database occupancy, account isolation, JWT/session protection, cancellation/rebooking, slot management, validation, dynamic filters and seed batch idempotence. Run commands in [SETUP.md](SETUP.md).

The assessment uses one bookable resource per venue. Payments, notifications and multi-slot bookings are outside its scope. See [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) for implementation context.

## Request details

`POST /bookings` additionally accepts optional `expectedPrice` (integer paise). The web client always supplies it; the transaction compares it to the locked slot price and returns 409 before insertion if the quote changed. `venue_is_active` is included in booking results for safe history navigation when a venue has been deactivated.

Discovery query DTOs accept only scalar `sport`, `location`, `q` values with bounded lengths. Keyword matching includes sport and treats SQL wildcard characters literally. Date queries validate real ISO calendar dates; admin booking filters validate venue ID/status/date. Venue name/location/address are trimmed before validation. Photo URLs must be valid HTTPS URLs without credentials or a supported bundled-image path.

Logout revokes the refresh-hash session and the session identified by a verified customer access JWT, so a missing refresh cookie cannot leave the access session usable.
