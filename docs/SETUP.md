# Complete setup guide

## Requirements

- Git.
- Docker Desktop or Docker Engine with the Compose plugin, running.
- For host development/tests: Node.js 22.18+ (or a newer supported release) and npm.
- Available local ports: 8080 (Docker web), 3001 (API), 3308 (database), 5173 (Vite only).

Clone the repository and enter its root:

```bash
git clone https://github.com/xtusharx1/hudle-assesment.git
cd hudle-assesment
```

Keep commands at the repository root unless otherwise stated. All sample credentials below are disposable local-development defaults.

## Option A: full Docker setup

```bash
cp .env.example .env
docker compose up --build -d --wait
```

Open http://localhost:8080 and http://localhost:8080/admin.

Register a customer at `/register`, or sign in at `/login`. There is no seeded customer account. You must sign in before confirming a booking; refreshing/reopening the browser keeps the session.

Local admin: `admin` / `PlayWithHudle!2026`. MySQL: `hudle` / `hudle_local`, database `hudle`. Defaults can be overridden in `.env`. API startup runs migrations, then inserts demo data when needed. Existing data persists between restarts.

```bash
docker compose ps
docker compose logs --tail=100 api web db
curl http://localhost:8080/api/health
docker compose down
```

`down` stops services but retains the named database volume. Avoid `down -v` unless you intentionally want to erase your local database.

On macOS with an existing Colima installation, start it with `colima start` if Docker reports it cannot connect to the daemon.

## Option B: edit frontend and backend locally

Install dependencies and start only the database in Docker:

```bash
npm ci
cp .env.example .env
docker compose up -d --wait db
npm run db:seed
npm run dev
```

If the full Docker app is already running, first stop its API and web with `docker compose stop api web`. Keep the database running. The local and Docker APIs both bind port 3001.

Local URLs:

| Service           | URL                              |
| ----------------- | -------------------------------- |
| React / Vite      | http://localhost:5173            |
| Admin             | http://localhost:5173/admin      |
| Direct API health | http://127.0.0.1:3001/api/health |
| MySQL             | 127.0.0.1:3308                   |

Vite proxies `/api` to 3001, so no frontend environment variable is required locally. NestJS reloads when its source changes. Root `.env` is loaded by the backend database configuration. Environment variables supplied by the shell/Compose take precedence.

## Environment variables

| Variable           | Local default                                 | Meaning                                                |
| ------------------ | --------------------------------------------- | ------------------------------------------------------ |
| `DB_HOST`          | `127.0.0.1`                                   | Host DB address; Compose API uses `db`                 |
| `DB_PORT`          | `3308`                                        | Host mapped port; Compose API uses 3306                |
| `DB_USER`          | `hudle`                                       | MySQL user                                             |
| `DB_PASSWORD`      | `hudle_local`                                 | MySQL user password                                    |
| `DB_NAME`          | `hudle`                                       | Application schema                                     |
| `DB_ROOT_PASSWORD` | `root_local_only` in Compose                  | Local DB initialization/admin password                 |
| `PORT`             | `3001`                                        | API listening port                                     |
| `WEB_ORIGIN`       | `http://localhost:5173,http://localhost:8080` | Comma-separated allowed origins for CORS and mutations |
| `COOKIE_SECURE`    | `false` locally                               | Set `true` with HTTPS; production defaults to secure   |
| `ADMIN_USERNAME`   | `admin`                                       | Single admin login                                     |
| `ADMIN_PASSWORD`   | `PlayWithHudle!2026`                          | Single admin password                                  |
| `JWT_SECRET`       | See `.env.example`                            | Signing secret; replace for deployment                 |
| `VITE_API_URL`     | empty                                         | Optional frontend API origin; set at Vite build time   |

Changing MySQL passwords in `.env` after the volume has been initialized does not automatically change existing database users. Update the existing user intentionally instead of deleting data to solve the mismatch.

## Database initialization and seeds

TypeORM applies versioned migrations on connection initialization; `synchronize` is disabled. The base seed creates six venues only when the venue table is empty. The expansion seed adds twelve once, tracked by `seed_batches`. Re-running the seed preserves existing venues, bookings and admin slot changes.

```bash
npm run db:seed
```

Dates are generated relative to the first seed execution. The seed is not a rolling daily scheduler; use the admin bulk generator to create later availability as the demo ages.

## Tests

The API suite uses a real, isolated MySQL database. Create it once:

```bash
docker compose exec db mysql -uroot -p
```

Enter the local root password (`root_local_only` unless overridden), then run:

```sql
CREATE DATABASE IF NOT EXISTS hudle_test;
GRANT ALL PRIVILEGES ON hudle_test.* TO 'hudle'@'%';
exit
```

Install host dependencies if needed, then run:

```bash
DB_NAME=hudle_test npm test
```

For PowerShell:

```powershell
$env:DB_NAME = "hudle_test"
npm test
Remove-Item Env:DB_NAME
```

The API suite refuses any database name not ending in `_test`. It deletes test records on setup; never point it at your normal application database. API tests do not need a separately running API process.

Individual suites:

```bash
DB_NAME=hudle_test npm run test -w server
npm run test -w web
```

The frontend date tests use Node's built-in TypeScript stripping. They cover 11:55 PM, the final start-time boundary, manual/future dates, empty schedules, IST and year rollover.

## Builds and formatting

```bash
npm run build
npm run format
```

Build outputs are `server/dist` and `web/dist` and are ignored by Git. Rebuild the Docker preview after source changes:

```bash
docker compose up --build -d --wait
```

## Troubleshooting

| Symptom                                                   | Action                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Docker connection error                                   | Start Docker Desktop or your installed Docker runtime                                       |
| Address already in use on 3001                            | Stop the Docker API before starting local development, or stop the local API before Compose |
| Wrong app / no API on 5173                                | Use Docker on 8080, or start this repository's `npm run dev`                                |
| API cannot authenticate to MySQL                          | Check `.env` against credentials used to initialize the existing volume                     |
| Empty “My bookings”                                       | Sign in to the account that created the booking; historical guest rows are admin-only       |
| Today's slots have all started                            | The untouched date automatically advances to tomorrow in IST                                |
| No future slots                                           | Generate more through admin; seeding does not extend schedules on every restart             |
| Temporary 502 after independently replacing API container | Restart web with `docker compose restart web` so Nginx resolves the replacement API         |
| Fonts unavailable                                         | The browser falls back to sans-serif; booking data and bundled photos still work            |

## Before external deployment

Use a hosted MySQL instance with backups; supply private environment values, HTTPS, a strong JWT secret and a changed admin password. Set `COOKIE_SECURE=true` and configure `WEB_ORIGIN` for the exact frontend origin. Host the API under the same site, preferably `/api` through a reverse proxy; SameSite=Strict cookies intentionally do not support unrelated frontend/API domains. Customer access JWTs expire after 15 minutes, with automatic refresh up to the session’s 30-day absolute expiry. Do not publish `.env` or database volumes. No cloud account or hosted deployment is included in this repository.
