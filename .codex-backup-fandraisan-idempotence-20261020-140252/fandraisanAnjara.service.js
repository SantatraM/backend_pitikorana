import database from "../config/db.js";
import { isBusinessManager } from "../utils/roles.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTRIBUTOR_TYPES = new Set(["RAZAMBE", "TARANAKA", "SAMPANA", "FOYER", "PERSONNE"]);
const CREATION_FIELDS = new Set([
  "date_contribution",
  "type_contributeur",
  "id_contributeur",
  "observation",
  "lignes",
]);
const LINE_FIELDS = new Set([
  "nature",
  "montant",
  "devise",
  "designation",
  "quantite",
  "unite",
  "observation",
]);

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertPlainObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw businessError(message, "FANDRAISAN_ANJARA_INVALID");
  }
}

function assertAllowedFields(value, fields, message) {
  if (Object.keys(value).some((field) => !fields.has(field))) {
    throw businessError(message, "FANDRAISAN_ANJARA_INVALID");
  }
}

function normalizeText(value, label, maxLength, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw businessError(`${label} est obligatoire.`, "FANDRAISAN_ANJARA_INVALID");
    return null;
  }
  if (typeof value !== "string") {
    throw businessError(`${label} est invalide.`, "FANDRAISAN_ANJARA_INVALID");
  }
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maxLength) {
    throw businessError(`${label} est invalide.`, "FANDRAISAN_ANJARA_INVALID");
  }
  return normalized || null;
}

function madagascarToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Indian/Antananarivo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts
    .filter((part) => ["year", "month", "day"].includes(part.type))
    .map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function normalizeContributionDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw businessError("La date de contribution est invalide.", "FANDRAISAN_ANJARA_INVALID");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw businessError("La date de contribution est invalide.", "FANDRAISAN_ANJARA_INVALID");
  }
  if (value > madagascarToday()) {
    throw businessError("La date de contribution ne peut pas être future.", "FANDRAISAN_ANJARA_INVALID");
  }
  return value;
}

function normalizePositiveIntegerAmount(value) {
  let normalized;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw businessError("Le montant doit être un entier MGA strictement positif.", "FANDRAISAN_ANJARA_INVALID");
    }
    normalized = String(value);
  } else if (typeof value === "string") {
    normalized = value.trim();
  } else {
    throw businessError("Le montant doit être un entier MGA strictement positif.", "FANDRAISAN_ANJARA_INVALID");
  }
  if (!/^\d+$/.test(normalized) || /^0+$/.test(normalized)) {
    throw businessError("Le montant doit être un entier MGA strictement positif.", "FANDRAISAN_ANJARA_INVALID");
  }
  normalized = normalized.replace(/^0+/, "");
  if (normalized.length > 14) {
    throw businessError("Le montant est hors limites.", "FANDRAISAN_ANJARA_INVALID");
  }
  return normalized;
}

function normalizePositiveQuantity(value) {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") {
    throw businessError("La quantité de matériel est invalide.", "FANDRAISAN_ANJARA_INVALID");
  }
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(normalized)) {
    throw businessError("La quantité de matériel est invalide.", "FANDRAISAN_ANJARA_INVALID");
  }
  const [integer, fraction = ""] = normalized.split(".");
  const integerNormalized = integer.replace(/^0+/, "") || "0";
  const fractionNormalized = fraction.replace(/0+$/, "");
  if (integerNormalized.length + fractionNormalized.length > 14 || /^0*$/.test(`${integer}${fraction}`)) {
    throw businessError("La quantité de matériel est invalide.", "FANDRAISAN_ANJARA_INVALID");
  }
  return fractionNormalized ? `${integerNormalized}.${fractionNormalized}` : integerNormalized;
}

function normalizeLines(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw businessError("Au moins une ligne de contribution est obligatoire.", "FANDRAISAN_ANJARA_INVALID");
  }
  return value.map((line, index) => {
    assertPlainObject(line, "Ligne de contribution invalide.");
    assertAllowedFields(line, LINE_FIELDS, "Ligne de contribution invalide.");
    const nature = typeof line.nature === "string" ? line.nature.trim().toUpperCase() : "";
    const observation = normalizeText(line.observation, "Observation de ligne", 100000);
    if (nature === "ARGENT") {
      if (line.devise !== "MGA" || line.designation !== undefined || line.quantite !== undefined || line.unite !== undefined) {
        throw businessError("La ligne ARGENT est invalide.", "FANDRAISAN_ANJARA_INVALID");
      }
      return { nature, montant: normalizePositiveIntegerAmount(line.montant), devise: "MGA", designation: null, quantite: null, unite: null, observation, ordre: index + 1 };
    }
    if (nature === "MATERIEL") {
      if (line.montant !== undefined || line.devise !== undefined) {
        throw businessError("La ligne MATERIEL est invalide.", "FANDRAISAN_ANJARA_INVALID");
      }
      return {
        nature,
        montant: null,
        devise: null,
        designation: normalizeText(line.designation, "Désignation du matériel", 200, { required: true }),
        quantite: normalizePositiveQuantity(line.quantite),
        unite: normalizeText(line.unite, "Unité du matériel", 50, { required: true }),
        observation,
        ordre: index + 1,
      };
    }
    throw businessError("La nature de la ligne est invalide.", "FANDRAISAN_ANJARA_INVALID");
  });
}

function getCreatorAccount(auth) {
  if (!auth?.compte?.id) throw businessError("Authentification requise.", "AUTH_REQUIRED");
  if (!isBusinessManager(auth.compte.role)) {
    throw businessError("Accès interdit.", "FANDRAISAN_ANJARA_FORBIDDEN");
  }
  return auth.compte.id;
}

function normalizeCreation(body) {
  assertPlainObject(body, "Données de contribution invalides.");
  assertAllowedFields(body, CREATION_FIELDS, "Un champ de contribution n'est pas autorisé.");
  const typeContributeur = typeof body.type_contributeur === "string"
    ? body.type_contributeur.trim().toUpperCase()
    : "";
  const { idContributeur } = normalizeContributor(typeContributeur, body.id_contributeur);
  return {
    date_contribution: normalizeContributionDate(body.date_contribution),
    type_contributeur: typeContributeur,
    id_contributeur: idContributeur,
    observation: normalizeText(body.observation, "Observation", 100000),
    lignes: normalizeLines(body.lignes),
  };
}

function normalizeContributor(typeContributeur, idContributeur) {
  if (!CONTRIBUTOR_TYPES.has(typeContributeur)) {
    throw businessError("Le type de contributeur est invalide.", "FANDRAISAN_ANJARA_CONTRIBUTEUR_INVALID");
  }
  if (typeof idContributeur !== "string" || !UUID_PATTERN.test(idContributeur)) {
    throw businessError("L'identifiant du contributeur est invalide.", "FANDRAISAN_ANJARA_CONTRIBUTEUR_INVALID");
  }
  return { typeContributeur, idContributeur: idContributeur.toLowerCase() };
}

