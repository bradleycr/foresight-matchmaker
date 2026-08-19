# Deploy on YCluster (sysops)

**This VM is not live until you finish the steps below.** Until then the public
site is Vercel (https://foresight-matchmaker.vercel.app) — smoke only. Its
SQLite file lives in `/tmp` and **every deploy / cold start wipes listings**.
Do not copy that database here.

Thursday host once this box is up: **https://foresight-matchmaker.dev.ycluster.net**

One Docker container. SQLite on a **host disk volume**. Remmy (optional) talks
to the Berlin inference gateway. No extra database, no OpenAI, no memory service.

---

## First bring-up

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

Put HTTPS in front of `127.0.0.1:3000`. Point DNS `foresight-matchmaker.dev.ycluster.net` at this VM.

The database is `./data/app.db` on the host (bind-mounted to `/data` in the container). **Do not delete `./data`.** A container rebuild must keep it.

Leave `SEED_ON_EMPTY` unset. A fresh volume stays empty until real people register. That is correct — there are **no dummy profiles** on this host.

If an older image already filled the file with fabricated `.invalid` emails, purge them **once** after the first good build — do not do this if real listings exist:

```bash
# from the repo on the VM, against the bind-mounted database
DATABASE_PATH=./data/app.db pnpm db:purge-synthetic
```

Or open `/admin`, unlock, and use **Remove seed listings**. **Never** run `pnpm db:reset` on this host — that puts the fakes back.

---

## Updating the image (keep the database)

```bash
cd foresight-matchmaker
git pull
docker compose up -d --build
```

Compose always sets `DATABASE_PATH=/data/app.db`. Rebuilds replace the container only. `./data` on the host is not touched.

If `git pull` fails because the checkout is dirty, stop and tell Bradley — do not wipe `./data` to “fix” it.

---

## `.env` for this host

```bash
SESSION_SECRET=          # required — openssl rand -hex 32
ADMIN_SECRET=            # send this value to Bradley
APP_URL=https://foresight-matchmaker.dev.ycluster.net
AUTH_REVEAL_LINKS=true
RATE_LIMIT_PER_24H=20

# Remmy + paste-to-prefill (optional; the form works without these)
LLM_BASE_URL=https://dev1.ycluster.net/v1
LLM_MODEL=deepseek-v4-flash
LLM_API_KEY=             # mint at https://dev1.ycluster.net/admin/settings/api-keys
```

Do **not** set `DATABASE_PATH` in `.env` — `docker-compose.yml` already points at `/data/app.db`.

`SESSION_SECRET` is required. The container **refuses to boot** in production without it (you will see `[boot] Missing required environment variable(s)` in `docker compose logs`).

`APP_URL` must match the public HTTPS origin (no trailing slash). Magic links and Open Graph use it.

Leave `SMTP_URL` unset for Thursday. With `AUTH_REVEAL_LINKS=true`, sign-in is on the page: enter the profile contact email → **Sign in**. No email, no extra confirm screen. Creating a profile also signs that person in immediately.

If the box can reach the gateway on cluster DNS, you may set `LLM_BASE_URL` to that internal URL. The public `https://dev1.ycluster.net/v1` is the known-good value. Do not put OpenAI or Anthropic keys in `.env`.

`LLM_*` unset is fine: `/register` is the form only, no Remmy chat.

---

## Check it

```bash
curl -sI https://foresight-matchmaker.dev.ycluster.net/
curl -sI https://foresight-matchmaker.dev.ycluster.net/signin
curl -sI https://foresight-matchmaker.dev.ycluster.net/register
docker compose ps
docker compose logs --tail=80 web
ls -l ./data/app.db
```

`/` , `/signin`, and `/register` should be `200`. Logs must not contain `[boot] Missing required`. `./data/app.db` should exist after first start (empty directory is OK).

```bash
curl -s https://foresight-matchmaker.dev.ycluster.net/api/v1/stats
```

`by_challenge` may be `{}` — that means no listings yet, not a broken app. Do not seed to make the numbers look populated.

Then tell Bradley the URL is live and send `ADMIN_SECRET`.

---

## Sign-in and Remmy (so you can smoke-test)

1. Open `/register` → **Add your profile** (organisation, AI team, consortium, or individual).
2. Submit. You are signed in on that device — there is no magic-link box afterwards.
3. Later visits: `/signin`, same contact email, **Sign in**. An unknown email still shows a link that then fails (anti-enumeration) — that is expected on an empty directory.
4. If a leftover cookie points at a listing that is gone, `/me` signs the person out instead of erroring. They can **Add your profile** again.

### Remmy (only if `LLM_*` is set)

`/register` offers chat. Remmy **never publishes**. Submit on the form is the only write.

- First message: tap a profile type (chips). Do not type the 24 modality names.
- Data holders: Remmy then asks dataset name, then **tappable** modality and disease-area chips (Imaging — MRI, Oncology, …). Those fields **are** the listing.
- AI teams and independent experts: methods / domain chips. They do **not** have to pick which data they need in order to create a profile — that block is optional. “Not sure yet” is a valid skip.
- **Fill form** / **Add more to the form** merges chat into the form. Chat stays available. Contact email is never auto-filled.

If Remmy is down, use **Fill in the form**. The directory still works.

`/admin` unlocks with `ADMIN_SECRET` (the page also accepts `password123` as a fallback — still send Bradley the real secret).

---

## Do not

- Point `DATABASE_PATH` at `/tmp`
- Set `SEED_ON_EMPTY=true` on this host
- Run `pnpm db:reset` or `pnpm db:seed` against `./data`
- Delete or recreate `./data` between deploys
- Add Redis, Postgres, or a vector / memory store
- Put OpenAI or Anthropic keys in `.env`
- Copy listings from Vercel — that database is ephemeral and is not this one
- Expect dummy / seed profiles on this host
