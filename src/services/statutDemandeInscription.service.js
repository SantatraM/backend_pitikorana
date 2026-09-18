import database from "../config/db.js";
import StatutDemandeInscription from "../models/StatutDemandeInscription.js";

function mapStatutDemandeInscription(row) {
  return new StatutDemandeInscription({ id: row.id, code: row.code });
}

export async function getAllStatutsDemandeInscription() {
  const result = await database.query(
    "SELECT id, code FROM statut_demande_inscription ORDER BY code ASC",
  );
  return result.rows.map(mapStatutDemandeInscription);
}

export async function getStatutDemandeInscriptionById(id) {
  const result = await database.query(
    "SELECT id, code FROM statut_demande_inscription WHERE id = $1",
    [id],
  );
  return result.rows[0] ? mapStatutDemandeInscription(result.rows[0]) : null;
}
