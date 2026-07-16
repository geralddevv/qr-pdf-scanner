const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");

// Explicit path so this loads server/.env regardless of the directory
// `node` was invoked from (e.g. running from server/src/ instead of server/).
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// A crash here means we're in an unknown state (e.g. a bug mid-transaction) —
// exit and let systemd (Restart=on-failure) bring up a clean process, rather
// than limping on with a possibly-corrupted in-memory state. Logged first so
// the reason survives in `journalctl -u license-server`.
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception, exiting:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection, exiting:", reason);
  process.exit(1);
});

const db = require("./db");
const activateRouter = require("./routes/activate");
const adminRouter = require("./routes/admin");

const app = express();

// Whether we're behind a reverse proxy (nginx/Caddy) at all — needed so
// req.ip reflects the real client, not the proxy, which both the activate
// rate limiter and the audit log's per-IP fraud signal depend on. Kept
// separate from TRUST_PROXY_HTTPS: you can be behind a plain-HTTP proxy
// (e.g. mid-setup, before TLS is on) and still need correct client IPs.
const trustProxy = process.env.TRUST_PROXY === "true";
if (trustProxy) app.set("trust proxy", 1);

const secureCookies = process.env.TRUST_PROXY_HTTPS === "true";

if (!process.env.SESSION_SECRET) {
  console.error("SESSION_SECRET is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD_HASH) {
  console.error("ADMIN_PASSWORD_HASH is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: secureCookies,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12, // 12h
    },
  })
);

app.get("/healthz", (req, res) => res.status(200).json({ ok: true }));

app.use("/api", activateRouter);
app.use("/admin", adminRouter);

app.get("/", (req, res) => res.redirect("/admin"));

app.use((req, res) => {
  res.status(404).send("Not found");
});

// Catches anything a route handler threw synchronously (better-sqlite3 is
// synchronous, so this covers DB errors too). Logs the real error server-side
// but never leaks internals to the client.
app.use((err, req, res, next) => {
  console.error("Request error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "server_error", message: "Something went wrong." });
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`License server listening on port ${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
