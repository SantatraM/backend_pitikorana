import database from "../config/db.js";
import { assertCanManagePersonne } from "./personneAuthorization.service.js";

export const CHAMPS_CONFIDENTIELS = Object.freeze([
  "EMAIL",
  "FACEBOOK",
  "TELEPHONE",
  "WHATSAPP",
  "ADRESSE",
  "PHOTO",
]);

export const VISIBILITES_CONFIDENTIELLES = Object.freeze([
  "PRIVE",
  "MEMBRES",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function defaultVisibilites() {
  return Object.fromEntries(CHAMPS_CONFIDENTIELS.map((champ) => [champ, "PRIVE"]));
}

function emptyConfiguration(idPersonne) {
  return {
    id_personne: idPersonne,
    id_compte_createur: null,
    visibilites: defaultVisibilites(),
  };
}

function asPlainObject(value) {
  if (value == null) return value;
  if (typeof value.toJSON === "function") return { ...value.toJSON() };
  return { ...value };
}

function getConfiguration(configurations, idPersonne) {
  return configurations?.[idPersonne] ?? emptyConfiguration(idPersonne);
}

function confidentialityValidationError(message) {
  const error = new Error(message);
  error.code = "CONFIDENTIALITE_INVALID";
  return error;
}

function preferencesForApi(configuration) {
  const visibilites = configuration?.visibilites ?? defaultVisibilites();
  return Object.fromEntries(
    CHAMPS_CONFIDENTIELS.map((champ) => [
      champ.toLowerCase(),
      visibilites[champ] ?? "PRIVE",
    ]),
  );
}

export function normalizeChampConfidentiel(value) {
  const champ = typeof value === "string" ? value.trim().toUpperCase() : null;
  if (!CHAMPS_CONFIDENTIELS.includes(champ)) {
    throw new Error("Champ de confidentialité invalide");
  }
  return champ;
}

export function normalizeVisibiliteConfidentielle(value) {
  const visibilite =
    typeof value === "string" ? value.trim().toUpperCase() : null;
  if (!VISIBILITES_CONFIDENTIELLES.includes(visibilite)) {
    throw new Error("Visibilité invalide");
  }
  return visibilite;
}

export function normalizePreferencesConfidentialite(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw confidentialityValidationError("Les préférences sont invalides");
  }

  const entries = Object.entries(body);
  if (entries.length === 0) {
    throw confidentialityValidationError(
      "Au moins une préférence doit être fournie",
    );
  }

  return entries.map(([key, value]) => {
    if (key !== key.toLowerCase()) {
      throw confidentialityValidationError("Champ de confidentialité invalide");
    }

    try {
      return {
        champ: normalizeChampConfidentiel(key),
        visibilite: normalizeVisibiliteConfidentielle(value),
      };
    } catch {
      throw confidentialityValidationError("Préférence de confidentialité invalide");
    }
  });
}

/**
 * Retourne les règles et le créateur de chaque Personne demandée. Les règles
 * manquantes sont matérialisées avec la visibilité PRIVE par défaut.
 */
export async function getConfidentialitesByPersonnes(idsPersonnes) {
  if (!Array.isArray(idsPersonnes)) {
    throw new Error("Les identifiants de Personne doivent être une liste");
  }

  const ids = [...new Set(idsPersonnes)];
  if (ids.length === 0) return {};

  if (ids.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
    throw new Error("Identifiant de Personne invalide");
  }

  const configurations = Object.fromEntries(
    ids.map((idPersonne) => [idPersonne, emptyConfiguration(idPersonne)]),
  );

  const result = await database.query(
    `SELECT
      p.id AS id_personne,
      p.id_compte_createur,
      cp.champ,
      cp.visibilite
    FROM personne p
    LEFT JOIN confidentialite_personne cp
      ON cp.id_personne = p.id
    WHERE p.id = ANY($1::uuid[])`,
    [ids],
  );

  for (const row of result.rows) {
    const configuration = configurations[row.id_personne];
    if (!configuration) continue;

    configuration.id_compte_createur = row.id_compte_createur ?? null;
    if (row.champ) {
      configuration.visibilites[row.champ] = row.visibilite;
    }
  }

  return configurations;
}

export async function getPreferencesConfidentialitePersonne(idPersonne, auth) {
  await assertCanManagePersonne(idPersonne, auth);
  const configurations = await getConfidentialitesByPersonnes([idPersonne]);
  return preferencesForApi(configurations[idPersonne]);
}

export async function updatePreferencesConfidentialitePersonne(
  idPersonne,
  body,
  auth,
) {
  const preferences = normalizePreferencesConfidentialite(body);

  return database.transaction(async () => {
    await assertCanManagePersonne(idPersonne, auth);

    await database.query(
      `INSERT INTO confidentialite_personne (id_personne, champ, visibilite)
      SELECT $1::uuid, preference.champ, preference.visibilite
      FROM UNNEST($2::varchar[], $3::varchar[])
        AS preference(champ, visibilite)
      ON CONFLICT (id_personne, champ)
      DO UPDATE SET
        visibilite = EXCLUDED.visibilite,
        date_modification = now()`,
      [
        idPersonne,
        preferences.map((preference) => preference.champ),
        preferences.map((preference) => preference.visibilite),
      ],
    );

    const configurations = await getConfidentialitesByPersonnes([idPersonne]);
    return preferencesForApi(configurations[idPersonne]);
  });
}

export function isChampConfidentielVisible(
  { id_personne, id_compte_createur, visibilites = {} },
  champ,
  auth = null,
) {
  const normalizedChamp = normalizeChampConfidentiel(champ);

  if (auth?.compte?.role === "ADMIN") return true;
  if (auth?.personne?.id === id_personne) return true;
  if (auth?.compte?.id && auth.compte.id === id_compte_createur) return true;

  return (
    Boolean(auth?.compte?.id) &&
    (visibilites[normalizedChamp] ?? "PRIVE") === "MEMBRES"
  );
}

export function filterPersonneConfidentiel(personne, configuration, auth = null) {
  if (!personne) return personne;

  const result = asPlainObject(personne);
  const rules = configuration ?? emptyConfiguration(result.id);

  if (!isChampConfidentielVisible(rules, "ADRESSE", auth)) {
    result.adresse = null;
  }

  if (result.contact) {
    const contact = asPlainObject(result.contact);
    if (!isChampConfidentielVisible(rules, "TELEPHONE", auth)) {
      contact.telephone = null;
    }
    if (!isChampConfidentielVisible(rules, "WHATSAPP", auth)) {
      contact.whatsapp = null;
    }
    if (!isChampConfidentielVisible(rules, "EMAIL", auth)) {
      contact.email = null;
    }
    if (!isChampConfidentielVisible(rules, "FACEBOOK", auth)) {
      contact.facebook = null;
      contact.lien_facebook = null;
    }
    result.contact = contact;
  }

  if (!isChampConfidentielVisible(rules, "PHOTO", auth)) {
    result.photo = null;
  } else if (result.photo) {
    result.photo = asPlainObject(result.photo);
  }

  return result;
}

export function filterContactConfidentiel(contact, configuration, auth = null) {
  if (!contact) return contact;

  const result = asPlainObject(contact);
  const rules = configuration ?? emptyConfiguration(result.id_personne);

  if (!isChampConfidentielVisible(rules, "TELEPHONE", auth)) {
    result.telephone = null;
  }
  if (!isChampConfidentielVisible(rules, "WHATSAPP", auth)) {
    result.whatsapp = null;
  }
  if (!isChampConfidentielVisible(rules, "EMAIL", auth)) {
    result.email = null;
  }
  if (!isChampConfidentielVisible(rules, "FACEBOOK", auth)) {
    result.facebook = null;
    result.lien_facebook = null;
  }

  return result;
}

export function filterPhotoConfidentielle(photo, configuration, auth = null) {
  if (!photo) return photo;

  const rules = configuration ?? emptyConfiguration(photo.id_personne);
  return isChampConfidentielVisible(rules, "PHOTO", auth)
    ? asPlainObject(photo)
    : null;
}

export async function filterPersonnesConfidentielles(personnes, auth = null) {
  const configurations = await getConfidentialitesByPersonnes(
    personnes.map((personne) => personne.id),
  );
  return personnes.map((personne) =>
    filterPersonneConfidentiel(
      personne,
      getConfiguration(configurations, personne.id),
      auth,
    ),
  );
}

export async function filterContactsConfidentiels(contacts, auth = null) {
  const configurations = await getConfidentialitesByPersonnes(
    contacts.map((contact) => contact.id_personne),
  );
  return contacts.map((contact) =>
    filterContactConfidentiel(
      contact,
      getConfiguration(configurations, contact.id_personne),
      auth,
    ),
  );
}

export async function filterPhotosConfidentielles(photos, auth = null) {
  const configurations = await getConfidentialitesByPersonnes(
    photos.map((photo) => photo.id_personne),
  );
  return photos
    .map((photo) =>
      filterPhotoConfidentielle(
        photo,
        getConfiguration(configurations, photo.id_personne),
        auth,
      ),
    )
    .filter((photo) => photo !== null);
}
