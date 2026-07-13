// One-time setup: generates the Ed25519 keypair used to sign activation
// credentials. Run with `node scripts/generate-keypair.js` from server/.
//
// - Paste the printed public key into ACTIVATION_PUBLIC_KEY_B64 in
//   ../src/utils/deviceLock.js (relative to the app repo root). It is NOT
//   secret and is safe to ship inside the app.
// - The private key is saved to server/.keys/activation-private-key.local
//   (git-ignored) and is loaded by src/signing.js to sign credentials at
//   activation time. It must never leave this server.
//
// Re-run this script to rotate the keypair if the private key is ever
// compromised (every credential signed with the old key stops verifying,
// and every device needs to re-activate).
const fs = require("fs");
const path = require("path");
const nacl = require("tweetnacl");
const naclUtil = require("tweetnacl-util");

const keyPair = nacl.sign.keyPair();
const publicKeyB64 = naclUtil.encodeBase64(keyPair.publicKey);
const secretKeyB64 = naclUtil.encodeBase64(keyPair.secretKey);

console.log("Activation public key (paste into src/utils/deviceLock.js as ACTIVATION_PUBLIC_KEY_B64):");
console.log(publicKeyB64);

const keysDir = path.join(__dirname, "..", ".keys");
fs.mkdirSync(keysDir, { recursive: true });
const keyPath = path.join(keysDir, "activation-private-key.local");
fs.writeFileSync(keyPath, secretKeyB64 + "\n");

console.log();
console.log(`Private key saved to ${keyPath}`);
