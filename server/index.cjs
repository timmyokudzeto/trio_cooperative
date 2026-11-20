const express = require("express");
const pool = require("./src/db.cjs");
const authRoutes = require("./src/routes/auth.cjs");


const app = express();

app.use(express.json());
app.use("/api/auth", authRoutes);

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
app.listen(3000, "127.0.0.1", () => {
  console.log("Trio API running at http://127.0.0.1:3000");
});
