import database from "../config/db.js";
import Personne from "../models/Personne.js";
import {
  createSignedStorageUrl,
  createSignedStorageUrls,
  deleteStorageObject,
} from "./storage.service.js";
import { getPersonnesActivitesByPersonne } from "./personneActivite.service.js";
import { getPersonnesCompetencesByPersonne } from "./personneCompetence.service.js";
import { getPersonnesCentresInteretByPersonne } from "./personneCentreInteret.service.js";
import { getRelationsPersonneByPersonne } from "./relationPersonne.service.js";
import {
  filterPersonneConfidentiel,
  filterPersonnesConfidentielles,
  getConfidentialitesByPersonnes,
} from "./confidentialitePersonne.service.js";
import {
  assertCanManagePersonne,
  canManagePersonne,
} from "./personneAuthorization.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validatePersonneId(id) {
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    const error = new Error("Identifiant invalide");
    error.code = "PERSONNE_ID_INVALID";
    throw error;
  }
}
const f =
  "nom, prenom, nom_usage, autres_appellations, id_sexe, id_statut, date_naissance, annee_naissance, lieu_naissance, date_deces, annee_deces, adresse, id_ville, id_lien, id_element";
function mapPersonneRow(row) {
  return new Personne({
    id: row.id,
    date_creation: row.date_creation,
    date_modification: row.date_modification,
    nom: row.nom,
    prenom: row.prenom,
    nom_usage: row.nom_usage,
    autres_appellations: row.autres_appellations,
    date_naissance: row.date_naissance,
    date_deces: row.date_deces,
    annee_naissance: row.annee_naissance,
    annee_deces: row.annee_deces,
    lieu_naissance: row.lieu_naissance,
    adresse: row.adresse,
    id_sexe: row.id_sexe,
    id_statut: row.id_statut,
    id_ville: row.id_ville,
    id_lien: row.id_lien,
    id_element: row.id_element,
    sexe: row.id_sexe
      ? { id: row.id_sexe, libelle: row.sexe_libelle }
      : null,
    statut: row.id_statut
      ? { id: row.id_statut, libelle: row.statut_libelle }
      : null,
    lien: row.id_lien
      ? { id: row.id_lien, libelle: row.lien_libelle }
      : null,
    ville: row.id_ville
      ? {
          id: row.id_ville,
          nom: row.nom_ville,
          region: row.id_region
            ? {
                id: row.id_region,
                nom: row.nom_region,
                pays: row.id_pays
                  ? { id: row.id_pays, nom: row.nom_pays }
                  : null,
              }
            : null,
        }
      : null,
    element: row.id_element
      ? {
          id: row.id_element,
          nom: row.nom_element,
          type_element: row.id_type_element
            ? {
                id: row.id_type_element,
                libelle: row.type_element_libelle,
              }
            : null,
        }
      : null,
    razambe: row.id_razambe
      ? { id: row.id_razambe, nom: row.nom_razambe }
      : null,
    taranaka: row.id_taranaka
      ? { id: row.id_taranaka, nom: row.nom_taranaka }
      : null,
    sampana: row.id_sampana
      ? { id: row.id_sampana, nom: row.nom_sampana }
      : null,
    contact: row.id_contact
      ? {
          id: row.id_contact,
          telephone: row.telephone ?? null,
          whatsapp: row.whatsapp ?? null,
          email: row.email ?? null,
          facebook: row.facebook ?? null,
          lien_facebook: row.lien_facebook ?? null,
        }
      : null,
    photo: row.id_photo
      ? {
          id: row.id_photo,
          chemin_photo: row.chemin_photo,
        }
      : null,
  });
}

async function getPersonneRawById(id) {
  const result = await database.query(
    "SELECT * FROM personne WHERE id=$1",
    [id],
  );
  return result.rows[0] ? new Personne(result.rows[0]) : null;
}