function personLabel(personne) {
  return [personne.nom, personne.prenom].filter(Boolean).join(" ").trim();
}

function unresolved() {
  return {
    id_razambe_snapshot: null,
    id_taranaka_snapshot: null,
    id_sampana_snapshot: null,
    resolution_razambe: "NON_DETERMINE",
  };
}

function resolved(hierarchy, { taranaka = hierarchy.id_taranaka, sampana = hierarchy.id_sampana } = {}) {
  if (!hierarchy?.id_razambe) return unresolved();
  if (taranaka && !hierarchy.id_razambe) return unresolved();
  if (sampana && !taranaka) return unresolved();
  return {
    id_razambe_snapshot: hierarchy.id_razambe,
    id_taranaka_snapshot: taranaka ?? null,
    id_sampana_snapshot: sampana ?? null,
    resolution_razambe: "RESOLU",
  };
}

function toResult(typeContributeur, id, libelle, snapshots) {
  return {
    type_contributeur: typeContributeur,
    id_contributeur: id,
    contributeur: { type: typeContributeur, id },
    contributeur_libelle_snapshot: libelle,
    ...snapshots,
  };
}

async function getElement(client, idElement) {
  const result = await client.query(
    `SELECT e.id, e.nom, te.code
    FROM element e
    JOIN type_element te ON te.id = e.id_type_element
    WHERE e.id = $1`,
    [idElement],
  );
  return result.rows[0] ?? null;
}

async function getHierarchy(client, idElement) {
  const result = await client.query(
    `SELECT id_razambe, id_taranaka, id_sampana
    FROM v_element_hierarchie
    WHERE id_element = $1`,
    [idElement],
  );
  return result.rows[0] ?? null;
}

async function resolveElement(client, typeContributeur, idContributeur) {
  const element = await getElement(client, idContributeur);
  if (!element) throw businessError("Élément contributeur introuvable.", "FANDRAISAN_ANJARA_CONTRIBUTEUR_NOT_FOUND");
  if (element.code !== typeContributeur) {
    throw businessError("Le type réel de l'élément ne correspond pas au contributeur.", "FANDRAISAN_ANJARA_CONTRIBUTEUR_INVALID");
  }
  if (typeContributeur === "RAZAMBE") {
    return toResult(typeContributeur, element.id, element.nom, {
      id_razambe_snapshot: element.id,
      id_taranaka_snapshot: null,
      id_sampana_snapshot: null,
      resolution_razambe: "RESOLU",
    });
  }

  const hierarchy = await getHierarchy(client, element.id);
  const snapshots = resolved(hierarchy, {
    taranaka: typeContributeur === "TARANAKA" ? element.id : hierarchy?.id_taranaka,
    sampana: typeContributeur === "SAMPANA" ? element.id : null,
  });
  if (snapshots.resolution_razambe !== "RESOLU"
      || (typeContributeur === "SAMPANA" && !snapshots.id_taranaka_snapshot)) {
    throw businessError("La hiérarchie de l'élément contributeur est incomplète.", "FANDRAISAN_ANJARA_RATTACHEMENT_INVALID");
  }
  return toResult(typeContributeur, element.id, element.nom, snapshots);
}

async function getPersonneWithHierarchy(client, idPersonne) {
  const result = await client.query(
    `SELECT p.id, p.nom, p.prenom, p.id_element,
      h.id_razambe, h.id_taranaka, h.id_sampana
    FROM personne p
    LEFT JOIN v_element_hierarchie h ON h.id_element = p.id_element
    WHERE p.id = $1`,
    [idPersonne],
  );
  return result.rows[0] ?? null;
}

async function resolvePersonne(client, idPersonne) {
  const personne = await getPersonneWithHierarchy(client, idPersonne);
  if (!personne) throw businessError("Personne contributrice introuvable.", "FANDRAISAN_ANJARA_CONTRIBUTEUR_NOT_FOUND");
  return toResult("PERSONNE", personne.id, personLabel(personne), resolved(personne));
}

async function resolveFoyer(client, idFoyer) {
  const result = await client.query(
    `SELECT f.id, f.type_foyer, f.id_personne_1, f.id_personne_2,
      p1.nom AS personne_1_nom, p1.prenom AS personne_1_prenom,
      p2.nom AS personne_2_nom, p2.prenom AS personne_2_prenom
    FROM foyer f
    JOIN personne p1 ON p1.id = f.id_personne_1
    LEFT JOIN personne p2 ON p2.id = f.id_personne_2
    WHERE f.id = $1`,
    [idFoyer],
  );
  const foyer = result.rows[0];
  if (!foyer) throw businessError("Foyer contributeur introuvable.", "FANDRAISAN_ANJARA_CONTRIBUTEUR_NOT_FOUND");
  if (!["MONOPARENTAL", "COUPLE"].includes(foyer.type_foyer)
      || (foyer.type_foyer === "COUPLE" && !foyer.id_personne_2)) {
    throw businessError("Le foyer contributeur est invalide.", "FANDRAISAN_ANJARA_RATTACHEMENT_INVALID");
  }

  const premier = await resolvePersonne(client, foyer.id_personne_1);
  const libelles = [personLabel({ nom: foyer.personne_1_nom, prenom: foyer.personne_1_prenom })];
  if (foyer.type_foyer === "MONOPARENTAL") {
    return toResult("FOYER", foyer.id, libelles[0], {
      id_razambe_snapshot: premier.id_razambe_snapshot,
      id_taranaka_snapshot: premier.id_taranaka_snapshot,
      id_sampana_snapshot: premier.id_sampana_snapshot,
      resolution_razambe: premier.resolution_razambe,
    });
  }

  const second = await resolvePersonne(client, foyer.id_personne_2);
  libelles.push(personLabel({ nom: foyer.personne_2_nom, prenom: foyer.personne_2_prenom }));
  if (premier.resolution_razambe !== "RESOLU"
      || second.resolution_razambe !== "RESOLU"
      || premier.id_razambe_snapshot !== second.id_razambe_snapshot) {
    return toResult("FOYER", foyer.id, libelles.join(" / "), unresolved());
  }

  const sameTaranaka = premier.id_taranaka_snapshot
    && premier.id_taranaka_snapshot === second.id_taranaka_snapshot;
  const sameSampana = sameTaranaka
    && premier.id_sampana_snapshot
    && premier.id_sampana_snapshot === second.id_sampana_snapshot;
  return toResult("FOYER", foyer.id, libelles.join(" / "), {
    id_razambe_snapshot: premier.id_razambe_snapshot,
    id_taranaka_snapshot: sameTaranaka ? premier.id_taranaka_snapshot : null,
    id_sampana_snapshot: sameSampana ? premier.id_sampana_snapshot : null,
    resolution_razambe: "RESOLU",
  });
}

