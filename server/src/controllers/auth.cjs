const { z } = require("zod");
const { registerUser } = require("../services/auth.cjs");

const registrationSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).toLowerCase(),
  password: z.string().min(15).max(128),
}).strict();

async function register(req, res, next) {
  const parsed = registrationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid registration details",
      fields: parsed.error.issues.map((issue) => issue.path.join(".")),
    });
  }

  try {
    const user = await registerUser(parsed.data);
    return res.status(201).json({ user });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Account already exists" });
    }
    return next(error);
  }
}

module.exports = { register };