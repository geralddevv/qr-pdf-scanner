// One-time setup: generates the shared secret used to verify short,
// Windows-style activation keys (e.g. K3F9M-7QXPL-2VRTN-8YHWZ-D4JCB)
// offline. Run with `node scripts/keygen.js`.
//
// - Paste the printed value into ACTIVATION_SECRET_B64 in
//   src/utils/deviceLock.js.
// - It's also saved to scripts/.private-key.local (git-ignored) so
//   scripts/activate-device.js can use it directly.
//
// NOTE: this secret ships inside the compiled app — it has to, so the app
// can verify keys with no network call. Anyone who decompiles the app can
// recover it and mint their own activation keys for arbitrary device IDs.
// That's the tradeoff of a short, human-typable key instead of a full
// public-key signature. Re-run this script to rotate the secret if it's
// ever compromised (existing activation keys stop working and every device
// needs a new one).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const secret = crypto.randomBytes(32).toString("base64");

console.log("Activation secret (paste into src/utils/deviceLock.js):");
console.log(secret);

const keyPath = path.join(__dirname, ".private-key.local");
fs.writeFileSync(keyPath, secret + "\n");
console.log();
console.log(`Also saved to ${keyPath} for scripts/activate-device.js`);
