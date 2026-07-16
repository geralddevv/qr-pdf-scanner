const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "licenses.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
// Wait up to 5s for a lock instead of throwing SQLITE_BUSY immediately.
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY,
    license_code TEXT UNIQUE NOT NULL,
    label TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS device_bindings (
    id INTEGER PRIMARY KEY,
    license_id INTEGER NOT NULL REFERENCES licenses(id),
    device_id TEXT NOT NULL,
    bound_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    released_at TEXT
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_binding
    ON device_bindings(license_id) WHERE released_at IS NULL;

  CREATE TABLE IF NOT EXISTS activation_attempts (
    id INTEGER PRIMARY KEY,
    license_code TEXT NOT NULL,
    device_id TEXT NOT NULL,
    license_id INTEGER REFERENCES licenses(id),
    result TEXT NOT NULL CHECK (result IN (
      'bound_new','reactivated_same_device','rejected_different_device',
      'invalid_license','license_revoked'
    )),
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_bindings_license ON device_bindings(license_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_license_code ON activation_attempts(license_code);
  CREATE INDEX IF NOT EXISTS idx_attempts_device_id ON activation_attempts(device_id);
`);

module.exports = db;
