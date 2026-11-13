# Backend implementation guide

## Request path

Browser -> Vite/Nginx `/api` proxy -> NestJS controller -> injected service -> TypeORM transaction manager -> MySQL/InnoDB.

`main.ts` initializes the DataSource and migrations before listening. `app.ts` registers controllers/services/JWT, Helmet, CORS, validated DTO handling, a consistent error filter and a bounded single-process request limiter. The API is stateless apart from that limiter; durable business state is in MySQL.

## Schema

| Table          | Purpose                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `venues`       | Sport, location, address, description, image path, hourly price, rating, amenities, active flag |
| `slots`        | One venue's fixed date/start/end window, price and blocked flag                                 |
| `bookings`     | Historical customer booking, immutable amount, status, private token hash and display reference |
| `seed_batches` | Applied sample-content batches                                                                  |

`venues.id` -> `slots.venue_id`; `slots.id` -> `bookings.slot_id`. Restrictive foreign keys retain referenced history. Slots have unique venue/date/start keys, increasing time checks and nonnegative prices. A venue represents one bookable court, pitch, table or swimming lane.

## Booking transaction

1. Find the target slot's venue.
2. Take a shared venue lock to coordinate with deactivation.
3. Lock the slot with `SELECT ... FOR UPDATE`.
4. Reject inactive venues, blocked slots and started slots.
5. Check confirmed occupancy using a locking read.
6. Insert customer details, a token hash, a reference and the locked slot's price.
7. Commit and return the booking with its access token once.

All operations inside the transaction use its manager. The database additionally guarantees at most one confirmed record:

```sql
active_slot_id INT GENERATED ALWAYS AS
  (IF(status = 'CONFIRMED', slot_id, NULL)) STORED,
UNIQUE KEY one_active_booking_per_slot (active_slot_id)
```

Cancellation changes status to `CANCELLED`; the generated value becomes NULL. The old row stays while the slot becomes bookable. The duplicate occupancy constraint is translated to HTTP 409. The API does not accept the client's price or confirmation status.

## Private booking access

Tokens contain 32 random bytes, encoded as base64url. Store only SHA-256 hashes server-side. Clients send the original token in `x-booking-token`; it is checked before returning or cancelling a record. Phone numbers and references alone cannot authorize operations. API responses exclude the hash.

Cancellation is allowed only before the slot's IST start. Repeat cancellation of an already-cancelled booking succeeds idempotently. Slots remain locked while cancellation changes occupancy.

## Slot and venue management

Single additions and bulk generation serialize on the venue row. Reject overlap when `existing.start < new.end AND existing.end > new.start`. Bulk generation accepts at most 31 days and 30–240 minute slots, skipping existing overlaps and past starts. Generated prices follow the venue's hourly rate and duration.

Repricing retains historical booking amounts. Blocking a confirmed slot and deleting any slot with booking history return conflicts. Venue deletion means deactivation, preserving historical customer access. Existing slot time windows are immutable through the API.

## HTTP endpoints

All paths begin `/api`.

| Method       | Path                                | Authorization | Input / result                                              |
| ------------ | ----------------------------------- | ------------- | ----------------------------------------------------------- |
| GET          | `/health`                           | Public        | Health and timezone                                         |
| GET          | `/venue-filters`                    | Public        | Distinct active sports/locations                            |
| GET          | `/venues`                           | Public        | Optional `sport`, `location`, `q` filters                   |
| GET          | `/venues/:id`                       | Public        | Active venue details                                        |
| GET          | `/venues/:id/slots?date=YYYY-MM-DD` | Public        | Date slots with availability state                          |
| POST         | `/bookings`                         | Public        | `{slotId,name,phone,email?}`; 201 plus private access token |
| GET          | `/bookings/:reference`              | Booking token | One authorized booking                                      |
| POST         | `/bookings/:reference/cancel`       | Booking token | Cancelled booking                                           |
| POST         | `/admin/login`                      | Credentials   | `{username,password}` -> eight-hour JWT                     |
| GET / POST   | `/admin/venues`                     | Admin JWT     | List all / create                                           |
| PUT / DELETE | `/admin/venues/:id`                 | Admin JWT     | Edit / deactivate                                           |
| GET / POST   | `/admin/venues/:id/slots`           | Admin JWT     | Date query / `{date,start_time,end_time,price}`             |
| POST         | `/admin/venues/:id/slots/generate`  | Admin JWT     | `{from,to,opens,closes,duration}` -> created/skipped counts |
| PATCH        | `/admin/slots/:id`                  | Admin JWT     | `{is_blocked?,price?}`                                      |
| DELETE       | `/admin/slots/:id`                  | Admin JWT     | Delete only without history                                 |
| GET          | `/admin/bookings`                   | Admin JWT     | Optional `venueId`, `date`, `status`; max 500               |

Admin header: `Authorization: Bearer <JWT>`. Booking header: `x-booking-token: <token>`. JSON requests use `Content-Type: application/json`.

Example booking request (replace `slotId` with a future available slot from the API):

```bash
curl -X POST http://localhost:8080/api/bookings \
  -H 'Content-Type: application/json' \
  -d '{"slotId":1,"name":"Demo Player","phone":"9876543210"}'
```

Never put real tokens in checked-in example files, screenshots or URLs.

## Validation, errors and time

Global `ValidationPipe` transforms inputs, allowlists DTO fields and rejects unknown properties. Supported sports are declared in `VenueDto`; update admin choices alongside this allowlist when adding a sport.

Errors have `{ "error": { "code": "CONFLICT", "message": "..." } }`. Validation errors can have an array of messages. Expected statuses include 400, 401, 404, 409 and 429. Unexpected failures are logged and return a generic 500.

Prices are integer paise; ₹650 is `65000`. Slot date/time values are IST with explicit `+05:30` conversion for business checks. Metadata is UTC. Overnight time windows are unsupported. Public availability is derived at read time as AVAILABLE, BOOKED, BLOCKED or PAST.

## Migrations and tests

Migrations live in `src/database/schema.ts` and `seed-batches.ts` and are registered in `source.ts`. Add a new timestamped migration for later schema changes rather than rewriting an applied migration. MySQL DDL may commit independently; plan data-preserving migrations and backups.

The integration suite boots NestJS against a separate real MySQL schema, exercises parallel requests, checks database occupancy, token protection, cancellation/rebooking, slot management, validation, dynamic filters and seed batch idempotence. Run commands in [SETUP.md](SETUP.md).

The current implementation intentionally omits payment collection, OTP, cross-device recovery, pagination, shared rate limiting, idempotent creation keys, background scheduling and multiple resources per venue. See [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) for handoff constraints.
