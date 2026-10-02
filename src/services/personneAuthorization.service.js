import { isBusinessManager } from "../utils/roles.js";
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
    `SELECT
      p.id,
      p.id_compte_createur,
      EXISTS (
        SELECT 1
        FROM compte_membre cm
        WHERE cm.id_personne = p.id
      ) AS has_compte_membre
    FROM personne p
    WHERE p.id = $1`,
    [idPersonne],
  );

  return result.rows[0] ?? null;
}

/**
 * A creator keeps its exceptional rights only until the Personne has a linked
 * compte_membre. The creator id remains historical data after that point.
 */
export function isHistoricalCreatorPrivileged(personne, auth) {
  return Boolean(
    !personne?.has_compte_membre &&
      auth?.compte?.id &&
      personne.id_compte_createur === auth.compte.id,
  );
}

export function canManagePersonneRecord(personne, auth) {
  if (!personne || !auth?.compte?.id) return false;

  const isOwner = personne.id === auth?.personne?.id;

  if (auth.compte.role === "BUREAU_ZANAKA_AMPIELEZANA") {
    return isOwner || isHistoricalCreatorPrivileged(personne, auth);
  }

  // Dès qu'un compte est associé à la personne, seul son propriétaire peut
  // modifier la fiche. Le rôle ADMIN ne constitue pas une exception.
  if (personne.has_compte_membre) return isOwner;

  if (isBusinessManager(auth.compte.role)) return true;

  return isHistoricalCreatorPrivileged(personne, auth);
}

export async function canManagePersonne(idPersonne, auth) {
  return canManagePersonneRecord(
    await getPersonneForManagement(idPersonne),
    auth,
  );
}

export async function assertCanManagePersonne(idPersonne, auth) {
  const personne = await getPersonneForManagement(idPersonne);

  if (!personne) {
    throw businessError("Personne introuvable", "PERSONNE_NOT_FOUND");
  }

  if (canManagePersonneRecord(personne, auth)) {
    return personne;
  }

  throw businessError(
    "Vous n'êtes pas autorisé à gérer cette personne",
    "PERSONNE_MANAGEMENT_FORBIDDEN",
  );
}
export async function assertCanEditCompletePersonne(idPersonne, auth) {
  const personne = await getPersonneForManagement(idPersonne);

  if (!personne) {
    throw businessError("Personne introuvable", "PERSONNE_NOT_FOUND");
  }

  if (canManagePersonneRecord(personne, auth)) {
    return personne;
  }

  throw businessError(
    "Vous n’êtes pas autorisé à gérer cette personne",
    "PERSONNE_MANAGEMENT_FORBIDDEN",
  );
}