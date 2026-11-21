const express = require("express");
const requireUser = require("../middleware/requireUser.cjs");
const { create } = require("../controllers/contributions.cjs");
const { getOne } = require("../controllers/rounds.cjs");
const { createPayout } = require("../controllers/payouts.cjs");
const router = express.Router();

router.use(requireUser);
router.get("/:roundId", getOne);
router.post("/:roundId/contributions", create);
router.post("/:roundId/payout", createPayout);


module.exports = router;