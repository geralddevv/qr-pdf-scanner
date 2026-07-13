const path = require("path");
const express = require("express");
const session = require("express-session");

// Explicit path so this loads server/.env regardless of the directory
// `node` was invoked from (e.g. running from server/src/ instead of server/).
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const activateRouter = require("./routes/activate");
const adminRouter = require("./routes/admin");

const app = express();

const trustProxyHttps = process.env.TRUST_PROXY_HTTPS === "true";
if (trustProxyHttps) app.set("trust proxy", 1);

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

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: trustProxyHttps,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12, // 12h
    },
  })
);

app.use("/api", activateRouter);
app.use("/admin", adminRouter);

app.get("/", (req, res) => res.redirect("/admin"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`License server listening on port ${port}`);
});
