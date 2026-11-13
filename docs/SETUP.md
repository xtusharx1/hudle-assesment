# Setup guide

## Requirements

- Docker with Compose; Node.js 22.18+ and npm for host development and tests.
- Default host ports: 8080 (web), 3001 (API), 3308 (MySQL), 5173 (Vite).

```bash
git clone https://github.com/xtusharx1/hudle-assesment.git
cd hudle-assesment
cp .env.example .env
```

The supplied credentials are local demo defaults. Register a customer before booking; there is no seeded customer account.

## Docker

```bash
docker compose up --build -d --wait
```

Open [localhost:8080](http://localhost:8080). Admin: `/admin/login`, with `admin` / `PlayWithHudle!2026`.

Migrations and demo seeds run on startup. `docker compose down` stops services and preserves the database volume. `down -v` deletes it.

## Host development

If the full stack is running, stop its API and web first; both development modes use the same database.

```bash
docker compose stop api web
npm ci
docker compose up -d --wait db
npm run db:seed
npm run dev
```

Open [localhost:5173](http://localhost:5173). Vite proxies `/api` to the backend `PORT` from `.env`. Run commands from the repository root.

## Configuration

Shell/Compose variables override `.env`. MySQL credentials are initialized only when its volume is first created.

| Variable                           | Default                             | Purpose                                                    |
| ---------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| `WEB_PORT`                         | `8080`                              | Docker web host port                                       |
| `API_PORT`                         | `3001`                              | Docker API host port                                       |
| `DB_PORT`                          | `3308`                              | Docker MySQL host port / host API connection               |
| `PORT`                             | `3001`                              | Host development API port; Docker keeps internal port 3001 |
| `DB_HOST`, `DB_USER`, `DB_NAME`    | `127.0.0.1`, `hudle`, `hudle`       | Host database connection                                   |
| `DB_PASSWORD`                      | `hudle_local`                       | MySQL application password                                 |
| `DB_ROOT_PASSWORD`                 | `root_local_only`                   | MySQL initialization root password                         |
| `WEB_ORIGIN`                       | See `.env.example`                  | Comma-separated allowed browser origins                    |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | `admin`, `PlayWithHudle!2026`       | Admin credentials                                          |
| `JWT_SECRET`                       | Development value in `.env.example` | JWT signing secret                                         |
| `COOKIE_SECURE`                    | `false` locally                     | Set `true` for HTTPS                                       |
| `VITE_API_URL`                     | empty                               | Optional frontend API origin, set at build time            |

For a port conflict, change `WEB_PORT`, `API_PORT` or `DB_PORT`. If the web origin changes, update `WEB_ORIGIN` too. Internal Docker service addresses remain unchanged. For a host API port change, update `PORT`; Vite reads it automatically.

## Demo availability

Demo venues initially receive 14 days of slots. Seeding and API startup extend their schedules, and the API checks hourly for new days. Extension adds days beyond the recorded schedule horizon; it does not overwrite existing slots, prices, blocks or deleted days. Custom venues remain admin-managed. Changing a seeded venue's name opts it out of name-based demo extension.

Customers have a two-week quick selector plus a date picker for any future date. Admin-generated slots beyond the quick selector remain bookable.

## Tests

Create a separate database once:

```bash
docker compose exec db mysql -uroot -p
```

Enter `DB_ROOT_PASSWORD`, then run:

```sql
CREATE DATABASE IF NOT EXISTS hudle_test;
GRANT ALL PRIVILEGES ON hudle_test.* TO 'hudle'@'%';
exit
```

```bash
npm ci
npm run build
DB_NAME=hudle_test npm test
```

Tests reset only an isolated database ending in `_test`. No separate API process is needed. Run a single suite with `DB_NAME=hudle_test npm run test -w server` or `npm run test -w web`.

## Troubleshooting

- Inspect services: `docker compose ps` and `docker compose logs --tail=100 api web db`.
- Health check: `curl http://localhost:8080/api/health` (adjust the web port if configured).
- If MySQL rejects credentials after an `.env` change, update the existing database user; changing `.env` does not change an initialized volume's password.
- If a custom venue has no availability, generate slots through its admin page.
- Browser mutations require an origin listed in `WEB_ORIGIN`. HTTPS requires secure cookies and explicit credentials/signing secrets.

See [BACKEND.md](BACKEND.md) for API contracts, authentication and database rules.
