const pool = require("../db.cjs");
const { randomBytes, createHash } = require("node:crypto");

async function createGroup(name, userId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO public.groups (name)
       VALUES ($1)
       RETURNING id, name`,
      [name]
    );

    const group = result.rows[0];

    await client.query(
      `INSERT INTO public.memberships (group_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [group.id, userId]
    );

    await client.query("COMMIT");
    return group;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listGroupsForUser(userId) {
  const result = await pool.query(
    `SELECT g.id, g.name, m.role
     FROM public.memberships AS m
     JOIN public.groups AS g ON g.id = m.group_id
     WHERE m.user_id = $1
       AND m.left_at IS NULL
     ORDER BY g.name, g.id`,
    [userId]
  );

  return result.rows;
}

async function findGroupForUser(groupId, userId) {
  const result = await pool.query(
    `SELECT g.id, g.name, m.role,
            (
              SELECT r.id
              FROM public.rounds AS r
              JOIN public.cycles AS c ON c.id = r.cycle_id
              WHERE r.group_id = g.id
                AND c.status = 'active'
                AND NOT EXISTS (
                  SELECT 1
                  FROM public.payouts AS p
                  WHERE p.round_id = r.id
                )
              ORDER BY r.payout_position
              LIMIT 1
            ) AS current_round_id,
  (
    SELECT c.id
    FROM public.cycles AS c
    WHERE c.group_id = g.id
    ORDER BY c.id DESC
    LIMIT 1
  ) AS latest_cycle_id
     FROM public.memberships AS m
     JOIN public.groups AS g ON g.id = m.group_id
     WHERE m.user_id = $1
       AND m.group_id = $2
       AND m.left_at IS NULL`,
    [userId, groupId]
  );

  return result.rows[0];
}
async function renameGroup(groupId, userId, name) {
  const result = await pool.query(
    `UPDATE public.groups AS g
     SET name = $3
     FROM public.memberships AS m
     WHERE g.id = $1
       AND m.group_id = g.id
       AND m.user_id = $2
       AND m.left_at IS NULL
       AND m.role = 'admin'
     RETURNING g.id, g.name, m.role`,
    [groupId, userId, name]
  );

  return result.rows[0];
}
async function createInvite(groupId, userId, email) {
  const code = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(code).digest("hex");

  const result = await pool.query(
    `INSERT INTO public.invites
       (group_id, invited_by_user_id, email, token_hash, expires_at)
     SELECT m.group_id, m.user_id, $3, $4, now() + interval '24 hours'
     FROM public.memberships AS m
     WHERE m.group_id = $1
       AND m.user_id = $2
       AND m.role = 'admin'
       AND m.left_at IS NULL
     RETURNING id, group_id, email, expires_at`,
    [groupId, userId, email, tokenHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return { ...result.rows[0], code };
}
async function listGroupMembers(groupId, userId) {
  const result = await pool.query(
    `SELECT u.id, u.display_name AS "displayName", m.role
     FROM public.memberships AS m
     JOIN public.users AS u ON u.id = m.user_id
     WHERE m.group_id = $1
       AND m.left_at IS NULL
       AND EXISTS (
         SELECT 1
         FROM public.memberships AS viewer
         WHERE viewer.group_id = m.group_id
           AND viewer.user_id = $2
           AND viewer.left_at IS NULL
       )
     ORDER BY u.display_name, u.id`,
    [groupId, userId]
  );

  return result.rows;
}
async function changeMemberRole(groupId, actorId, memberId, role) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT id FROM public.groups WHERE id = $1 FOR UPDATE",
      [groupId]
    );

    const actor = await client.query(
      `SELECT role
       FROM public.memberships
       WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [groupId, actorId]
    );

    if (actor.rows[0]?.role !== "admin") {
      await client.query("ROLLBACK");
      return { status: 403, error: "Only a circle admin can change roles." };
    }

    const target = await client.query(
      `SELECT role
       FROM public.memberships
       WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [groupId, memberId]
    );

    if (target.rowCount === 0) {
      await client.query("ROLLBACK");
      return { status: 404, error: "Member not found in this circle." };
    }

    if (target.rows[0].role === "admin" && role === "member") {
      const admins = await client.query(
        `SELECT count(*)::int AS total
         FROM public.memberships
         WHERE group_id = $1 AND role = 'admin' AND left_at IS NULL`,
        [groupId]
      );

      if (admins.rows[0].total === 1) {
        await client.query("ROLLBACK");
        return { status: 409, error: "The circle needs at least one admin." };
      }
    }

    const result = await client.query(
      `UPDATE public.memberships
       SET role = $3
       WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL
       RETURNING user_id AS id, role`,
      [groupId, memberId, role]
    );

    await client.query("COMMIT");
    return { member: result.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
module.exports = {
  createGroup,
  listGroupsForUser,
  findGroupForUser,
  renameGroup,
  createInvite,
  listGroupMembers,
  changeMemberRole,
};
async function listActivityForUser(groupId, userId) {
  const result = await pool.query(
    `SELECT log.id, log.action, log.occurred_at,
            actor.display_name AS actor_name
     FROM public.memberships AS viewer
     LEFT JOIN public.audit_logs AS log ON log.group_id = viewer.group_id
     LEFT JOIN public.users AS actor ON actor.id = log.actor_user_id
     WHERE viewer.group_id = $1
       AND viewer.user_id = $2
       AND viewer.left_at IS NULL
     ORDER BY log.occurred_at DESC, log.id DESC
     LIMIT 50`,
    [groupId, userId]
  );

  if (result.rows.length === 0) return null;

  return result.rows.filter((row) => row.id !== null);
}

module.exports.listActivityForUser = listActivityForUser;