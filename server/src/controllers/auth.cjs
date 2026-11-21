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
const loginBody = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

async function login(req, res) {
  const input = loginBody.safeParse(req.body);

  if (!input.success) {
    return res.status(400).json({
      error: "Enter an email address and password.",
    });
  }

  const { email, password } = input.data;
  const user = await require("../services/auth.cjs").verifyLogin(email, password);

  if (!user) {
    return res.status(401).json({
      error: "Email or password is incorrect.",
    });
  }

  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => err ? reject(err) : resolve());
  });

  req.session.userId = user.id;

  await new Promise((resolve, reject) => {
    req.session.save((err) => err ? reject(err) : resolve());
  });

  return res.status(200).json({ user });
}

module.exports.login = login;
function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie("trio.sid", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(204).end();
  });
}

module.exports.logout = logout;