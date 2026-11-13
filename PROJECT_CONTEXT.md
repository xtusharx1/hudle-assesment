# Project context: Hudle venue booking assessment

This file describes the implemented assignment and the decisions needed to continue working on it. Keep changes focused on the assessment and the user's requested features; do not add audit reports, release checklists or production-readiness roadmaps.

## Scope

The application supports venue discovery, date-based slot availability, account registration/login, booking, My bookings, cancellation, and a simple venue admin. Customer accounts, the profile menu, animations and compact signup/login screens were requested during implementation.

One venue represents one bookable court, pitch, table or lane. Payments, notifications, multi-slot reservations, OTP verification and password recovery are outside the assignment scope.

## Stack and setup

- Frontend: React 18, Vite, TypeScript, React Router, TanStack Query, Lucide and responsive CSS.
- Backend: NestJS, class-validator DTOs, JWT authentication and TypeORM transactions with parameterized SQL.
- Database: MySQL 8.4 with explicit migrations; schema synchronization is disabled.
- Local runtime: Docker Compose services `db`, `api`, `web`; Nginx serves the frontend and proxies `/api`.
- URLs: Docker app on 8080, API on 3001, database on 3308. Vite development uses 5173. Run one API at a time.

See [SETUP.md](docs/SETUP.md) for commands and environment configuration, and [BACKEND.md](docs/BACKEND.md) for the API reference.

## Data

`venues` → `slots` → `bookings`; `users` own new bookings and `auth_sessions` hold login sessions. `seed_batches` tracks the one-time catalogue expansion.

The sample catalogue has 18 fictional venues across 8 sports and 15 neighbourhoods. Slots use 30-, 60- and 90-minute windows, varied hours, peak/weekend prices and maintenance blocks. Seeds preserve existing bookings and admin edits. Sport/location filters come from active venue records. Photography is illustrative and bundled in `web/public/images`; ratings are sample values.

## Booking rules

- At most one confirmed booking may exist per slot. Creation takes a shared venue lock and an exclusive slot lock, then inserts inside a transaction. A generated-column unique index independently enforces occupancy.
- The booking amount comes from the locked slot and remains unchanged after later repricing. The web client sends `expectedPrice` in paise; a changed quote returns 409 before insertion.
- Booking requires a signed-in customer. Only that customer can list, read or cancel their bookings; contact details come from their account.
- Cancellation is allowed before the slot starts. It keeps the historical row, releases availability and is idempotent.
- Slot additions/generation reject or skip overlaps. Adjacent windows are valid. Slots with booking history cannot be deleted, and confirmed slots cannot be blocked.
- Venue deletion means deactivation. It hides the venue from discovery and prevents new bookings while preserving access to existing bookings.
- Slot times use IST explicitly; metadata uses UTC. Money is integer paise and the UI preserves fractional rupees.
- Once all of today's slot starts have passed, an untouched date advances to tomorrow. Manual date selections remain under user control.

## Authentication

Customers register with name, normalized unique email, Indian mobile number and a scrypt-hashed password. Access JWTs last 15 minutes; rotating refresh sessions last up to 30 days. Customer tokens use HttpOnly SameSite cookies. Logout revokes the current session. Other tabs synchronize account changes without storing customer tokens in JavaScript.

The single admin account comes from environment variables. Its eight-hour JWT is stored in session storage and validated through `/api/admin/me`. A shared frontend auth provider resolves loading, guest, customer or admin state. Entering admin mode revokes the current customer session; logout clears the active role and private query caches.

Historical guest bookings remain admin-visible and are not automatically assigned by matching phone/email. Favourites are browser-local.

## Frontend behavior

- The profile icon shows Sign in / Sign up for guests, Profile / My bookings / Log out for customers, and Admin dashboard / All bookings / Log out for admins. Header navigation and route redirects follow the same role. `/profile` displays account details and booking totals.
- Discovery filters/sort are stored in URL parameters so Back restores them.
- Slot selection uses current availability and prices. A 409 refreshes the grid.
- Booking displays a minimum two-second court animation. Login/register/logout use shorter account transitions. Reduced-motion settings are supported.
- Shared dialogs support Escape, keyboard focus containment and disabled dismissal during pending mutations.
- Signup/login use a compact viewport layout without the marketing footer. Signup pairs related fields on desktop and uses a single column on phones. Inputs retain comfortable sizes; small screens, browser zoom, validation messages and keyboards may scroll naturally. Do not clip the form with `overflow:hidden`.

## Source map

| Area                                 | Files                                                  |
| ------------------------------------ | ------------------------------------------------------ |
| API bootstrap, routes and validation | `server/src/app.ts`, `controllers.ts`, `dtos.ts`       |
| Venue/slot operations                | `server/src/catalog.ts`                                |
| Booking transaction and ownership    | `server/src/bookings.ts`                               |
| Customer authentication              | `server/src/auth.ts`, `web/src/Auth.tsx`               |
| Database migrations and seeds        | `server/src/database/`                                 |
| Customer routes and account menu     | `web/src/App.tsx`, `Account.tsx`                       |
| Admin screens                        | `web/src/Admin.tsx`                                    |
| API client, formatting and dialogs   | `web/src/api.ts`, `http.ts`, `format.ts`, `Dialog.tsx` |
| Styling                              | `web/src/styles.css`                                   |

## Verification

Run `npm run build` and `DB_NAME=hudle_test npm test`. The suite has 30 real-MySQL API tests and 27 frontend tests covering booking conflicts, cancellation, authentication, validation, dates, formatting and role-based navigation. Tests may reset only a separate database ending in `_test`; never reset the normal app database for verification.
