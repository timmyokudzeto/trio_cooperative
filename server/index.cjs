const express = require("express");
const pool = require("./src/db.cjs");
const session = require("express-session");
const PgSessionStore = require("connect-pg-simple")(session);
const authRoutes = require("./src/routes/auth.cjs");
const usersRoutes = require("./src/routes/users.cjs");
const groupsRoutes = require("./src/routes/groups.cjs");
const invitesRoutes = require("./src/routes/invites.cjs");
const roundsRoutes = require("./src/routes/rounds.cjs");
const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
app.use(express.json());
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing. Check server/.env");
}

app.use(
  session({
    name: "trio.sid",
    secret: process.env.SESSION_SECRET,
    store: new PgSessionStore({ pool }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 15 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  })
);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/groups", groupsRoutes);
app.use("/api/invites", invitesRoutes);
app.use("/api/rounds", roundsRoutes);

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT current_database() AS database");
    res.json({ ok: true, database: result.rows[0].database });
  } catch (error) {
    console.error(error.message);
    res.status(503).json({ ok: false, error: "Database unavailable" });
  }
});
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  console.error(error.message);
  return res.status(500).json({ error: "Unexpected server error" });
});
const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
    console.log(`Trio API listening on port ${port}`);
});
