# Deploy on YCluster (sysops)

Thursday host: **https://foresight-matchmaker.dev.ycluster.net**

One Docker container. SQLite on disk. Remmy talks to the Berlin inference gateway. No extra database, no OpenAI, no memory service.

## Bring it up

```bash
git clone https://github.com/bradleycr/foresight-matchmaker.git
cd foresight-matchmaker
cp .env.example .env
```

Edit `.env` (see below), then:

```bash
docker compose up -d --build
```

Put HTTPS in front of `127.0.0.1:3000`. Point DNS `foresight-matchmaker.dev.ycluster.net` at this VM.

The database is `./data/app.db` on the host. First boot seeds synthetic demo profiles. **Do not delete `./data`.** A container restart must keep it.

## `.env` for this host

```bash
SESSION_SECRET=          # openssl rand -hex 32
ADMIN_SECRET=            # send this value to Bradley
APP_URL=https://foresight-matchmaker.dev.ycluster.net
AUTH_REVEAL_LINKS=true
RATE_LIMIT_PER_24H=20

LLM_BASE_URL=https://dev1.ycluster.net/v1
LLM_MODEL=deepseek-v4-flash
LLM_API_KEY=             # mint at https://dev1.ycluster.net/admin/settings/api-keys
```

`APP_URL` must match the public HTTPS origin (no trailing slash).  
If the box can reach the gateway on cluster DNS instead, you may set `LLM_BASE_URL` to that internal URL; the public `https://dev1.ycluster.net/v1` is the known-good value.

Leave `SMTP_URL` unset for Thursday (`AUTH_REVEAL_LINKS=true` shows sign-in links on screen).

## Check it

```bash
curl -sI https://foresight-matchmaker.dev.ycluster.net/
curl -sI https://foresight-matchmaker.dev.ycluster.net/signin
docker compose ps
ls -l ./data/app.db
```

`/` and `/signin` should be `200`. Then tell Bradley the URL is live and send `ADMIN_SECRET`.

Keep https://foresight-matchmaker.vercel.app up as backup until he confirms this host.

## Do not

- Point `DATABASE_PATH` at `/tmp`
- Add Redis, Postgres, or a vector / memory store
- Put OpenAI or Anthropic keys in `.env`
- Wipe `./data` between deploys
