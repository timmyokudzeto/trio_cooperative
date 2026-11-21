const express = require("express");
const requireUser = require("../middleware/requireUser.cjs");
const { join } = require("../controllers/invites.cjs");

const router = express.Router();

router.post("/:code/join", requireUser, join);

module.exports = router;