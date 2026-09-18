import database from "../config/db.js";
import StatutCompteMembre from "../models/StatutCompteMembre.js";

function mapStatutCompteMembre(row) {
  return new StatutCompteMembre({ id: row.id, code: row.code });
}

export async function getAllStatutsCompteMembre() {
  const result = await database.query(
    "SELECT id, code FROM statut_compte_membre ORDER BY code ASC",
  );
  return result.rows.map(mapStatutCompteMembre);
}

export async function getStatutCompteMembreById(id) {
  const result = await database.query(
    "SELECT id, code FROM statut_compte_membre WHERE id = $1",
    [id],
  );
  return result.rows[0] ? mapStatutCompteMembre(result.rows[0]) : null;
}