export const getAllPersonnes = async (lang = "fr") => {
  const result = await database.query(
    "SELECT * FROM v_personne_langue WHERE code_langue=$1 ORDER BY nom ASC, prenom ASC",
    [lang],
  );
  return result.rows.map(mapPersonneRow);
};

export const getPersonneById = async (id, lang = "fr") => {
  const result = await database.query(
    "SELECT * FROM v_personne_langue WHERE id=$1 AND code_langue=$2",
    [id, lang],
  );
  return result.rows[0] ? mapPersonneRow(result.rows[0]) : null;
};

function arbreNode(row, childrenKey) {
  return {
    id: row.id,
    nom: row.nom,
    prenom: row.prenom ?? null,
    sexe: row.code_sexe ?? null,
    generation: Number(row.generation),
    [childrenKey]: [],
  };
}

async function getArbreGenealogique(id, relationCode, childrenKey, generationStep) {
  validatePersonneId(id);

  const result = await database.query(
    `WITH RECURSIVE arbre AS (
      SELECT
        p.id,
        p.nom,
        p.prenom,
        s.code AS code_sexe,
        0 AS generation,
        ARRAY[p.id] AS chemin
      FROM personne p
      LEFT JOIN sexe s ON s.id = p.id_sexe
      WHERE p.id = $1

      UNION ALL

      SELECT
        cible.id,
        cible.nom,
        cible.prenom,
        sexe_cible.code AS code_sexe,
        arbre.generation + $3 AS generation,
        array_append(arbre.chemin, cible.id) AS chemin
      FROM arbre
      JOIN relation_personne r
        ON r.id_personne_source = arbre.id
      JOIN type_relation tr
        ON tr.id = r.id_type_relation
        AND tr.code = $2
      JOIN personne cible
        ON cible.id = r.id_personne_cible
      LEFT JOIN sexe sexe_cible
        ON sexe_cible.id = cible.id_sexe
      WHERE NOT cible.id = ANY(arbre.chemin)
    )
    SELECT id, nom, prenom, code_sexe, generation, chemin
    FROM arbre
    ORDER BY cardinality(chemin), chemin::text`,
    [id, relationCode, generationStep],
  );

  if (result.rows.length === 0) return null;

  const root = arbreNode(result.rows[0], childrenKey);
  const nodesByPath = new Map([[result.rows[0].chemin.join('/'), root]]);

  for (const row of result.rows.slice(1)) {
    const path = row.chemin.join('/');
    const parentPath = row.chemin.slice(0, -1).join('/');
    const parent = nodesByPath.get(parentPath);
    if (!parent) continue;

    const node = arbreNode(row, childrenKey);
    parent[childrenKey].push(node);
    nodesByPath.set(path, node);
  }

  return root;
}

export function getAscendantsPersonne(id) {
  return getArbreGenealogique(id, "PARENT", "parents", -1);
}

