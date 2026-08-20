#!/bin/sh
# ---------------------------------------------------------------------------
# Make the database volume writable, then hand off to the app unprivileged.
#
# A bind mount (`./data:/data`) arrives with the *host* directory's ownership.
# Whatever the image did with `chown` at build time is invisible underneath it,
# so a `./data` created by root — which is what happens when sysops runs
# `mkdir -p data` as root — is unwritable by the app user, and SQLite fails to
# open with a bare SQLITE_CANTOPEN on the first request.
#
# Rather than ask every operator to remember `chown 1000:1000 data`, claim the
# directory here on every boot. Idempotent, and a no-op once it is correct.
# ---------------------------------------------------------------------------
set -e

APP_UID=1000
APP_GID=1000
DATA_DIR="$(dirname "${DATABASE_PATH:-/data/app.db}")"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"

  if [ "$(stat -c %u "$DATA_DIR")" != "$APP_UID" ]; then
    echo "[entrypoint] Claiming $DATA_DIR for uid $APP_UID (was uid $(stat -c %u "$DATA_DIR"))"
    chown -R "$APP_UID:$APP_GID" "$DATA_DIR" ||
      echo "[entrypoint] WARNING: could not chown $DATA_DIR — the app may fail to write."
  fi

  # setpriv execs rather than forks, so the app stays PID 1 and receives
  # SIGTERM directly — which is what checkpoints the SQLite WAL on shutdown.
  if command -v setpriv >/dev/null 2>&1; then
    exec setpriv --reuid="$APP_UID" --regid="$APP_GID" --clear-groups "$@"
  fi

  # Should not happen on Debian, but refusing to boot over a missing helper
  # would be a worse failure than serving traffic as root. Say so loudly.
  echo "[entrypoint] WARNING: setpriv unavailable — running as root."
  exec "$@"
fi

# Already unprivileged (`docker run --user`, rootless Docker, Podman). The
# volume is either correct or outside our control; let the app report it.
echo "[entrypoint] Running as uid $(id -u); leaving $DATA_DIR ownership alone."
exec "$@"
