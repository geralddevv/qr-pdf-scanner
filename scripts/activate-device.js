// Generates a short, Windows-style activation key
// (e.g. K3F9M-7QXPL-2VRTN-8YHWZ-D4JCB) for one device ID, using the shared
// secret from scripts/keygen.js. Send the resulting key back to the user —
// they paste it into the "Device Not Authorized" screen.
//
// Usage:
//   node scripts/activate-device.js <deviceId>
//
// Reads the secret from scripts/.private-key.local, which is git-ignored
// and must never be committed.
const fs = require("fs");
const path = require("path");
const nacl = require("tweetnacl");
const naclUtil = require("tweetnacl-util");

const [, , deviceId] = process.argv;

if (!deviceId) {
  console.error("Usage: node scripts/activate-device.js <deviceId>");
  process.exit(1);
}

const keyPath = path.join(__dirname, ".private-key.local");
if (!fs.existsSync(keyPath)) {
  console.error(
    `Activation secret not found at ${keyPath}.\n` +
      "Run `npm run keygen` to generate one."
  );
  process.exit(1);
}

const secretB64 = fs.readFileSync(keyPath, "utf8").trim();

// Crockford base32: uppercase alphanumeric, excludes I/L/O/U to avoid
// look-alike confusion when read/typed by hand.
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// HMAC-SHA512 built on tweetnacl's SHA-512 (nacl.hash), so the exact same
// code runs identically here and in src/utils/deviceLock.js.
function hmacSha512(keyBytes, messageBytes) {
  const blockSize = 128;
  let key = keyBytes;
  if (key.length > blockSize) key = nacl.hash(key);
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(key);
  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }
  const inner = nacl.hash(concatBytes(ipad, messageBytes));
  return nacl.hash(concatBytes(opad, inner));
}

function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += CROCKFORD_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += CROCKFORD_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function buildActivationKey(deviceId, secretB64) {
  const secretBytes = naclUtil.decodeBase64(secretB64);
  const messageBytes = naclUtil.decodeUTF8(deviceId);
  const mac = hmacSha512(secretBytes, messageBytes).slice(0, 16); // 128 bits
  const encoded = base32Encode(mac).slice(0, 25); // 25 symbols = 125 bits
  return encoded.match(/.{1,5}/g).join("-");
}

console.log("Activation key:");
console.log(buildActivationKey(deviceId, secretB64));