export function getDescendantsPersonne(id) {
  return getArbreGenealogique(id, "ENFANT", "enfants", 1);
}
export async function getFratriePersonne(id) {
  validatePersonneId(id);

  const result = await database.query(
    `WITH
      racine AS (
        SELECT id
        FROM personne
        WHERE id = $1
      ),
      parents_racine AS (
        SELECT r.id_personne_cible AS id_parent
        FROM relation_personne r
        JOIN type_relation tr
          ON tr.id = r.id_type_relation
          AND tr.code = 'PARENT'
        WHERE r.id_personne_source = $1
      ),
      fratries_explicites AS (
        SELECT r.id_personne_cible AS id_personne
        FROM relation_personne r
        JOIN type_relation tr
          ON tr.id = r.id_type_relation
          AND tr.code = 'FRATRIE'
        WHERE r.id_personne_source = $1
      ),
      fratries_deduites AS (
        SELECT r.id_personne_source AS id_personne
        FROM relation_personne r
        JOIN type_relation tr
          ON tr.id = r.id_type_relation
          AND tr.code = 'PARENT'
        WHERE r.id_personne_source <> $1
        GROUP BY r.id_personne_source
        HAVING
          (SELECT count(*) FROM parents_racine) = 2
          AND count(*) = 2
          AND count(*) FILTER (
            WHERE r.id_personne_cible IN (SELECT id_parent FROM parents_racine)
          ) = 2
      ),
      origines AS (
        SELECT id_personne, true AS explicite, false AS deduite
        FROM fratries_explicites
        UNION ALL
        SELECT id_personne, false AS explicite, true AS deduite
        FROM fratries_deduites
      ),
      fratries AS (
        SELECT id_personne, bool_or(explicite) AS explicite, bool_or(deduite) AS deduite
        FROM origines
        GROUP BY id_personne
      )
    SELECT
      racine.id AS id_racine,
      p.id,
      p.nom,
      p.prenom,
      s.code AS sexe,
      CASE
        WHEN fratries.explicite AND fratries.deduite THEN 'EXPLICITE_ET_DEDUITE'
        WHEN fratries.explicite THEN 'EXPLICITE'
        ELSE 'DEDUITE'
      END AS origine
    FROM racine
    LEFT JOIN fratries ON true
    LEFT JOIN personne p ON p.id = fratries.id_personne
    LEFT JOIN sexe s ON s.id = p.id_sexe
    ORDER BY p.nom ASC NULLS LAST, p.prenom ASC NULLS LAST, p.id ASC`,
    [id],
  );

  if (result.rows.length === 0) return null;

  return {
    id: result.rows[0].id_racine,
    fratrie: result.rows
      .filter((row) => row.id)
      .map((row) => ({
        id: row.id,
        nom: row.nom,
        prenom: row.prenom ?? null,
        sexe: row.sexe ?? null,
        origine: row.origine,
      })),
  };
}
export async function getConjointsPersonne(id) {
  validatePersonneId(id);

  const result = await database.query(
    `WITH
      racine AS (
        SELECT id
        FROM personne
        WHERE id = $1
      ),
      conjoints AS (
        SELECT DISTINCT r.id_personne_cible AS id_personne
        FROM relation_personne r
        JOIN type_relation tr
          ON tr.id = r.id_type_relation
          AND tr.code = 'CONJOINT'
        WHERE r.id_personne_source = $1
      )
    SELECT
      racine.id AS id_racine,
      p.id,
      p.nom,
      p.prenom,
      s.code AS sexe
    FROM racine
    LEFT JOIN conjoints c ON true
    LEFT JOIN personne p ON p.id = c.id_personne
    LEFT JOIN sexe s ON s.id = p.id_sexe
    ORDER BY p.nom ASC NULLS LAST, p.prenom ASC NULLS LAST, p.id ASC`,
    [id],
  );

  if (result.rows.length === 0) return null;

  return {
    id: result.rows[0].id_racine,
    conjoints: result.rows
      .filter((row) => row.id)
      .map((row) => ({
        id: row.id,
        nom: row.nom,
        prenom: row.prenom ?? null,
        sexe: row.sexe ?? null,
      })),
  };
}
function mapPersonneGenealogique(row) {
  return {
    id: row.id,
    nom: row.nom,
    prenom: row.prenom ?? null,
    sexe: row.sexe ?? null,
  };
}

async function getPersonneGenealogique(id) {
  const result = await database.query(
    `SELECT p.id, p.nom, p.prenom, s.code AS sexe
    FROM personne p
    LEFT JOIN sexe s ON s.id = p.id_sexe
    WHERE p.id = $1`,
    [id],
  );
  return result.rows[0] ? mapPersonneGenealogique(result.rows[0]) : null;
}

async function getPersonnesLieesDirectes(id, relationCode) {
  const result = await database.query(
    `SELECT DISTINCT p.id, p.nom, p.prenom, s.code AS sexe
    FROM relation_personne r
    JOIN type_relation tr
      ON tr.id = r.id_type_relation
      AND tr.code = $2
    JOIN personne p ON p.id = r.id_personne_cible
    LEFT JOIN sexe s ON s.id = p.id_sexe
    WHERE r.id_personne_source = $1
    ORDER BY p.nom ASC, p.prenom ASC NULLS LAST, p.id ASC`,
    [id, relationCode],
  );
  return result.rows.map(mapPersonneGenealogique);
}

