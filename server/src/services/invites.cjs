const { createHash } = require("node:crypto");
const pool = require("../db.cjs");

async function joinWithInvite(code, userId) {
  const tokenHash = createHash("sha256").update(code).digest("hex");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE public.invites AS i
       SET accepted_at = now(), accepted_by_user_id = u.id
       FROM public.users AS u
       WHERE i.token_hash = $1
         AND u.id = $2
         AND lower(btrim(u.email)) = lower(btrim(i.email))
         AND i.accepted_at IS NULL
         AND i.expires_at > now()
       RETURNING i.group_id`,
      [tokenHash, userId]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const groupId = result.rows[0].group_id;

    await client.query(
      `INSERT INTO public.memberships (group_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (group_id, user_id) DO UPDATE
       SET left_at = NULL, joined_at = now(), role = 'member'
       WHERE memberships.left_at IS NOT NULL`,
      [groupId, userId]
    );

    await client.query("COMMIT");
    return { groupId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { joinWithInvite };