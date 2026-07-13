const fs = require("fs");
const path = require("path");
const nacl = require("tweetnacl");
const naclUtil = require("tweetnacl-util");

const keyPath = path.join(__dirname, "..", ".keys", "activation-private-key.local");
if (!fs.existsSync(keyPath)) {
  console.error(
    `Activation private key not found at ${keyPath}.\n` +
      "Run `npm run generate-keypair` from server/ to generate one."
  );
  process.exit(1);
}

const secretKey = naclUtil.decodeBase64(fs.readFileSync(keyPath, "utf8").trim());

const ALGO = "ed25519-v1";

// Fixed-order delimited string, not JSON, so both sides always agree on the
// exact bytes being signed regardless of key ordering/whitespace.
function canonicalMessage(licenseCode, deviceId, issuedAt) {
  return `${ALGO}|${licenseCode}|${deviceId}|${issuedAt}`;
}

function signCredential(licenseCode, deviceId) {
  const issuedAt = new Date().toISOString();
  const message = canonicalMessage(licenseCode, deviceId, issuedAt);
  const signature = nacl.sign.detached(naclUtil.decodeUTF8(message), secretKey);
  return {
    algo: ALGO,
    licenseCode,
    deviceId,
    issuedAt,
    signature: naclUtil.encodeBase64(signature),
  };
}

module.exports = { signCredential, canonicalMessage, ALGO };
