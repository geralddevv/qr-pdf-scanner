// Writes a consistent snapshot of the SQLite database to data/backups/.
// Safe to run while the server is live — better-sqlite3's backup() uses
// SQLite's own online backup API, not a raw file copy (a raw copy under
// WAL mode can capture a torn, inconsistent state).
//
// Run manually with `npm run backup`, or on a schedule (see
// deploy/README.md for a systemd timer).
const fs = require("fs");
const path = require("path");
const db = require("../src/db");

const KEEP = 14; // days worth of daily backups to retain

const backupsDir = path.join(__dirname, "..", "data", "backups");
fs.mkdirSync(backupsDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = path.join(backupsDir, `licenses-${stamp}.sqlite`);

db.backup(dest)
  .then(() => {
    console.log(`Backup written to ${dest}`);

    const files = fs
      .readdirSync(backupsDir)
      .filter((f) => f.startsWith("licenses-") && f.endsWith(".sqlite"))
      .sort();
    const stale = files.slice(0, Math.max(0, files.length - KEEP));
    for (const f of stale) fs.unlinkSync(path.join(backupsDir, f));
    if (stale.length) console.log(`Pruned ${stale.length} old backup(s).`);

    process.exit(0);
  })
  .catch((err) => {
    console.error("Backup failed:", err);
    process.exit(1);
  });
