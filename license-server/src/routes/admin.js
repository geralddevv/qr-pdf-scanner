const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const requireAdmin = require("../middleware/requireAdmin");
const { generateLicenseCode } = require("../licenseCode");

const router = express.Router();

const listLicenses = db.prepare(`
  SELECT
    l.*,
    b.device_id AS bound_device_id,
    b.bound_at AS bound_at
  FROM licenses l
  LEFT JOIN device_bindings b ON b.license_id = l.id AND b.released_at IS NULL
  ORDER BY l.created_at DESC
`);
// Matches by client label, license code, or the currently bound device ID —
// SQLite's LIKE is case-insensitive for ASCII by default, so this works
// regardless of how the admin types the search term.
const searchLicenses = db.prepare(`
  SELECT
    l.*,
    b.device_id AS bound_device_id,
    b.bound_at AS bound_at
  FROM licenses l
  LEFT JOIN device_bindings b ON b.license_id = l.id AND b.released_at IS NULL
  WHERE l.label LIKE ? OR l.license_code LIKE ? OR b.device_id LIKE ?
  ORDER BY l.created_at DESC
`);
const findLicense = db.prepare("SELECT * FROM licenses WHERE id = ?");
const findLicenseByCode = db.prepare("SELECT * FROM licenses WHERE license_code = ?");
const insertLicense = db.prepare(
  "INSERT INTO licenses (license_code, label) VALUES (?, ?)"
);
const setLicenseStatus = db.prepare("UPDATE licenses SET status = ? WHERE id = ?");
const setLicenseLabel = db.prepare("UPDATE licenses SET label = ? WHERE id = ?");
const bindingHistory = db.prepare(
  "SELECT * FROM device_bindings WHERE license_id = ? ORDER BY bound_at DESC"
);
const activeBinding = db.prepare(
  "SELECT * FROM device_bindings WHERE license_id = ? AND released_at IS NULL"
);
const releaseBindingStmt = db.prepare(
  "UPDATE device_bindings SET released_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
);
const licenseAttempts = db.prepare(
  "SELECT * FROM activation_attempts WHERE license_id = ? ORDER BY created_at DESC LIMIT 200"
);
const globalAttempts = db.prepare(
  "SELECT * FROM activation_attempts ORDER BY created_at DESC LIMIT 500"
);
const attemptsByDevice = db.prepare(
  "SELECT * FROM activation_attempts WHERE device_id = ? ORDER BY created_at DESC LIMIT 500"
);
const attemptsByCode = db.prepare(
  "SELECT * FROM activation_attempts WHERE license_code = ? ORDER BY created_at DESC LIMIT 500"
);

router.get("/login", (req, res) => {
  if (req.session.admin) return res.redirect("/admin");
  res.render("login", { error: null });
});

router.post("/login", (req, res) => {
  const { password } = req.body || {};
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash || !password || !bcrypt.compareSync(password, hash)) {
    return res.status(401).render("login", { error: "Incorrect password." });
  }
  req.session.admin = true;
  res.redirect("/admin");
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

router.use(requireAdmin);

router.get("/", (req, res) => {
  const q = (req.query.q || "").trim();
  const licenses = q
    ? searchLicenses.all(`%${q}%`, `%${q}%`, `%${q}%`)
    : listLicenses.all();
  res.render("dashboard", { licenses, q });
});

router.post("/licenses", (req, res) => {
  const label = (req.body?.label || "").trim() || null;
  let code;
  // Collision retry loop: astronomically unlikely with 125 bits of
  // randomness, but cheap to guard against.
  for (let attempts = 0; attempts < 5; attempts++) {
    code = generateLicenseCode();
    if (!findLicenseByCode.get(code)) break;
    code = null;
  }
  if (!code) {
    return res.status(500).send("Could not generate a unique license code, try again.");
  }
  const info = insertLicense.run(code, label);
  res.redirect(`/admin/licenses/${info.lastInsertRowid}`);
});

router.get("/licenses/:id", (req, res) => {
  const license = findLicense.get(req.params.id);
  if (!license) return res.status(404).send("License not found.");
  res.render("licenseDetail", {
    license,
    bindings: bindingHistory.all(license.id),
    activeBinding: activeBinding.get(license.id) || null,
    attempts: licenseAttempts.all(license.id),
  });
});

router.post("/licenses/:id/label", (req, res) => {
  const license = findLicense.get(req.params.id);
  if (!license) return res.status(404).send("License not found.");
  const label = (req.body?.label || "").trim() || null;
  setLicenseLabel.run(label, license.id);
  res.redirect(`/admin/licenses/${license.id}`);
});

router.post("/licenses/:id/release", (req, res) => {
  const license = findLicense.get(req.params.id);
  if (!license) return res.status(404).send("License not found.");
  const binding = activeBinding.get(license.id);
  if (binding) releaseBindingStmt.run(binding.id);
  res.redirect(`/admin/licenses/${license.id}`);
});

router.post("/licenses/:id/revoke", (req, res) => {
  const license = findLicense.get(req.params.id);
  if (!license) return res.status(404).send("License not found.");
  setLicenseStatus.run("revoked", license.id);
  res.redirect(`/admin/licenses/${license.id}`);
});

router.post("/licenses/:id/unrevoke", (req, res) => {
  const license = findLicense.get(req.params.id);
  if (!license) return res.status(404).send("License not found.");
  setLicenseStatus.run("active", license.id);
  res.redirect(`/admin/licenses/${license.id}`);
});

router.get("/audit", (req, res) => {
  const { deviceId, licenseCode } = req.query;
  let attempts;
  if (deviceId) attempts = attemptsByDevice.all(deviceId);
  else if (licenseCode) attempts = attemptsByCode.all(licenseCode.toUpperCase());
  else attempts = globalAttempts.all();
  res.render("audit", { attempts, deviceId: deviceId || "", licenseCode: licenseCode || "" });
});

module.exports = router;
