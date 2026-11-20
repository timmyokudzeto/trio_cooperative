const express = require("express");
const pool = require("./src/db.cjs");

const app = express();

app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT current_database() AS database");
    res.json({ ok: true, database: result.rows[0].database });
  } catch (error) {
    console.error(error.message);
    res.status(503).json({ ok: false, error: "Database unavailable" });
  }
});

app.listen(3000, "127.0.0.1", () => {
  console.log("Trio API running at http://127.0.0.1:3000");
});