function foyerError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function getConjointsFoyer(id) {
  const result = await database.query(
    `SELECT DISTINCT p.id, p.nom, p.prenom, s.code AS sexe
    FROM relation_personne r
    JOIN type_relation tr
      ON tr.id = r.id_type_relation
      AND tr.code = 'CONJOINT'
    JOIN personne p
      ON p.id = CASE
        WHEN r.id_personne_source = $1 THEN r.id_personne_cible
        ELSE r.id_personne_source
      END
    LEFT JOIN sexe s ON s.id = p.id_sexe
    WHERE r.id_personne_source = $1 OR r.id_personne_cible = $1
    ORDER BY p.nom ASC, p.prenom ASC NULLS LAST, p.id ASC`,
    [id],
  );
  return result.rows.map(mapPersonneGenealogique);
}

async function getEnfantsFoyerExact(parentIds) {
  const result = await database.query(
    `WITH enfants_foyer AS (
      SELECT r.id_personne_source
      FROM relation_personne r
      JOIN type_relation tr
        ON tr.id = r.id_type_relation
        AND tr.code = 'PARENT'
      GROUP BY r.id_personne_source
      HAVING array_agg(
        DISTINCT r.id_personne_cible
        ORDER BY r.id_personne_cible
      ) = $1::uuid[]
    )
    SELECT p.id, p.nom, p.prenom, s.code AS sexe
    FROM enfants_foyer ef
    JOIN personne p ON p.id = ef.id_personne_source
    LEFT JOIN sexe s ON s.id = p.id_sexe
    ORDER BY p.nom ASC, p.prenom ASC NULLS LAST, p.id ASC`,
    [parentIds],
  );
  return result.rows.map(mapPersonneGenealogique);
}

export async function getFoyerPersonne(id) {
  validatePersonneId(id);

  const personne = await getPersonneGenealogique(id);
  if (!personne) return null;

  const [parents, conjoints] = await Promise.all([
    getPersonnesLieesDirectes(id, "PARENT"),
    getConjointsFoyer(id),
  ]);

  if (parents.length > 2) {
    throw foyerError(
      "Cette personne possède plus de deux parents enregistrés.",
      "FOYER_PARENT_CONFLICT",
    );
  }

  if (conjoints.length > 1) {
    throw foyerError(
      "Cette personne possède plus d'un conjoint enregistré.",
      "FOYER_CONJOINT_CONFLICT",
    );
  }

  let foyerOrigine = null;
  if (parents.length === 1) {
    foyerOrigine = {
      statut: "INCOMPLET",
      identite: null,
      parents,
      enfants: [],
    };
  } else if (parents.length === 2) {
    const parentIds = parents.map((parent) => parent.id).sort();
    foyerOrigine = {
      statut: "COMPLET",
      identite: { parents: parentIds },
      parents,
      enfants: await getEnfantsFoyerExact(parentIds),
    };
  }

  let foyerForme = null;
  if (conjoints.length === 1) {
    const conjoint = conjoints[0];
    const parentIds = [personne.id, conjoint.id].sort();
    foyerForme = {
      statut: "COMPLET",
      identite: { parents: parentIds },
      personne,
      conjoint,
      enfants: await getEnfantsFoyerExact(parentIds),
    };
  }

  return {
    personne,
    foyer_origine: foyerOrigine,
    foyer_forme: foyerForme,
  };
}
export async function getFamillePersonne(id) {
  validatePersonneId(id);

  const personne = await getPersonneGenealogique(id);
  if (!personne) return null;

  const [parents, conjoints, enfants, fratrie] = await Promise.all([
    getPersonnesLieesDirectes(id, "PARENT"),
    getPersonnesLieesDirectes(id, "CONJOINT"),
    getPersonnesLieesDirectes(id, "ENFANT"),
    getFratriePersonne(id),
  ]);

  return {
    personne,
    parents,
    conjoints,
    enfants,
    fratrie: fratrie?.fratrie ?? [],
  };
}
async function filterPersonneForReader(personne, auth) {
  if (!personne) return personne;

  const configurations = await getConfidentialitesByPersonnes([personne.id]);
  const filtered = filterPersonneConfidentiel(
    personne,
    configurations[personne.id],
    auth,
  );
  return addSignedUrlToPersonnePhoto(filtered);
}

