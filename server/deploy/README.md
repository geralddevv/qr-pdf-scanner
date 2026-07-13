# Deploying the license server

Assumes you already have a Linux VPS with Node.js installed.

## 1. Get the code on the server

```
git clone <your repo> /opt/qr-pdf-scanner
cd /opt/qr-pdf-scanner/server
npm install --production
```

## 2. Configure

```
cp .env.example .env
```

Fill in `.env`:
- `ADMIN_PASSWORD_HASH` — generate with `node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"`
- `SESSION_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- `TRUST_PROXY_HTTPS=true` once step 4 (TLS reverse proxy) is in place.

## 3. Generate the activation keypair

```
npm run generate-keypair
```

This prints a public key — paste it into `ACTIVATION_PUBLIC_KEY_B64` in the app's `src/utils/deviceLock.js`, then rebuild the app. The private key is written to `server/.keys/activation-private-key.local` and must never leave this server.

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
sudo cp deploy/qr-license-server.service /etc/systemd/system/
sudo useradd --system --no-create-home qrlicense || true
sudo chown -R qrlicense:qrlicense /opt/qr-pdf-scanner/server
sudo systemctl daemon-reload
sudo systemctl enable --now qr-license-server
sudo systemctl status qr-license-server
```

## 6. Point the app at it

Set `ACTIVATION_SERVER_URL` in `src/utils/deviceLock.js` to your server's public HTTPS URL, then rebuild.

## Backups

`server/data/licenses.sqlite` is the only stateful file that matters (plus `.keys/activation-private-key.local`, which never changes after generation). Back both up periodically — losing the SQLite file loses your license↔device bindings and audit history; losing the private key means every existing device fails signature verification and needs re-activation with a freshly generated keypair.