/**
 * Résout les instantanés à persister pour une contribution.
 * Le client fourni doit exposer query(sql, params) et peut être le client
 * transactionnel déjà ouvert par l'appelant.
 */
export async function resolveContributeurFandraisanAnjara(typeContributeur, idContributeur, client = database) {
  if (!client || typeof client.query !== "function") throw new TypeError("Un client PostgreSQL avec query() est requis.");
  const normalized = normalizeContributor(typeContributeur, idContributeur);
  if (["RAZAMBE", "TARANAKA", "SAMPANA"].includes(normalized.typeContributeur)) {
    return resolveElement(client, normalized.typeContributeur, normalized.idContributeur);
  }
  if (normalized.typeContributeur === "PERSONNE") return resolvePersonne(client, normalized.idContributeur);
  return resolveFoyer(client, normalized.idContributeur);
}

function contributorReferences(typeContributeur, idContributeur) {
  return {
    id_element_contributeur: ["RAZAMBE", "TARANAKA", "SAMPANA"].includes(typeContributeur) ? idContributeur : null,
    id_foyer_contributeur: typeContributeur === "FOYER" ? idContributeur : null,
    id_personne_contributeur: typeContributeur === "PERSONNE" ? idContributeur : null,
  };
}

/**
 * Crée une contribution et ses lignes dans une transaction unique.
 * Les instantanés sont toujours issus du résolveur serveur.
 */
export async function creerFandraisanAnjara(body, auth) {
  const idCompteCreateur = getCreatorAccount(auth);
  const input = normalizeCreation(body);

  return database.transaction(async () => {
    const contributeur = await resolveContributeurFandraisanAnjara(
      input.type_contributeur,
      input.id_contributeur,
      database,
    );
    const references = contributorReferences(input.type_contributeur, contributeur.id_contributeur);
    const contributionResult = await database.query(
      `INSERT INTO fandraisan_anjara (
        date_contribution, type_contributeur,
        id_element_contributeur, id_foyer_contributeur, id_personne_contributeur,
        contributeur_libelle_snapshot,
        id_razambe_snapshot, id_taranaka_snapshot, id_sampana_snapshot,
        resolution_razambe, observation, id_compte_createur
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, statut, revision`,
      [
        input.date_contribution,
        input.type_contributeur,
        references.id_element_contributeur,
        references.id_foyer_contributeur,
        references.id_personne_contributeur,
        contributeur.contributeur_libelle_snapshot,
        contributeur.id_razambe_snapshot,
        contributeur.id_taranaka_snapshot,
        contributeur.id_sampana_snapshot,
        contributeur.resolution_razambe,
        input.observation,
        idCompteCreateur,
      ],
    );
    const contribution = contributionResult.rows[0];

    for (const ligne of input.lignes) {
      await database.query(
        `INSERT INTO fandraisan_anjara_ligne (
          id_fandraisan_anjara, nature, montant, devise,
          designation, quantite, unite, observation, ordre
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          contribution.id,
          ligne.nature,
          ligne.montant,
          ligne.devise,
          ligne.designation,
          ligne.quantite,
          ligne.unite,
          ligne.observation,
          ligne.ordre,
        ],
      );
    }

    await database.query(
      `INSERT INTO fandraisan_anjara_historique (
        id_fandraisan_anjara, action, donnees_avant, donnees_apres,
        commentaire, id_compte_acteur, revision
      ) VALUES ($1, 'CREATION', NULL, $2::jsonb, NULL, $3, $4)`,
      [
        contribution.id,
        JSON.stringify({
          date_contribution: input.date_contribution,
          type_contributeur: input.type_contributeur,
          id_contributeur: contributeur.id_contributeur,
          contributeur_libelle_snapshot: contributeur.contributeur_libelle_snapshot,
          id_razambe_snapshot: contributeur.id_razambe_snapshot,
          id_taranaka_snapshot: contributeur.id_taranaka_snapshot,
          id_sampana_snapshot: contributeur.id_sampana_snapshot,
          resolution_razambe: contributeur.resolution_razambe,
          observation: input.observation,
          lignes: input.lignes.map(({ ordre, ...ligne }) => ({ ...ligne, ordre })),
        }),
        idCompteCreateur,
        contribution.revision,
      ],
    );

    return {
      contribution: {
        id: contribution.id,
        statut: contribution.statut,
        revision: contribution.revision,
      },
    };
  });
}

function assertReader(auth) {
  if (!auth?.compte?.id) throw businessError("Authentification requise.", "AUTH_REQUIRED");
}

function normalizeQueryDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw businessError(`${label} est invalide.`, "FANDRAISAN_ANJARA_INVALID");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw businessError(`${label} est invalide.`, "FANDRAISAN_ANJARA_INVALID");
  }
  return value;
}

function normalizePositiveQueryInteger(value, label, { defaultValue, max }) {
  if (value === undefined) return defaultValue;
  if (typeof value !== "string" || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
    throw businessError(`${label} est invalide.`, "FANDRAISAN_ANJARA_INVALID");
  }
  return Number(value);
}

function normalizeListFilters(query = {}) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    throw businessError("Paramètres de consultation invalides.", "FANDRAISAN_ANJARA_INVALID");
  }
  const allowed = new Set(["date_debut", "date_fin", "id_razambe", "statut", "non_determine", "page", "limit"]);
  if (Object.keys(query).some((key) => !allowed.has(key))) {
    throw businessError("Paramètres de consultation invalides.", "FANDRAISAN_ANJARA_INVALID");
  }
  for (const value of Object.values(query)) {
    if (Array.isArray(value)) throw businessError("Paramètres de consultation invalides.", "FANDRAISAN_ANJARA_INVALID");
  }
  const dateDebut = query.date_debut === undefined ? null : normalizeQueryDate(query.date_debut, "date_debut");
  const dateFin = query.date_fin === undefined ? null : normalizeQueryDate(query.date_fin, "date_fin");
  if (dateDebut && dateFin && dateFin < dateDebut) {
    throw businessError("La période de consultation est invalide.", "FANDRAISAN_ANJARA_INVALID");
  }
  let idRazambe = null;
  if (query.id_razambe !== undefined) {
    if (typeof query.id_razambe !== "string" || !UUID_PATTERN.test(query.id_razambe)) {
      throw businessError("id_razambe est invalide.", "FANDRAISAN_ANJARA_INVALID");
    }
    idRazambe = query.id_razambe.toLowerCase();
  }
  let nonDetermine = false;
  if (query.non_determine !== undefined) {
    if (query.non_determine !== "true" && query.non_determine !== "false") {
      throw businessError("non_determine est invalide.", "FANDRAISAN_ANJARA_INVALID");
    }
    nonDetermine = query.non_determine === "true";
  }
  if (idRazambe && nonDetermine) {
    throw businessError("Les filtres Razambe sont incompatibles.", "FANDRAISAN_ANJARA_INVALID");
  }
  let statut = null;
  if (query.statut !== undefined) {
    if (!['ACTIF', 'ANNULE'].includes(query.statut)) {
      throw businessError("statut est invalide.", "FANDRAISAN_ANJARA_INVALID");
    }
    statut = query.statut;
  }
  const page = normalizePositiveQueryInteger(query.page, "page", { defaultValue: 1, max: 100000 });
  const limit = normalizePositiveQueryInteger(query.limit, "limit", { defaultValue: 20, max: 100 });
  return { dateDebut, dateFin, idRazambe, nonDetermine, statut, page, limit };
}

function contributorIdFromRow(row) {
  if (["RAZAMBE", "TARANAKA", "SAMPANA"].includes(row.type_contributeur)) return row.id_element_contributeur;
  if (row.type_contributeur === "FOYER") return row.id_foyer_contributeur;
  return row.id_personne_contributeur;
}

function mapListRow(row) {
  return {
    id: row.id,
    date_contribution: row.date_contribution,
    contributeur: {
      type: row.type_contributeur,
      id: contributorIdFromRow(row),
      libelle_snapshot: row.contributeur_libelle_snapshot,
    },
    rattachements_historiques: {
      id_razambe: row.id_razambe_snapshot,
      resolution_razambe: row.resolution_razambe,
    },
    statut: row.statut,
    revision: row.revision,
    total_argent_mga: row.total_argent_mga,
    materiels: Array.isArray(row.materiels) ? row.materiels : [],
  };
}

function listWhereClause(filters) {
  const conditions = [];
  const params = [];
  const add = (sql, value) => { params.push(value); conditions.push(sql.replace("?", `$${params.length}`)); };
  if (filters.dateDebut) add("f.date_contribution >= ?", filters.dateDebut);
  if (filters.dateFin) add("f.date_contribution <= ?", filters.dateFin);
  if (filters.idRazambe) add("f.id_razambe_snapshot = ?", filters.idRazambe);
  if (filters.nonDetermine) conditions.push("f.resolution_razambe = 'NON_DETERMINE'");
  if (filters.statut) add("f.statut = ?", filters.statut);
  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

export async function getFandraisanAnjaraList(query, auth) {
  assertReader(auth);
  const filters = normalizeListFilters(query);
  const { where, params } = listWhereClause(filters);
  const countResult = await database.query(
    `SELECT COUNT(*)::integer AS total FROM fandraisan_anjara f ${where}`,
    params,
  );
  const total = countResult.rows[0]?.total ?? 0;
  const listParams = [...params, filters.limit, (filters.page - 1) * filters.limit];
  const result = await database.query(
    `SELECT
      f.id, to_char(f.date_contribution, 'YYYY-MM-DD') AS date_contribution,
      f.type_contributeur, f.id_element_contributeur, f.id_foyer_contributeur,
      f.id_personne_contributeur, f.contributeur_libelle_snapshot,
      f.id_razambe_snapshot, f.resolution_razambe, f.statut, f.revision,
      COALESCE((
        SELECT SUM(l.montant)::text
        FROM fandraisan_anjara_ligne l
        WHERE l.id_fandraisan_anjara = f.id AND l.nature = 'ARGENT'
      ), '0') AS total_argent_mga,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'designation', materiel.designation,
          'unite', materiel.unite,
          'quantite', materiel.quantite
        ) ORDER BY materiel.designation, materiel.unite)
        FROM (
          SELECT l.designation, l.unite, SUM(l.quantite)::text AS quantite
          FROM fandraisan_anjara_ligne l
          WHERE l.id_fandraisan_anjara = f.id AND l.nature = 'MATERIEL'
          GROUP BY l.designation, l.unite
        ) materiel
      ), '[]'::jsonb) AS materiels
    FROM fandraisan_anjara f
    ${where}
    ORDER BY f.date_contribution DESC, f.id DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    listParams,
  );
  return {
    contributions: result.rows.map(mapListRow),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      total_pages: Math.ceil(total / filters.limit),
    },
  };
}

