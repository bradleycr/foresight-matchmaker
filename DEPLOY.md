# Deploy

Two hosts, one repo (`main`).

| Host | URL | Database | Status |
| --- | --- | --- | --- |
| **Vercel** | https://foresightmatchmaker.app | SQLite in `/tmp` — **wiped on deploy and cold start** | **Live now.** Use this until a VM exists. |
| **Linux VM (Hetzner or YCluster)** | set `APP_URL` | SQLite in `./data` on disk — **survives rebuilds** | Clone `main` when someone has time. |

The app is the same on both. Magic links are HMAC-signed in the URL (no sticky sessions). Mail is Resend (`RESEND_API_KEY`) or SMTP (`SMTP_URL`). Do not copy the Vercel `/tmp` database onto a VM — it is empty after a cold start and is not a source of truth.

---

## A. Vercel (working production)

No VM required. Env vars are already on the linked project (`bradley-royes-projects/foresight-matchmaker`). Redeploy from the repo root:

```bash
git pull
vercel deploy --prod --scope bradley-royes-projects --yes
```

Smoke tests and the env table: [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md).

Leave `SEED_ON_EMPTY` unset. Real listings on Vercel disappear on cold start — that is the reason to move to a VM later, not a reason to seed production.

---

## B. Hetzner (or any Linux VM) — persistent SQLite

Clone `main`, Docker Compose, bind-mounted `./data`. Same steps on Hetzner, YCluster, or a laptop.

### First bring-up

```bash
git clone https://github.com/bradleycr/foresight-matchmaker.git
cd foresight-matchmaker
cp .env.example .env
```

Edit `.env` (see below), then:

```bash
mkdir -p data
docker compose up -d --build
```

Put HTTPS in front of `127.0.0.1:3000` (Caddy, nginx, or the host’s load balancer). Point DNS at the VM. Set `APP_URL` to that public origin (no trailing slash).

The database is `./data/app.db` on the host (bind-mounted to `/data`). **Do not delete `./data`.** A container rebuild must keep it.

You do **not** need to chown `./data`. The container starts as root, claims the directory for uid 1000, then drops to the unprivileged app user. On first start you will see this in the logs, which is normal:

```
[entrypoint] Claiming /data for uid 1000 (was uid 0)
```

If instead you see `[db] Cannot open the SQLite database`, the volume is not writable — run `chown -R 1000:1000 data` and restart. Nothing is lost; the app refuses to start rather than accepting profiles it cannot store.

Leave `SEED_ON_EMPTY` unset. A fresh volume stays empty until real people register.

If an older image filled the file with fabricated `.invalid` emails, purge them **once** after the first good build — do not do this if real listings exist:

```bash
DATABASE_PATH=./data/app.db pnpm db:purge-synthetic
```

Or open `/admin`, unlock, and use **Remove seed listings**. **Never** run `pnpm db:reset` on this host — that puts the fakes back.

### Updating the image (keep the database)

```bash
cd foresight-matchmaker
git pull origin main
docker compose up -d --build
```

Compose always sets `DATABASE_PATH=/data/app.db`. Rebuilds replace the container only. `./data` on the host is not touched.

If `git pull` fails because the checkout is dirty, stop — do not wipe `./data` to “fix” it.

### Back up the database

Set this up on day one. SQLite in WAL mode is **three files**:

```
data/app.db        data/app.db-wal        data/app.db-shm
```

Copying `app.db` alone can silently lose the newest listings.

```bash
# A. Stop first (SIGTERM folds the WAL), then copy one file.
docker compose stop web
cp data/app.db /var/backups/matchmaker-$(date +%F-%H%M).db
docker compose start web
```

```bash
# B. Hot backup, no downtime — copy all three files together.
tar czf /var/backups/matchmaker-$(date +%F-%H%M).tar.gz data/
```

A daily `cron` using B is enough. To restore, stop the container, drop the files back into `./data`, and start it again.

### `.env` on the VM

```bash
SESSION_SECRET=          # required — openssl rand -hex 32
ADMIN_SECRET=            # real secret for /admin (page also accepts password123)
APP_URL=https://your-hostname.example
AUTH_REVEAL_LINKS=true   # keep until inbox delivery is confirmed
RATE_LIMIT_PER_24H=20

# Mail — Resend (same as Vercel) or a local SMTP relay
# RESEND_API_KEY=
# SMTP_FROM=Foresight Matchmaking <hello@foresightmatchmaker.app>
# SMTP_URL=

# Remmy (optional; form works without these)
# LLM_BASE_URL=https://dev1.ycluster.net/v1
# LLM_MODEL=deepseek-v4-flash
# LLM_API_KEY=             # mint at https://dev1.ycluster.net/admin/settings/api-keys
```

Do **not** set `DATABASE_PATH` in `.env` — `docker-compose.yml` already points at `/data/app.db`.

`SESSION_SECRET` is required. The container **refuses to boot** in production without it (`[boot] Missing required environment variable(s)` in `docker compose logs`).

`APP_URL` must match the public HTTPS origin. Magic links and Open Graph use it.

If Resend/SMTP is unset, set `AUTH_REVEAL_LINKS=true` so `/signin` and `/register` can show a link. Prefer real mail in production.

`LLM_*` unset is fine: `/register` is the form only, no Remmy chat. Do not put OpenAI or Anthropic keys in `.env`.

### Check it

```bash
curl -sI https://your-hostname.example/
curl -sI https://your-hostname.example/signin
curl -sI https://your-hostname.example/register
docker compose ps
docker compose logs --tail=80 web
ls -l ./data/app.db
curl -s https://your-hostname.example/api/v1/stats
```

`/`, `/signin`, and `/register` should be `200`. Logs must not contain `[boot] Missing required`. `./data/app.db` should exist after first start. `by_challenge` may be `{}` — empty directory, not a broken app. Do not seed to make the numbers look populated.

### Sign-in (verify-first)

1. `/register` — confirm email (magic link). Then fill the listing and submit.
2. Later: `/signin` with the same email.
3. One listing per email. Delete under **Your listing** (`/me`) to add a different type without re-confirming email.

Remmy (only if `LLM_*` is set) never publishes. Submit on the form is the only write.

`/admin` unlocks with `ADMIN_SECRET` (the page also accepts `password123` as a fallback).

---

## Do not

- Point `DATABASE_PATH` at `/tmp` on a VM
- Set `SEED_ON_EMPTY=true` on any host real applicants see
- Run `pnpm db:reset` or `pnpm db:seed` against `./data`
- Delete or recreate `./data` between deploys
- Add Redis, Postgres, or a vector store
- Put OpenAI or Anthropic keys in `.env`
- Copy listings from Vercel onto the VM
- Expect dummy / seed profiles on a production VM
