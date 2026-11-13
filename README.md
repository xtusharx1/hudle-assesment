# Hudle venue booking

A sports venue booking app built with React, NestJS, TypeORM and MySQL. Customers can discover venues, reserve slots and manage their bookings; admins manage venues, slots and booking history.

## Prerequisites

Docker with Compose. Local development and tests also require Node.js 22.18+ and npm.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build -d --wait
```

Open [localhost:8080](http://localhost:8080). Migrations and demo seeds run on startup. `docker compose down` stops the app and preserves the database volume.

## Run locally

```bash
npm ci
cp .env.example .env
docker compose up -d --wait db
npm run db:seed
npm run dev
```

Open [localhost:5173](http://localhost:5173). Stop the Docker API/web first if running: `docker compose stop api web`.

Demo admin: **admin / PlayWithHudle!2026** at `/admin/login` (configurable in `.env`). Register a customer account to book.

## Tests

Create the isolated `hudle_test` database using the [setup guide](docs/SETUP.md#tests), then run:

```bash
npm run build
DB_NAME=hudle_test npm test
```

API tests use real MySQL and reset only a database whose name ends in `_test`.

## Design decisions

- Slot-row locks and a unique active-booking index prevent double booking.
- Bookings belong to authenticated customer accounts; customers can access only their own records.
- Slot times use IST; prices are stored as integer paise.
- Venue deletion deactivates the venue while preserving booking history.

See [SETUP.md](docs/SETUP.md) for configuration and [BACKEND.md](docs/BACKEND.md) for API, database and authentication details.

**Tools used:** AI-assisted tooling was used for implementation, refactoring and testing, as permitted by the assignment.