export async function getFandraisanAnjaraById(idContribution, auth) {
  assertReader(auth);
  if (typeof idContribution !== "string" || !UUID_PATTERN.test(idContribution)) {
    throw businessError("Identifiant de contribution invalide.", "FANDRAISAN_ANJARA_INVALID");
  }
  const headerResult = await database.query(
    `SELECT
      f.id, to_char(f.date_contribution, 'YYYY-MM-DD') AS date_contribution,
      f.type_contributeur, f.id_element_contributeur, f.id_foyer_contributeur,
      f.id_personne_contributeur, f.contributeur_libelle_snapshot,
      f.id_razambe_snapshot, f.id_taranaka_snapshot, f.id_sampana_snapshot,
      f.resolution_razambe, f.observation, f.statut, f.revision
    FROM fandraisan_anjara f
    WHERE f.id = $1`,
    [idContribution.toLowerCase()],
  );
  const header = headerResult.rows[0];
  if (!header) throw businessError("Contribution introuvable.", "FANDRAISAN_ANJARA_NOT_FOUND");
  const linesResult = await database.query(
    `SELECT nature, montant::text AS montant, devise, designation,
      quantite::text AS quantite, unite, observation, ordre
    FROM fandraisan_anjara_ligne
    WHERE id_fandraisan_anjara = $1
    ORDER BY ordre ASC`,
    [header.id],
  );
  const lignes = linesResult.rows.map((ligne) => ({
    nature: ligne.nature,
    montant: ligne.montant,
    devise: ligne.devise,
    designation: ligne.designation,
    quantite: ligne.quantite,
    unite: ligne.unite,
    observation: ligne.observation,
    ordre: ligne.ordre,
  }));
  const totalArgentMGA = lignes
    .filter((ligne) => ligne.nature === "ARGENT")
    .reduce((total, ligne) => (BigInt(total) + BigInt(ligne.montant)).toString(), "0");
  return {
    id: header.id,
    date_contribution: header.date_contribution,
    contributeur: {
      type: header.type_contributeur,
      id: contributorIdFromRow(header),
      libelle_snapshot: header.contributeur_libelle_snapshot,
    },
    rattachements_historiques: {
      id_razambe: header.id_razambe_snapshot,
      id_taranaka: header.id_taranaka_snapshot,
      id_sampana: header.id_sampana_snapshot,
      resolution_razambe: header.resolution_razambe,
    },
    observation: header.observation,
    statut: header.statut,
    revision: header.revision,
    lignes,
    total_argent_mga: totalArgentMGA,
  };
}

