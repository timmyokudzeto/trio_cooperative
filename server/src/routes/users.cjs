const express = require("express");
const requireUser = require("../middleware/requireUser.cjs");
const { getMe } = require("../controllers/users.cjs");

const router = express.Router();

router.get("/me", requireUser, getMe);

module.exports = router;