async function addSignedUrlToPersonnePhoto(personne) {
  if (!personne?.photo) return personne;

  const url_photo = await createSignedStorageUrl(
    "photos_personne",
    personne.photo.chemin_photo,
  );
  return {
    ...personne,
    photo: { id: personne.photo.id, url_photo },
  };
}

async function addSignedUrlsToPersonnesPhotos(personnes) {
  const photos = personnes
    .map((personne) => personne.photo)
    .filter((photo) => photo !== null);
  if (photos.length === 0) return personnes;

  const signedUrls = await createSignedStorageUrls(
    "photos_personne",
    photos.map((photo) => photo.chemin_photo),
  );
  return personnes.map((personne) =>
    personne.photo
      ? {
          ...personne,
          photo: {
            id: personne.photo.id,
            url_photo: signedUrls.get(personne.photo.chemin_photo),
          },
        }
      : personne,
  );
}

export async function getAllPersonnesForReader(lang = "fr", auth = null) {
  return addSignedUrlsToPersonnesPhotos(
    await filterPersonnesConfidentielles(await getAllPersonnes(lang), auth),
  );
}

export async function getPersonneByIdForReader(id, lang = "fr", auth = null) {
  return filterPersonneForReader(await getPersonneById(id, lang), auth);
}

export async function getProfilPersonne(id, lang = "fr") {
  validatePersonneId(id);

  const personne = await getPersonneById(id, lang);
  if (!personne) {
    return null;
  }

  // Séquentiel volontairement : les services existants partagent le client
  // PostgreSQL isolé par requête dans le runtime Worker.
  const activites = await getPersonnesActivitesByPersonne(id, lang);
  const competences = await getPersonnesCompetencesByPersonne(id, lang);
  const centres_interet = await getPersonnesCentresInteretByPersonne(id, lang);
  const relations = await getRelationsPersonneByPersonne(id, lang);

  return {
    personne,
    activites,
    competences,
    centres_interet,
    relations,
  };
}

export async function getProfilPersonneForReader(id, lang = "fr", auth = null) {
  const [profil, can_manage] = await Promise.all([
    getProfilPersonne(id, lang),
    canManagePersonne(id, auth),
  ]);
  if (!profil) return profil;

  return {
    ...profil,
    can_manage,
    personne: await filterPersonneForReader(profil.personne, auth),
  };
}

export const getPersonnesByElement = async (id, lang = "fr") => {
  const result = await database.query(
    "SELECT * FROM v_personne_langue WHERE id_element=$1 AND code_langue=$2 ORDER BY nom ASC, prenom ASC",
    [id, lang],
  );
  return result.rows.map(mapPersonneRow);
};

export async function getPersonnesByElementForReader(
  id,
  lang = "fr",
  auth = null,
) {
  return addSignedUrlsToPersonnesPhotos(
    await filterPersonnesConfidentielles(
      await getPersonnesByElement(id, lang),
      auth,
    ),
  );
}

export const getPersonnesByElementDescendants = async (id, lang = "fr") => {
  const result = await database.query(
    `WITH RECURSIVE descendants AS (
      SELECT id FROM element WHERE id = $1
      UNION ALL
      SELECT e.id
      FROM element e
      JOIN descendants d ON e.rattachement_sup = d.id
    )
    SELECT vp.*
    FROM v_personne_langue vp
    JOIN descendants d ON d.id = vp.id_element
    WHERE vp.code_langue = $2
    ORDER BY vp.nom ASC, vp.prenom ASC`,
    [id, lang],
  );
  return result.rows.map(mapPersonneRow);
};

