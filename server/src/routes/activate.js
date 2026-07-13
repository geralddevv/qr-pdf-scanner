const express = require("express");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { signCredential } = require("../signing");
const { normalizeLicenseCode } = require("../licenseCode");

const router = express.Router();

// Only unauthenticated route in the service — a valid code is enough to
// self-activate, so this is the only place worth throttling against
// brute-force code guessing.
const activateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const logAttempt = db.prepare(`
  INSERT INTO activation_attempts (license_code, device_id, license_id, result, ip)
  VALUES (?, ?, ?, ?, ?)
`);

const findLicenseByCode = db.prepare(
  "SELECT * FROM licenses WHERE license_code = ?"
);
const findActiveBinding = db.prepare(
  "SELECT * FROM device_bindings WHERE license_id = ? AND released_at IS NULL"
);
const insertBinding = db.prepare(
  "INSERT INTO device_bindings (license_id, device_id) VALUES (?, ?)"
);

const activate = db.transaction((licenseCode, deviceId, ip) => {
  const license = findLicenseByCode.get(licenseCode);

  if (!license) {
    logAttempt.run(licenseCode, deviceId, null, "invalid_license", ip);
    return { status: 404, body: { error: "invalid_license", message: "License code not recognized." } };
  }

  if (license.status === "revoked") {
    logAttempt.run(licenseCode, deviceId, license.id, "license_revoked", ip);
    return {
      status: 403,
      body: { error: "license_revoked", message: "This license has been revoked. Contact your administrator." },
    };
  }

  const binding = findActiveBinding.get(license.id);

  if (binding && binding.device_id !== deviceId) {
    logAttempt.run(licenseCode, deviceId, license.id, "rejected_different_device", ip);
    return {
      status: 409,
      body: {
        error: "device_mismatch",
        message: "This license is already active on a different device. Contact your administrator to release it.",
      },
    };
  }

  if (!binding) {
    insertBinding.run(license.id, deviceId);
    logAttempt.run(licenseCode, deviceId, license.id, "bound_new", ip);
  } else {
    logAttempt.run(licenseCode, deviceId, license.id, "reactivated_same_device", ip);
  }

  const credential = signCredential(license.license_code, deviceId);
  return { status: 200, body: { credential } };
});

router.post("/activate", activateLimiter, (req, res) => {
  const { licenseCode, deviceId } = req.body || {};

  if (typeof licenseCode !== "string" || typeof deviceId !== "string" || !licenseCode.trim() || !deviceId.trim()) {
    return res.status(400).json({ error: "bad_request", message: "licenseCode and deviceId are required." });
  }

  const normalizedCode = normalizeLicenseCode(licenseCode);
  const result = activate(normalizedCode, deviceId.trim(), req.ip);
  res.status(result.status).json(result.body);
});

module.exports = router;
