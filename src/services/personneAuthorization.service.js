import database from "../config/db.js";

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Charge les seules données Personne nécessaires aux autorisations d'écriture.
 * Les GET publics ne passent pas par ce helper.
 */
export async function getPersonneForManagement(idPersonne) {
  const result = await database.query(
    `SELECT id, id_compte_createur
    FROM personne
    WHERE id = $1`,
    [idPersonne],
  );

  return result.rows[0] ?? null;
}

export async function assertCanManagePersonne(idPersonne, auth) {
  const personne = await getPersonneForManagement(idPersonne);

  if (!personne) {
    throw businessError("Personne introuvable", "PERSONNE_NOT_FOUND");
  }

  if (auth?.compte?.role === "ADMIN") {
    return personne;
  }

  const isOwnPersonne = personne.id === auth?.personne?.id;
  const isCreator = personne.id_compte_createur === auth?.compte?.id;

  if (isOwnPersonne || isCreator) {
    return personne;
  }

  throw businessError(
    "Vous n'êtes pas autorisé à modifier cette fiche",
    "PERSONNE_MANAGEMENT_FORBIDDEN",
  );
}
