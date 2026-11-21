const express = require("express");
const { register } = require("../controllers/auth.cjs");

const router = express.Router();

router.post("/register", register);
router.post("/login", require("../controllers/auth.cjs").login);
router.post("/logout", require("../controllers/auth.cjs").logout);

module.exports = router;