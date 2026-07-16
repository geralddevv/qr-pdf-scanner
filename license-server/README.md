# License Activation Server

A small, self-hosted license/device-activation server: issue license codes, bind each one to a single device on first activation, and manage replacements through an admin web panel instead of guessing whether a "new device" claim is legitimate.

Originally built for a React Native app (QR PDF Scanner) but has no app-specific code in it — reusable for any app that needs "one license code → one bound device, admin can release/reassign" style licensing.

## How it works

- The client app calls `POST /api/activate` **once**, at activation time, with a license code and its device ID.
- The server binds the code to that device (or rejects if the code is already bound to a *different* device).
- The server signs a credential (Ed25519) that the app verifies locally forever after — no further network calls needed for normal use.
- You manage licenses (issue, search, revoke) and device bindings (view, release) through a password-protected admin panel at `/admin`.
- Every activation attempt — successful or rejected — is logged in an audit trail.

## Quick start (local dev)

```
npm install
cp .env.example .env
# fill in ADMIN_PASSWORD_HASH and SESSION_SECRET, see .env.example for how
npm run generate-keypair
# paste the printed public key into your app's device-lock code
npm start
```

Then open `http://localhost:3000/admin`, log in, issue a license, and point your app's activation endpoint at `http://localhost:3000/api/activate` for testing.

## Using this for a new app

This repo isn't multi-tenant — each app gets its own deployed instance (own clone, own port/domain, own `.env`, own generated keypair, own SQLite file). To reuse it for a second app:

1. Clone this repo again into its own directory.
2. Run through Quick Start above independently — it generates its own keypair and database.
3. In the new app's client code, embed the public key this instance printed and point it at this instance's URL.

See `deploy/README.md` for putting an instance on a real server (systemd service, HTTPS, backups).

## Project layout

```
src/
  index.js              Express app bootstrap
  db.js                 SQLite schema (licenses, device_bindings, activation_attempts)
  signing.js             Ed25519 credential signing
  licenseCode.js          License code generation/normalization
  routes/activate.js      POST /api/activate — the only public, unauthenticated route
  routes/admin.js         Admin panel routes (session-auth protected)
  views/                 Server-rendered EJS admin panel pages
scripts/generate-keypair.js   One-time Ed25519 keypair generation (refuses to overwrite an existing key without --force)
scripts/backup.js             Consistent SQLite snapshot to data/backups/ (see deploy/README.md for scheduling)
deploy/                 systemd units (server + daily backup timer) + deployment guide
```

## Client integration contract

`POST /api/activate` with `{ "licenseCode": "...", "deviceId": "..." }`:

- `200` — `{ "credential": { algo, licenseCode, deviceId, issuedAt, signature } }`. Verify this locally with the public key printed by `generate-keypair` before trusting/storing it.
- `404 invalid_license` — code not recognized.
- `403 license_revoked` — code exists but has been revoked.
- `409 device_mismatch` — code is already bound to a different device; the client should show a "contact your administrator" message.

The credential format is a fixed-order string `${algo}|${licenseCode}|${deviceId}|${issuedAt}`, Ed25519-signed — verify with `nacl.sign.detached.verify` (or your platform's Ed25519 equivalent) against the embedded public key.
