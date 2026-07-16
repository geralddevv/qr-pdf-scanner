const crypto = require("crypto");

// Crockford base32: uppercase alphanumeric, excludes I/L/O/U to avoid
// look-alike confusion when read/typed by hand. Same alphabet as the app's
// deviceLock.js, purely for UX continuity of the XXXXX-XXXXX-... format.
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

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

// Generates a fresh random license code, formatted as
// XXXXX-XXXXX-XXXXX-XXXXX-XXXXX (25 symbols, 125 bits of randomness) —
// purely an opaque, hard-to-guess DB lookup key, not a cryptographic proof
// of anything by itself.
function generateLicenseCode() {
  const bytes = crypto.randomBytes(16); // 128 bits, truncated to 125 below
  const encoded = base32Encode(bytes).slice(0, 25);
  return encoded.match(/.{1,5}/g).join("-");
}

// Uppercases, strips anything outside the Crockford alphabet, then
// re-groups into the canonical XXXXX-XXXXX-... form so lookups succeed
// regardless of how the client formatted/typed the code.
function normalizeLicenseCode(input) {
  const clean = String(input || "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 25);
  return clean.match(/.{1,5}/g)?.join("-") ?? clean;
}

module.exports = { generateLicenseCode, normalizeLicenseCode };