export async function getPersonnesByElementDescendantsForReader(
  id,
  lang = "fr",
  auth = null,
) {
  return addSignedUrlsToPersonnesPhotos(
    await filterPersonnesConfidentielles(
      await getPersonnesByElementDescendants(id, lang),
      auth,
    ),
  );
}
async function check(t, id, n) {
  if (!id) return;
  const r = await database.query(`SELECT id FROM ${t} WHERE id=$1`, [id]);
  if (!r.rows[0]) {
    const e = new Error(`${n} inexistante`);
    e.code = "FK";
    throw e;
  }
}
async function valid(p) {
  await check("sexe", p.id_sexe, "Sexe");
  await check("statut", p.id_statut, "Statut");
  await check("ville", p.id_ville, "Ville");
  await check("lien_avec_falimanjaka", p.id_lien, "Lien");
  await check("element", p.id_element, "Élément");
}
const vals = (p) => f.split(", ").map((k) => p[k]);
export async function createPersonne(
  p,
  lang = "fr",
  idCompteCreateur = null,
  auth = null,
) {
  await valid(p);
  const r = await database.query(
    `INSERT INTO personne (${f}, id_compte_createur) VALUES (${f
      .split(", ")
      .map((_, i) => "$" + (i + 1))
      .join(",")}, $16) RETURNING id`,
    [...vals(p), idCompteCreateur],
  );
  return getPersonneByIdForReader(r.rows[0].id, lang, auth);
}
export async function updatePersonne(id, p, lang = "fr", auth = null) {
  const personne = await updatePersonneInTransaction(id, p, auth);
  return personne ? getPersonneByIdForReader(id, lang, auth) : null;
}

export async function updatePersonneInTransaction(id, p, auth = null) {
  const old = await getPersonneRawById(id);
  if (!old) return null;
  await assertCanManagePersonne(id, auth);

  let personne = new Personne({ ...old, ...p });
  if (personne.id_statut) {
    const statut = await database.query(
      "SELECT code FROM statut WHERE id = $1",
      [personne.id_statut],
    );
    if (statut.rows[0]?.code === "VIVANT") {
      personne = new Personne({
        ...personne,
        date_deces: null,
        annee_deces: null,
      });
    }
  }
  await valid(personne);
  await database.query(
    `UPDATE personne SET (${f})=(${f
      .split(", ")
      .map((_, i) => "$" + (i + 1))
      .join(",")}), date_modification = now() WHERE id=$16`,
    [...vals(personne), id],
  );
  return personne;
}
export async function deletePersonne(id) {
  const deletion = await database.transaction(async () => {
    const personne = await getPersonneRawById(id);
    if (!personne) return null;

    // Verrouille la photo éventuelle : un remplacement concurrent ne peut pas
    // changer son chemin entre la lecture et le cascade PostgreSQL.
    const photoResult = await database.query(
      `SELECT id, id_personne, chemin_photo
      FROM photos_personne
      WHERE id_personne = $1
      FOR UPDATE`,
      [id],
    );

    await database.query("DELETE FROM personne WHERE id=$1", [id]);

    return {
      personne,
      cheminPhoto: photoResult.rows[0]?.chemin_photo ?? null,
    };
  });

  if (!deletion) return null;

  if (deletion.cheminPhoto) {
    try {
      await deleteStorageObject("photos_personne", deletion.cheminPhoto, {
        allowNotFound: true,
      });
    } catch (error) {
      // La suppression PostgreSQL est déjà validée : ne jamais la présenter
      // comme un échec ni tenter de restaurer la personne.
      console.error(
        `Personne supprimée, nettoyage Storage impossible pour ${deletion.cheminPhoto}`,
        error.code ?? "STORAGE_DELETE_FAILED",
      );
    }
  }

  return deletion.personne;
}
