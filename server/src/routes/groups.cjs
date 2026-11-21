const express = require("express");
const requireUser = require("../middleware/requireUser.cjs");
const { create, list, getOne, rename, invite, members, updateMember,createCycle, getCycle, getActivity } = require("../controllers/groups.cjs");
const router = express.Router();

router.use(requireUser);
router.post("/", create);
router.get("/", list);
router.get("/:groupId", getOne);
router.patch("/:groupId", rename);
router.post("/:groupId/invites", invite);
router.patch("/:groupId/members/:memberId", updateMember);

router.get("/:groupId/members", members);
router.post("/:groupId/cycles", createCycle);
router.get("/:groupId/cycles/:cycleId", getCycle);
router.get("/:groupId/activity", getActivity);
module.exports = router;