function normalizeStatisticsDateFilters(query = {}) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    throw businessError("Paramètres de statistiques invalides.", "FANDRAISAN_ANJARA_INVALID");
  }
  const allowed = new Set(["date_debut", "date_fin"]);
  if (Object.keys(query).some((key) => !allowed.has(key)) || Object.values(query).some(Array.isArray)) {
    throw businessError("Paramètres de statistiques invalides.", "FANDRAISAN_ANJARA_INVALID");
  }
  const dateDebut = query.date_debut === undefined ? null : normalizeQueryDate(query.date_debut, "date_debut");
  const dateFin = query.date_fin === undefined ? null : normalizeQueryDate(query.date_fin, "date_fin");
  if (dateDebut && dateFin && dateFin < dateDebut) {
    throw businessError("La période de statistiques est invalide.", "FANDRAISAN_ANJARA_INVALID");
  }
  return { dateDebut, dateFin };
}

function activeDateWhere(filters, alias = "f") {
  const conditions = [`${alias}.statut = 'ACTIF'`];
  const params = [];
  if (filters.dateDebut) { params.push(filters.dateDebut); conditions.push(`${alias}.date_contribution >= $${params.length}`); }
  if (filters.dateFin) { params.push(filters.dateFin); conditions.push(`${alias}.date_contribution <= $${params.length}`); }
  return { where: `WHERE ${conditions.join(" AND ")}`, params };
}

async function getMaterialSummary(filters) {
  const { where, params } = activeDateWhere(filters);
  const result = await database.query(
    `SELECT l.designation, l.unite, SUM(l.quantite)::text AS quantite
    FROM fandraisan_anjara_ligne l
    JOIN fandraisan_anjara f ON f.id = l.id_fandraisan_anjara
    ${where} AND l.nature = 'MATERIEL'
    GROUP BY l.designation, l.unite
    ORDER BY l.designation ASC, l.unite ASC`,
    params,
  );
  return result.rows.map((row) => ({ designation: row.designation, unite: row.unite, quantite: row.quantite }));
}

export async function getFandraisanAnjaraStatistiques(query, auth) {
  assertReader(auth);
  const filters = normalizeStatisticsDateFilters(query);
  const { where, params } = activeDateWhere(filters);
  const result = await database.query(
    `SELECT
      COUNT(*)::integer AS nombre_contributions_actives,
      COUNT(DISTINCT (
        f.type_contributeur || ':' || COALESCE(
          f.id_element_contributeur::text,
          f.id_foyer_contributeur::text,
          f.id_personne_contributeur::text
        )
      ))::integer AS nombre_contributeurs_distincts,
      COUNT(DISTINCT f.id_razambe_snapshot)::integer AS nombre_razambe_representes,
      COUNT(*) FILTER (WHERE f.resolution_razambe = 'NON_DETERMINE')::integer
        AS nombre_contributions_non_determinees,
      COALESCE((
        SELECT SUM(l.montant)::text
        FROM fandraisan_anjara_ligne l
        JOIN fandraisan_anjara fa ON fa.id = l.id_fandraisan_anjara
        ${where.replaceAll("f.", "fa.")} AND l.nature = 'ARGENT'
      ), '0') AS total_argent_mga
    FROM fandraisan_anjara f
    ${where}`,
    params,
  );
  const row = result.rows[0] ?? {
    nombre_contributions_actives: 0,
    nombre_contributeurs_distincts: 0,
    nombre_razambe_representes: 0,
    nombre_contributions_non_determinees: 0,
    total_argent_mga: "0",
  };
  return {
    total_argent_mga: row.total_argent_mga,
    nombre_contributions_actives: row.nombre_contributions_actives,
    nombre_contributeurs_distincts: row.nombre_contributeurs_distincts,
    nombre_razambe_representes: row.nombre_razambe_representes,
    nombre_contributions_non_determinees: row.nombre_contributions_non_determinees,
    materiels: await getMaterialSummary(filters),
  };
}

function mapRazambeSummary(row) {
  return {
    id_razambe: row.id_razambe_snapshot,
    nom_razambe_actuel: row.nom_razambe_actuel ?? null,
    total_argent_mga: row.total_argent_mga,
    nombre_contributions: row.nombre_contributions,
    nombre_contributeurs_distincts: row.nombre_contributeurs_distincts,
    materiels: Array.isArray(row.materiels) ? row.materiels : [],
  };
}

export async function getFandraisanAnjaraParRazambe(query, auth) {
  assertReader(auth);
  const filters = normalizeStatisticsDateFilters(query);
  const { where, params } = activeDateWhere(filters);
  const result = await database.query(
    `WITH filtered AS (
      SELECT * FROM fandraisan_anjara f ${where}
    ), groups AS (
      SELECT
        id_razambe_snapshot,
        resolution_razambe,
        COUNT(*)::integer AS nombre_contributions,
        COUNT(DISTINCT (
          type_contributeur || ':' || COALESCE(
            id_element_contributeur::text, id_foyer_contributeur::text, id_personne_contributeur::text
          )
        ))::integer AS nombre_contributeurs_distincts
      FROM filtered
      GROUP BY id_razambe_snapshot, resolution_razambe
    )
    SELECT
      g.id_razambe_snapshot, g.resolution_razambe, g.nombre_contributions,
      g.nombre_contributeurs_distincts, e.nom AS nom_razambe_actuel,
      COALESCE((
        SELECT SUM(l.montant)::text
        FROM fandraisan_anjara_ligne l
        JOIN filtered f ON f.id = l.id_fandraisan_anjara
        WHERE l.nature = 'ARGENT'
          AND f.id_razambe_snapshot IS NOT DISTINCT FROM g.id_razambe_snapshot
          AND f.resolution_razambe = g.resolution_razambe
      ), '0') AS total_argent_mga,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'designation', materiel.designation,
          'unite', materiel.unite,
          'quantite', materiel.quantite
        ) ORDER BY materiel.designation, materiel.unite)
        FROM (
          SELECT l.designation, l.unite, SUM(l.quantite)::text AS quantite
          FROM fandraisan_anjara_ligne l
          JOIN filtered f ON f.id = l.id_fandraisan_anjara
          WHERE l.nature = 'MATERIEL'
            AND f.id_razambe_snapshot IS NOT DISTINCT FROM g.id_razambe_snapshot
            AND f.resolution_razambe = g.resolution_razambe
          GROUP BY l.designation, l.unite
        ) materiel
      ), '[]'::jsonb) AS materiels
    FROM groups g
    LEFT JOIN element e ON e.id = g.id_razambe_snapshot
    ORDER BY (g.resolution_razambe = 'NON_DETERMINE') ASC, e.nom ASC NULLS LAST, g.id_razambe_snapshot ASC`,
    params,
  );
  const resolved = result.rows
    .filter((row) => row.resolution_razambe === "RESOLU")
    .map(mapRazambeSummary);
  const nonDetermineRow = result.rows.find((row) => row.resolution_razambe === "NON_DETERMINE");
  return {
    razambe: resolved,
    non_determine: nonDetermineRow ? mapRazambeSummary(nonDetermineRow) : null,
  };
}

