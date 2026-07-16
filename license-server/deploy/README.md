# Deploying the license server

Assumes you already have a Linux VPS with Node.js installed.

Each app gets its **own instance** of this server — its own clone/copy, own port or subdomain, own `.env`, own keypair, own SQLite file. This isn't a multi-tenant server; it's a small codebase you deploy once per app.

## 1. Get the code on the server

```
git clone <this repo's url> /opt/license-server
cd /opt/license-server
npm install --production
```

If you're deploying this for a second app on the same box, clone it into a different directory (e.g. `/opt/license-server-appname`) and use a different `PORT`/domain and systemd unit name so the two don't collide.

## 2. Configure

```
cp .env.example .env
```

Fill in `.env`:
- `ADMIN_PASSWORD_HASH` — generate with `node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"`
- `SESSION_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- `TRUST_PROXY=true` as soon as step 4's reverse proxy is in front of this app — even before TLS is live. Without it, every request's IP looks like the proxy's own IP, which silently breaks the `/api/activate` rate limiter (every client shares one bucket) and the audit log's per-IP fraud signal.
- `TRUST_PROXY_HTTPS=true` once step 4's TLS is actually live, so session cookies are marked `Secure`.

For a temporary router port-forward accessed as `http://IP:PORT`, leave
`TRUST_PROXY_HTTPS=false`. The server then omits browser headers that require a
trustworthy HTTPS origin. This is suitable only for short-lived/private testing:
the admin password and license codes travel unencrypted over HTTP.

## 3. Generate the activation keypair

```
npm run generate-keypair
```

This prints a public key — paste it into `ACTIVATION_PUBLIC_KEY_B64` in the app's device-lock code, then rebuild the app. The private key is written to `.keys/activation-private-key.local` and must never leave this server.

## 4. Put it behind HTTPS

The app sends license codes and device IDs to this server — don't run it over plain HTTP in production. Put it behind a reverse proxy (nginx, Caddy, etc.) with a TLS certificate (e.g. Let's Encrypt via certbot or Caddy's automatic HTTPS), forwarding to `127.0.0.1:3000` (or whatever `PORT` is set to). Once TLS is in place, set `TRUST_PROXY_HTTPS=true` in `.env` so session cookies are marked `Secure`.

Example nginx location block:

```
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 5. Run it as a service

```
sudo cp deploy/license-server.service /etc/systemd/system/license-server.service
sudo useradd --system --no-create-home licenseserver || true
sudo chown -R licenseserver:licenseserver /opt/license-server
sudo systemctl daemon-reload
sudo systemctl enable --now license-server
sudo systemctl status license-server
```

Deploying a second app's instance alongside this one? Copy the unit file to a distinct name (e.g. `license-server-appname.service`), point `WorkingDirectory`/`EnvironmentFile` at that app's own directory, and give it its own `PORT` in `.env`.

## 6. Point the app at it

Set the activation server URL constant in the app's device-lock code to this server's public HTTPS URL, then rebuild.

## 7. Health check

`GET /healthz` returns `200 {"ok": true}` with no auth required — point uptime monitoring (UptimeRobot, a systemd watchdog, etc.) at it.

## Backups

Two files matter: `data/licenses.sqlite` (license↔device bindings and audit history) and `.keys/activation-private-key.local` (never changes after generation — losing it means every existing device fails signature verification and needs re-activation with a freshly generated keypair).

`npm run backup` writes a consistent snapshot (via SQLite's online backup API, safe to run against a live server) to `data/backups/`, keeping the last 14. Set it up on a schedule:

```
sudo cp deploy/license-server-backup.service deploy/license-server-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now license-server-backup.timer
```

`data/backups/` and `.keys/` still live on the same disk as everything else, so this only protects against SQLite corruption/bad writes — it does **not** protect against losing the whole VPS. Periodically copy `data/backups/` and `.keys/` somewhere off-box (another machine, object storage, etc.).
