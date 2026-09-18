import database from "../config/db.js";
import Role from "../models/Role.js";

function mapRole(row) {
  return new Role({ id: row.id, code: row.code });
}

export async function getAllRoles() {
  const result = await database.query("SELECT id, code FROM role ORDER BY code ASC");
  return result.rows.map(mapRole);
}

export async function getRoleById(id) {
  const result = await database.query(
    "SELECT id, code FROM role WHERE id = $1",
    [id],
  );
  return result.rows[0] ? mapRole(result.rows[0]) : null;
}