function addMaterial(materials, ligne) {
  if (ligne.nature !== "MATERIEL") return;
  const key = `${ligne.designation}\u0000${ligne.unite}`;
  const current = materials.get(key) ?? { designation: ligne.designation, unite: ligne.unite, millièmes: 0n };
  const [integer, fraction = ""] = String(ligne.quantite).split(".");
  const millièmes = BigInt(integer) * 1000n + BigInt((fraction + "000").slice(0, 3));
  current.millièmes += millièmes;
  materials.set(key, current);
}

function materialSummaryFromMap(materials) {
  return [...materials.values()]
    .sort((a, b) => a.designation.localeCompare(b.designation) || a.unite.localeCompare(b.unite))
    .map((material) => {
      const integer = material.millièmes / 1000n;
      const fraction = (material.millièmes % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
      return { designation: material.designation, unite: material.unite, quantite: fraction ? `${integer}.${fraction}` : integer.toString() };
    });
}

async function getRazambeDetail(idRazambe, filters, nonDetermine) {
  const { where, params } = activeDateWhere(filters);
  const groupCondition = nonDetermine
    ? "f.resolution_razambe = 'NON_DETERMINE'"
    : `f.id_razambe_snapshot = $${params.length + 1} AND f.resolution_razambe = 'RESOLU'`;
  const result = await database.query(
    `SELECT
      f.id, to_char(f.date_contribution, 'YYYY-MM-DD') AS date_contribution,
      f.type_contributeur, f.id_element_contributeur, f.id_foyer_contributeur, f.id_personne_contributeur,
      f.contributeur_libelle_snapshot, f.id_razambe_snapshot, f.id_taranaka_snapshot, f.id_sampana_snapshot,
      f.resolution_razambe, f.observation, f.statut, f.revision
    FROM fandraisan_anjara f
    ${where} AND ${groupCondition}
    ORDER BY f.date_contribution DESC, f.id DESC`,
    nonDetermine ? params : [...params, idRazambe],
  );
  const contributions = result.rows.map((row) => ({
    id: row.id,
    date_contribution: row.date_contribution,
    contributeur: { type: row.type_contributeur, id: contributorIdFromRow(row), libelle_snapshot: row.contributeur_libelle_snapshot },
    rattachements_historiques: {
      id_razambe: row.id_razambe_snapshot,
      id_taranaka: row.id_taranaka_snapshot,
      id_sampana: row.id_sampana_snapshot,
      resolution_razambe: row.resolution_razambe,
    },
    observation: row.observation,
    statut: row.statut,
    revision: row.revision,
    lignes: [],
    total_argent_mga: "0",
  }));
  if (!contributions.length) return { contributions, lignes: [] };
  const ids = contributions.map((contribution) => contribution.id);
  const linesResult = await database.query(
    `SELECT id_fandraisan_anjara, nature, montant::text AS montant, devise,
      designation, quantite::text AS quantite, unite, observation, ordre
    FROM fandraisan_anjara_ligne
    WHERE id_fandraisan_anjara = ANY($1::uuid[])
    ORDER BY id_fandraisan_anjara ASC, ordre ASC`,
    [ids],
  );
  const byContribution = new Map(contributions.map((contribution) => [contribution.id, contribution]));
  for (const ligne of linesResult.rows) {
    const contribution = byContribution.get(ligne.id_fandraisan_anjara);
    if (!contribution) continue;
    const line = {
      nature: ligne.nature, montant: ligne.montant, devise: ligne.devise,
      designation: ligne.designation, quantite: ligne.quantite, unite: ligne.unite,
      observation: ligne.observation, ordre: ligne.ordre,
    };
    contribution.lignes.push(line);
    if (line.nature === "ARGENT") contribution.total_argent_mga = (BigInt(contribution.total_argent_mga) + BigInt(line.montant)).toString();
  }
  return { contributions, lignes: linesResult.rows };
}

function groupDetailByDate(contributions) {
  const dates = new Map();
  const materials = new Map();
  let totalArgentMGA = 0n;
  for (const contribution of contributions) {
    const group = dates.get(contribution.date_contribution) ?? {
      date_contribution: contribution.date_contribution,
      contributions: [],
      total_argent_mga: "0",
      materiels: new Map(),
    };
    group.contributions.push(contribution);
    group.total_argent_mga = (BigInt(group.total_argent_mga) + BigInt(contribution.total_argent_mga)).toString();
    totalArgentMGA += BigInt(contribution.total_argent_mga);
    for (const ligne of contribution.lignes) {
      addMaterial(group.materiels, ligne);
      addMaterial(materials, ligne);
    }
    dates.set(contribution.date_contribution, group);
  }
  return {
    contributions_par_date: [...dates.values()].map((group) => ({
      ...group,
      materiels: materialSummaryFromMap(group.materiels),
    })),
    total_argent_mga: totalArgentMGA.toString(),
    materiels: materialSummaryFromMap(materials),
  };
}

export async function getFandraisanAnjaraDetailRazambe(idRazambe, query, auth, { nonDetermine = false } = {}) {
  assertReader(auth);
  if (!nonDetermine && (typeof idRazambe !== "string" || !UUID_PATTERN.test(idRazambe))) {
    throw businessError("Identifiant Razambe invalide.", "FANDRAISAN_ANJARA_INVALID");
  }
  const filters = normalizeStatisticsDateFilters(query);
  const { contributions } = await getRazambeDetail(nonDetermine ? null : idRazambe.toLowerCase(), filters, nonDetermine);
  const grouped = groupDetailByDate(contributions);
  return {
    groupe: nonDetermine ? "NON_DETERMINE" : "RAZAMBE",
    id_razambe: nonDetermine ? null : idRazambe.toLowerCase(),
    ...grouped,
  };
}

function normalizeExpectedRevision(value) {
  let revision;
  if (typeof value === "number" && Number.isSafeInteger(value)) revision = value;
  else if (typeof value === "string" && /^\d+$/.test(value.trim())) revision = Number(value.trim());
  else throw businessError("La révision attendue est invalide.", "FANDRAISAN_ANJARA_INVALID");
  if (revision < 1 || revision > 2147483647) {
    throw businessError("La révision attendue est invalide.", "FANDRAISAN_ANJARA_INVALID");
  }
  return revision;
}

function normalizeReason(value, label) {
  const reason = normalizeText(value, label, 100000, { required: true });
  if (!reason) throw businessError(`${label} est obligatoire.`, "FANDRAISAN_ANJARA_INVALID");
  return reason;
}

function normalizeCorrection(body) {
  assertPlainObject(body, "Données de correction invalides.");
  const allowed = new Set([
    "revision", "motif_correction", "date_contribution",
    "type_contributeur", "id_contributeur", "observation", "lignes",
  ]);
  assertAllowedFields(body, allowed, "Un champ de correction n'est pas autorisé.");
  const hasType = Object.hasOwn(body, "type_contributeur");
  const hasContributorId = Object.hasOwn(body, "id_contributeur");
  if (hasType !== hasContributorId) {
    throw businessError("Le type et l'identifiant du contributeur doivent être fournis ensemble.", "FANDRAISAN_ANJARA_INVALID");
  }
  const hasMutableField = ["date_contribution", "observation", "lignes"].some((field) => Object.hasOwn(body, field)) || hasType;
  if (!hasMutableField) throw businessError("Aucune correction n'est fournie.", "FANDRAISAN_ANJARA_INVALID");
  let contributeur = null;
  if (hasType) {
    const type = typeof body.type_contributeur === "string" ? body.type_contributeur.trim().toUpperCase() : "";
    const normalized = normalizeContributor(type, body.id_contributeur);
    contributeur = { type_contributeur: normalized.typeContributeur, id_contributeur: normalized.idContributeur };
  }
  return {
    revision: normalizeExpectedRevision(body.revision),
    motif_correction: normalizeReason(body.motif_correction, "Le motif de correction"),
    date_contribution: Object.hasOwn(body, "date_contribution") ? normalizeContributionDate(body.date_contribution) : undefined,
    observation: Object.hasOwn(body, "observation") ? normalizeText(body.observation, "Observation", 100000) : undefined,
    lignes: Object.hasOwn(body, "lignes") ? normalizeLines(body.lignes) : undefined,
    contributeur,
  };
}

function normalizeCancellation(body) {
  assertPlainObject(body, "Données d'annulation invalides.");
  assertAllowedFields(body, new Set(["revision", "motif_annulation"]), "Un champ d'annulation n'est pas autorisé.");
  return {
    revision: normalizeExpectedRevision(body.revision),
    motif_annulation: normalizeReason(body.motif_annulation, "Le motif d'annulation"),
  };
}

function mapStoredLine(row) {
  return {
    nature: row.nature,
    montant: row.montant === null ? null : String(row.montant),
    devise: row.devise,
    designation: row.designation,
    quantite: row.quantite === null ? null : String(row.quantite),
    unite: row.unite,
    observation: row.observation,
    ordre: row.ordre,
  };
}

async function getContributionForUpdate(idContribution) {
  const headerResult = await database.query(
    `SELECT
      f.id, to_char(f.date_contribution, 'YYYY-MM-DD') AS date_contribution,
      f.type_contributeur, f.id_element_contributeur, f.id_foyer_contributeur, f.id_personne_contributeur,
      f.contributeur_libelle_snapshot, f.id_razambe_snapshot, f.id_taranaka_snapshot, f.id_sampana_snapshot,
      f.resolution_razambe, f.observation, f.statut, f.revision,
      f.id_compte_modificateur, f.id_compte_annulateur, f.date_annulation, f.motif_annulation
    FROM fandraisan_anjara f
    WHERE f.id = $1
    FOR UPDATE`,
    [idContribution],
  );
  const header = headerResult.rows[0];
  if (!header) throw businessError("Contribution introuvable.", "FANDRAISAN_ANJARA_NOT_FOUND");
  const linesResult = await database.query(
    `SELECT nature, montant::text AS montant, devise, designation,
      quantite::text AS quantite, unite, observation, ordre
    FROM fandraisan_anjara_ligne
    WHERE id_fandraisan_anjara = $1
    ORDER BY ordre ASC`,
    [header.id],
  );
  return { ...header, lignes: linesResult.rows.map(mapStoredLine) };
}

function contributionSnapshot(contribution) {
  return {
    id: contribution.id,
    date_contribution: contribution.date_contribution,
    type_contributeur: contribution.type_contributeur,
    id_contributeur: contributorIdFromRow(contribution),
    contributeur_libelle_snapshot: contribution.contributeur_libelle_snapshot,
    id_razambe_snapshot: contribution.id_razambe_snapshot,
    id_taranaka_snapshot: contribution.id_taranaka_snapshot,
    id_sampana_snapshot: contribution.id_sampana_snapshot,
    resolution_razambe: contribution.resolution_razambe,
    observation: contribution.observation,
    statut: contribution.statut,
    revision: contribution.revision,
    id_compte_modificateur: contribution.id_compte_modificateur ?? null,
    id_compte_annulateur: contribution.id_compte_annulateur ?? null,
    date_annulation: contribution.date_annulation ?? null,
    motif_annulation: contribution.motif_annulation ?? null,
    lignes: contribution.lignes.map(mapStoredLine),
  };
}

async function replaceContributionLines(idContribution, lignes) {
  await database.query("DELETE FROM fandraisan_anjara_ligne WHERE id_fandraisan_anjara = $1", [idContribution]);
  for (const ligne of lignes) {
    await database.query(
      `INSERT INTO fandraisan_anjara_ligne (
        id_fandraisan_anjara, nature, montant, devise,
        designation, quantite, unite, observation, ordre
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [idContribution, ligne.nature, ligne.montant, ligne.devise, ligne.designation, ligne.quantite, ligne.unite, ligne.observation, ligne.ordre],
    );
  }
}

function assertActiveAndRevision(current, revision) {
  if (current.revision !== revision) {
    throw businessError("La contribution a été modifiée par un autre utilisateur.", "FANDRAISAN_ANJARA_REVISION_CONFLICT");
  }
  if (current.statut !== "ACTIF") {
    throw businessError("Une contribution annulée ne peut pas être modifiée.", "FANDRAISAN_ANJARA_STATE_INVALID");
  }
}

async function addContributionHistory(idContribution, action, before, after, commentaire, idCompteActeur, revision) {
  await database.query(
    `INSERT INTO fandraisan_anjara_historique (
      id_fandraisan_anjara, action, donnees_avant, donnees_apres,
      commentaire, id_compte_acteur, revision
    ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)`,
    [idContribution, action, JSON.stringify(before), JSON.stringify(after), commentaire, idCompteActeur, revision],
  );
}

export async function corrigerFandraisanAnjara(idContribution, body, auth) {
  const idCompteActeur = getCreatorAccount(auth);
  if (typeof idContribution !== "string" || !UUID_PATTERN.test(idContribution)) {
    throw businessError("Identifiant de contribution invalide.", "FANDRAISAN_ANJARA_INVALID");
  }
  const patch = normalizeCorrection(body);
  return database.transaction(async () => {
    const current = await getContributionForUpdate(idContribution.toLowerCase());
    assertActiveAndRevision(current, patch.revision);
    const currentContributorId = contributorIdFromRow(current);
    const contributorChanged = patch.contributeur
      && (patch.contributeur.type_contributeur !== current.type_contributeur || patch.contributeur.id_contributeur !== currentContributorId);
    let nextContributor = {
      type_contributeur: current.type_contributeur,
      id_contributeur: currentContributorId,
      contributeur_libelle_snapshot: current.contributeur_libelle_snapshot,
      id_razambe_snapshot: current.id_razambe_snapshot,
      id_taranaka_snapshot: current.id_taranaka_snapshot,
      id_sampana_snapshot: current.id_sampana_snapshot,
      resolution_razambe: current.resolution_razambe,
    };
    if (contributorChanged) {
      const resolved = await resolveContributeurFandraisanAnjara(
        patch.contributeur.type_contributeur,
        patch.contributeur.id_contributeur,
        database,
      );
      nextContributor = {
        type_contributeur: resolved.type_contributeur,
        id_contributeur: resolved.id_contributeur,
        contributeur_libelle_snapshot: resolved.contributeur_libelle_snapshot,
        id_razambe_snapshot: resolved.id_razambe_snapshot,
        id_taranaka_snapshot: resolved.id_taranaka_snapshot,
        id_sampana_snapshot: resolved.id_sampana_snapshot,
        resolution_razambe: resolved.resolution_razambe,
      };
    }
    const nextLines = patch.lignes ?? current.lignes;
    if (!nextLines.length) throw businessError("Au moins une ligne de contribution est obligatoire.", "FANDRAISAN_ANJARA_INVALID");
    const nextDate = patch.date_contribution ?? current.date_contribution;
    const nextObservation = patch.observation === undefined ? current.observation : patch.observation;
    const before = contributionSnapshot(current);
    const references = contributorReferences(nextContributor.type_contributeur, nextContributor.id_contributeur);
    const updatedResult = await database.query(
      `UPDATE fandraisan_anjara SET
        date_contribution = $1, type_contributeur = $2,
        id_element_contributeur = $3, id_foyer_contributeur = $4, id_personne_contributeur = $5,
        contributeur_libelle_snapshot = $6,
        id_razambe_snapshot = $7, id_taranaka_snapshot = $8, id_sampana_snapshot = $9,
        resolution_razambe = $10, observation = $11,
        id_compte_modificateur = $12,
        date_modification = GREATEST(clock_timestamp(), date_modification + interval '1 microsecond'),
        revision = revision + 1
      WHERE id = $13
      RETURNING id, statut, revision`,
      [
        nextDate, nextContributor.type_contributeur,
        references.id_element_contributeur, references.id_foyer_contributeur, references.id_personne_contributeur,
        nextContributor.contributeur_libelle_snapshot,
        nextContributor.id_razambe_snapshot, nextContributor.id_taranaka_snapshot, nextContributor.id_sampana_snapshot,
        nextContributor.resolution_razambe, nextObservation, idCompteActeur, current.id,
      ],
    );
    if (patch.lignes) await replaceContributionLines(current.id, nextLines);
    const updated = updatedResult.rows[0];
    const after = contributionSnapshot({
      ...current,
      id: updated.id,
      date_contribution: nextDate,
      ...nextContributor,
      ...references,
      observation: nextObservation,
      revision: updated.revision,
      id_compte_modificateur: idCompteActeur,
      lignes: nextLines,
    });
    await addContributionHistory(current.id, "CORRECTION", before, after, patch.motif_correction, idCompteActeur, updated.revision);
    return { contribution: { id: updated.id, statut: updated.statut, revision: updated.revision } };
  });
}

export async function annulerFandraisanAnjara(idContribution, body, auth) {
  const idCompteActeur = getCreatorAccount(auth);
  if (typeof idContribution !== "string" || !UUID_PATTERN.test(idContribution)) {
    throw businessError("Identifiant de contribution invalide.", "FANDRAISAN_ANJARA_INVALID");
  }
  const input = normalizeCancellation(body);
  return database.transaction(async () => {
    const current = await getContributionForUpdate(idContribution.toLowerCase());
    assertActiveAndRevision(current, input.revision);
    const before = contributionSnapshot(current);
    const updatedResult = await database.query(
      `UPDATE fandraisan_anjara SET
        statut = 'ANNULE', id_compte_annulateur = $1,
        date_annulation = clock_timestamp(), motif_annulation = $2,
        date_modification = GREATEST(clock_timestamp(), date_modification + interval '1 microsecond'),
        revision = revision + 1
      WHERE id = $3
      RETURNING id, statut, revision, date_annulation`,
      [idCompteActeur, input.motif_annulation, current.id],
    );
    const updated = updatedResult.rows[0];
    const after = contributionSnapshot({
      ...current,
      id: updated.id,
      statut: updated.statut,
      revision: updated.revision,
      id_compte_annulateur: idCompteActeur,
      date_annulation: updated.date_annulation,
      motif_annulation: input.motif_annulation,
    });
    await addContributionHistory(current.id, "ANNULATION", before, after, input.motif_annulation, idCompteActeur, updated.revision);
    return { contribution: { id: updated.id, statut: updated.statut, revision: updated.revision } };
  });
}

export async function getFandraisanAnjaraHistorique(idContribution, auth) {
  getCreatorAccount(auth);
  if (typeof idContribution !== "string" || !UUID_PATTERN.test(idContribution)) {
    throw businessError("Identifiant de contribution invalide.", "FANDRAISAN_ANJARA_INVALID");
  }
  const contributionResult = await database.query("SELECT id FROM fandraisan_anjara WHERE id = $1", [idContribution.toLowerCase()]);
  if (!contributionResult.rows[0]) throw businessError("Contribution introuvable.", "FANDRAISAN_ANJARA_NOT_FOUND");
  const result = await database.query(
    `SELECT action, revision, date_action, id_compte_acteur, commentaire, donnees_avant, donnees_apres
    FROM fandraisan_anjara_historique
    WHERE id_fandraisan_anjara = $1
    ORDER BY date_action ASC, id ASC`,
    [idContribution.toLowerCase()],
  );
  return {
    historique: result.rows.map((row) => ({
      action: row.action,
      revision: row.revision,
      date_action: row.date_action,
      acteur: { id_compte: row.id_compte_acteur },
      commentaire: row.commentaire,
      donnees_avant: row.donnees_avant,
      donnees_apres: row.donnees_apres,
    })),
  };
}
