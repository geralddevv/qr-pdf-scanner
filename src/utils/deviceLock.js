import { Platform } from "react-native";
import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

// Shared secret used to verify short, Windows-style activation keys
// (e.g. K3F9M-7QXPL-2VRTN-8YHWZ-D4JCB) entirely offline. It has to ship
// inside the app to allow offline verification with no server — see
// scripts/keygen.js for how it's generated and scripts/activate-device.js
// for how keys are issued from it.
const ACTIVATION_SECRET_B64 = "84L8ocMNdYKiV3XPKxk6Ldz9Jw7rzmiCZKwIyIJ4s1c=";

const ACTIVATION_STORAGE_KEY = "device_activation_key";

// Crockford base32: uppercase alphanumeric, excludes I/L/O/U to avoid
// look-alike confusion when read/typed by hand.
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export async function getDeviceId() {
  if (Platform.OS === "android") {
    return Application.getAndroidId();
  }
  return await Application.getIosIdForVendorAsync();
}

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// HMAC-SHA512 built on tweetnacl's SHA-512 (nacl.hash) — identical to the
// implementation in scripts/activate-device.js, so both sides always agree.
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

function expectedActivationKey(deviceId) {
  const secretBytes = naclUtil.decodeBase64(ACTIVATION_SECRET_B64);
  const messageBytes = naclUtil.decodeUTF8(deviceId);
  const mac = hmacSha512(secretBytes, messageBytes).slice(0, 16); // 128 bits
  return base32Encode(mac).slice(0, 25); // 25 symbols = 125 bits
}

function normalizeActivationKey(activationKeyInput) {
  return activationKeyInput.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function verifyActivationKey(deviceId, activationKeyInput) {
  try {
    return (
      normalizeActivationKey(activationKeyInput) ===
      expectedActivationKey(deviceId)
    );
  } catch {
    return false;
  }
}

export async function isDeviceAuthorized() {
  const id = await getDeviceId();
  if (!id) return false;
  const storedKey = await SecureStore.getItemAsync(ACTIVATION_STORAGE_KEY);
  if (!storedKey) return false;
  return verifyActivationKey(id, storedKey);
}

// Verifies an activation key against this device and, if valid, persists it
// so isDeviceAuthorized() keeps passing on future launches.
export async function activateDevice(activationKeyInput) {
  const id = await getDeviceId();
  if (!id || !activationKeyInput) return false;
  if (!verifyActivationKey(id, activationKeyInput)) {
    return false;
  }
  await SecureStore.setItemAsync(
    ACTIVATION_STORAGE_KEY,
    normalizeActivationKey(activationKeyInput)
  );
  return true;
}
