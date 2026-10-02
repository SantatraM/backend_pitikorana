import database from "../config/db.js";
import Don from "../models/Don.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function normalizeUuid(value, code, message) {
  if (!isUuid(value)) throw businessError(message, code);
  return value.toLowerCase();
}

function warningsForSnapshots(idTaranakaSnapshot) {
  return idTaranakaSnapshot
    ? []
    : [{ code: "TARANAKA_NOT_DETERMINED", message: "Rattachement Taranaka non déterminé — le don ne sera pas attribué aux statistiques d'une branche." }];
}

async function getJourneeForWrite(idJournee) {
  const result = await database.query(
    `SELECT id, statut FROM journee_alahadin_taranaka WHERE id = $1 FOR UPDATE`,
    [idJournee],
  );
  const journee = result.rows[0];
  if (!journee) throw businessError("Journée introuvable.", "DON_JOURNEE_NOT_FOUND");
  if (journee.statut !== "OUVERTE") {
    throw businessError("La journée doit être ouverte pour gérer les dons.", "DON_JOURNEE_NOT_OPEN");
  }
  return journee;
}

async function assertJourneeExists(idJournee) {
  const result = await database.query(
    `SELECT id FROM journee_alahadin_taranaka WHERE id = $1`,
    [idJournee],
  );
  if (!result.rows[0]) throw businessError("Journée introuvable.", "DON_JOURNEE_NOT_FOUND");
}

async function isTaranakaAllowed(idJournee, idTaranaka) {
  const result = await database.query(
    `SELECT 1 FROM journee_alahadin_taranaka_taranaka WHERE id_journee = $1 AND id_taranaka = $2`,
    [idJournee, idTaranaka],
  );
  return result.rowCount > 0;
}

async function assertEligibleForJournee(idJournee, idTaranakaSnapshot) {
  if (!idTaranakaSnapshot) return;
  if (!(await isTaranakaAllowed(idJournee, idTaranakaSnapshot))) {
    throw businessError("Le Taranaka résolu n'est pas associé à cette journée.", "DON_TARANAKA_NOT_ALLOWED");
  }
}

async function getElement(id) {
  const result = await database.query(
    `
      SELECT e.id, e.nom, e.rattachement_sup, te.code
      FROM element e
      JOIN type_element te ON te.id = e.id_type_element
      WHERE e.id = $1
    `,
    [id],
  );
  return result.rows[0] ?? null;
}

async function getTaranakaForElement(idElement) {
  const result = await database.query(
    `SELECT id_taranaka, id_sampana FROM v_element_hierarchie WHERE id_element = $1`,
    [idElement],
  );
  return result.rows[0] ?? { id_taranaka: null, id_sampana: null };
}

async function resolveElementDonateur(idDonateur, expectedCode) {
  const element = await getElement(idDonateur);
  if (!element) throw businessError("Élément donateur introuvable.", "DON_ELEMENT_NOT_FOUND");
  if (element.code !== expectedCode) {
    throw businessError("L'élément ne correspond pas au type de donateur demandé.", "DON_DONATEUR_INVALID");
  }
  return element;
}

async function resolvePersonneRattachement(idPersonne) {
  const result = await database.query(
    `
      SELECT
        p.id,
        p.nom,
        p.prenom,
        p.id_element,
        veh.id_taranaka,
        veh.id_sampana
      FROM personne p
      LEFT JOIN v_element_hierarchie veh ON veh.id_element = p.id_element
      WHERE p.id = $1
    `,
    [idPersonne],
  );
  const personne = result.rows[0];
  if (!personne) throw businessError("Personne donatrice introuvable.", "DON_PERSONNE_NOT_FOUND");
  return {
    id: personne.id,
    nom: personne.nom,
    prenom: personne.prenom,
    id_taranaka_snapshot: personne.id_taranaka ?? null,
    id_sampana_snapshot: personne.id_taranaka ? personne.id_sampana ?? null : null,
  };
}

async function resolveDonateur(typeDonateur, idDonateur) {
  const id = normalizeUuid(idDonateur, "DON_DONATEUR_INVALID", "L'identifiant du donateur est invalide.");

  if (typeDonateur === "TARANAKA") {
    await resolveElementDonateur(id, "TARANAKA");
    return { id_taranaka: id, id_sampana: null, id_foyer: null, id_personne: null, id_taranaka_snapshot: id, id_sampana_snapshot: null };
  }

  if (typeDonateur === "SAMPANA") {
    await resolveElementDonateur(id, "SAMPANA");
    const hierarchy = await getTaranakaForElement(id);
    if (!hierarchy.id_taranaka) {
      throw businessError("Le Sampana ne possède pas de Taranaka parent exploitable.", "DON_RATTACHEMENT_INVALID");
    }
    return { id_taranaka: null, id_sampana: id, id_foyer: null, id_personne: null, id_taranaka_snapshot: hierarchy.id_taranaka, id_sampana_snapshot: id };
  }

  if (typeDonateur === "PERSONNE") {
    const personne = await resolvePersonneRattachement(id);
    return { id_taranaka: null, id_sampana: null, id_foyer: null, id_personne: personne.id, id_taranaka_snapshot: personne.id_taranaka_snapshot, id_sampana_snapshot: personne.id_sampana_snapshot };
  }

  if (typeDonateur !== "FOYER") {
    throw businessError("Le type de donateur est invalide.", "DON_DONATEUR_INVALID");
  }

  const foyerResult = await database.query(
    `SELECT id, id_personne_1, id_personne_2, type_foyer, statut FROM foyer WHERE id = $1`,
    [id],
  );
  const foyer = foyerResult.rows[0];
  if (!foyer) throw businessError("Foyer donateur introuvable.", "DON_FOYER_NOT_FOUND");

  const personne1 = await resolvePersonneRattachement(foyer.id_personne_1);
  if (foyer.type_foyer === "MONOPARENTAL" || !foyer.id_personne_2) {
    return { id_taranaka: null, id_sampana: null, id_foyer: foyer.id, id_personne: null, id_taranaka_snapshot: personne1.id_taranaka_snapshot, id_sampana_snapshot: personne1.id_sampana_snapshot };
  }

  if (foyer.type_foyer !== "COUPLE") {
    throw businessError("Le foyer donateur est invalide.", "DON_RATTACHEMENT_INVALID");
  }

  const personne2 = await resolvePersonneRattachement(foyer.id_personne_2);
  const sameTaranaka = personne1.id_taranaka_snapshot && personne1.id_taranaka_snapshot === personne2.id_taranaka_snapshot;
  if (!sameTaranaka) {
    return { id_taranaka: null, id_sampana: null, id_foyer: foyer.id, id_personne: null, id_taranaka_snapshot: null, id_sampana_snapshot: null };
  }

  const sameSampana = personne1.id_sampana_snapshot && personne1.id_sampana_snapshot === personne2.id_sampana_snapshot;
  return {
    id_taranaka: null,
    id_sampana: null,
    id_foyer: foyer.id,
    id_personne: null,
    id_taranaka_snapshot: personne1.id_taranaka_snapshot,
    id_sampana_snapshot: sameSampana ? personne1.id_sampana_snapshot : null,
  };
}

function normalizeDonPayload(payload) {
  return new Don(payload);
}

const donSelect = `
  SELECT
    d.*,
    jt.date_journee,
    tar_donateur.nom AS nom_taranaka_donateur,
    sam_donateur.nom AS nom_sampana_donateur,
    per_donateur.nom AS nom_personne_donateur,
    per_donateur.prenom AS prenom_personne_donateur,
    f.type_foyer AS type_foyer_donateur,
    foyer_personne_1.nom AS nom_foyer_personne_1,
    foyer_personne_1.prenom AS prenom_foyer_personne_1,
    foyer_personne_2.nom AS nom_foyer_personne_2,
    foyer_personne_2.prenom AS prenom_foyer_personne_2,
    tar_snapshot.nom AS nom_taranaka_snapshot,
    sam_snapshot.nom AS nom_sampana_snapshot
  FROM don d
  JOIN journee_alahadin_taranaka jt ON jt.id = d.id_journee
  LEFT JOIN element tar_donateur ON tar_donateur.id = d.id_taranaka
  LEFT JOIN element sam_donateur ON sam_donateur.id = d.id_sampana
  LEFT JOIN personne per_donateur ON per_donateur.id = d.id_personne
  LEFT JOIN foyer f ON f.id = d.id_foyer
  LEFT JOIN personne foyer_personne_1 ON foyer_personne_1.id = f.id_personne_1
  LEFT JOIN personne foyer_personne_2 ON foyer_personne_2.id = f.id_personne_2
  LEFT JOIN element tar_snapshot ON tar_snapshot.id = d.id_taranaka_snapshot
  LEFT JOIN element sam_snapshot ON sam_snapshot.id = d.id_sampana_snapshot
`;

function mapDon(row) {
  const donateur = row.type_donateur === "TARANAKA"
    ? { id: row.id_taranaka, nom: row.nom_taranaka_donateur }
    : row.type_donateur === "SAMPANA"
      ? { id: row.id_sampana, nom: row.nom_sampana_donateur }
      : row.type_donateur === "PERSONNE"
        ? { id: row.id_personne, nom: row.nom_personne_donateur, prenom: row.prenom_personne_donateur }
        : {
          id: row.id_foyer,
          type_foyer: row.type_foyer_donateur,
          personne_1: row.nom_foyer_personne_1 ? { nom: row.nom_foyer_personne_1, prenom: row.prenom_foyer_personne_1 } : null,
          personne_2: row.nom_foyer_personne_2 ? { nom: row.nom_foyer_personne_2, prenom: row.prenom_foyer_personne_2 } : null,
        };

  return {
    id: row.id,
    journee: { id: row.id_journee, date_journee: row.date_journee },
    type_donateur: row.type_donateur,
    donateur,
    type_don: row.type_don,
    montant: row.montant,
    devise: row.devise,
    designation: row.designation,
    quantite: row.quantite,
    unite: row.unite,
    observation: row.observation,
    statut: row.statut,
    snapshots: {
      taranaka: row.id_taranaka_snapshot ? { id: row.id_taranaka_snapshot, nom: row.nom_taranaka_snapshot } : null,
      sampana: row.id_sampana_snapshot ? { id: row.id_sampana_snapshot, nom: row.nom_sampana_snapshot } : null,
    },
    date_creation: row.date_creation,
    date_modification: row.date_modification,
    date_annulation: row.date_annulation,
    motif_annulation: row.motif_annulation,
    warnings: warningsForSnapshots(row.id_taranaka_snapshot),
  };
}

async function getDonByIdForJournee(idJournee, idDon, { forUpdate = false } = {}) {
  const result = await database.query(
    `SELECT d.id, d.statut FROM don d WHERE d.id = $1 AND d.id_journee = $2 ${forUpdate ? "FOR UPDATE" : ""}`,
    [idDon, idJournee],
  );
  return result.rows[0] ?? null;
}

async function getMappedDon(idJournee, idDon) {
  const result = await database.query(`${donSelect} WHERE d.id_journee = $1 AND d.id = $2`, [idJournee, idDon]);
  return result.rows[0] ? mapDon(result.rows[0]) : null;
}

export async function createDon(idJournee, payload, idCompteCreateur) {
  const journeeId = normalizeUuid(idJournee, "DON_INVALID", "Identifiant de journée invalide.");
  const compteId = normalizeUuid(idCompteCreateur, "DON_INVALID", "Compte créateur invalide.");
  const don = normalizeDonPayload(payload);

  return database.transaction(async () => {
    await getJourneeForWrite(journeeId);
    const resolved = await resolveDonateur(don.type_donateur, don.id_donateur);
    await assertEligibleForJournee(journeeId, resolved.id_taranaka_snapshot);

    const result = await database.query(
      `
        INSERT INTO don (
          id_journee, type_donateur, id_taranaka, id_sampana, id_foyer, id_personne,
          type_don, montant, devise, designation, quantite, unite, observation,
          statut, id_taranaka_snapshot, id_sampana_snapshot, id_compte_createur
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          'VALIDE', $14, $15, $16
        ) RETURNING id
      `,
      [journeeId, don.type_donateur, resolved.id_taranaka, resolved.id_sampana, resolved.id_foyer, resolved.id_personne, don.type_don, don.montant, don.devise, don.designation, don.quantite, don.unite, don.observation, resolved.id_taranaka_snapshot, resolved.id_sampana_snapshot, compteId],
    );
    return getMappedDon(journeeId, result.rows[0].id);
  });
}

export async function getDonsByJournee(idJournee, { includeCancelled = true } = {}) {
  const journeeId = normalizeUuid(idJournee, "DON_INVALID", "Identifiant de journée invalide.");
  await assertJourneeExists(journeeId);
  const result = await database.query(
    `${donSelect} WHERE d.id_journee = $1 AND ($2::boolean OR d.statut = 'VALIDE') ORDER BY d.date_creation DESC, d.id DESC`,
    [journeeId, includeCancelled],
  );
  return result.rows.map(mapDon);
}

export async function getDonByJournee(idJournee, idDon, { includeCancelled = true } = {}) {
  const journeeId = normalizeUuid(idJournee, "DON_INVALID", "Identifiant de journée invalide.");
  const donId = normalizeUuid(idDon, "DON_INVALID", "Identifiant de don invalide.");
  await assertJourneeExists(journeeId);
  const result = await database.query(
    `${donSelect} WHERE d.id_journee = $1 AND d.id = $2 AND ($3::boolean OR d.statut = 'VALIDE')`,
    [journeeId, donId, includeCancelled],
  );
  return result.rows[0] ? mapDon(result.rows[0]) : null;
}

export async function updateDon(idJournee, idDon, payload, idCompteModificateur) {
  const journeeId = normalizeUuid(idJournee, "DON_INVALID", "Identifiant de journée invalide.");
  const donId = normalizeUuid(idDon, "DON_INVALID", "Identifiant de don invalide.");
  const compteId = normalizeUuid(idCompteModificateur, "DON_INVALID", "Compte modificateur invalide.");
  const don = normalizeDonPayload(payload);

  return database.transaction(async () => {
    await getJourneeForWrite(journeeId);
    const current = await getDonByIdForJournee(journeeId, donId, { forUpdate: true });
    if (!current) throw businessError("Don introuvable.", "DON_NOT_FOUND");
    if (current.statut !== "VALIDE") throw businessError("Un don annulé ne peut pas être modifié.", "DON_ALREADY_CANCELLED");

    const resolved = await resolveDonateur(don.type_donateur, don.id_donateur);
    await assertEligibleForJournee(journeeId, resolved.id_taranaka_snapshot);

    await database.query(
      `
        UPDATE don SET
          type_donateur = $3, id_taranaka = $4, id_sampana = $5, id_foyer = $6, id_personne = $7,
          type_don = $8, montant = $9, devise = $10, designation = $11, quantite = $12, unite = $13,
          observation = $14, id_taranaka_snapshot = $15, id_sampana_snapshot = $16,
          id_compte_modificateur = $17, date_modification = now()
        WHERE id_journee = $1 AND id = $2
      `,
      [journeeId, donId, don.type_donateur, resolved.id_taranaka, resolved.id_sampana, resolved.id_foyer, resolved.id_personne, don.type_don, don.montant, don.devise, don.designation, don.quantite, don.unite, don.observation, resolved.id_taranaka_snapshot, resolved.id_sampana_snapshot, compteId],
    );
    return getMappedDon(journeeId, donId);
  });
}

export async function cancelDon(idJournee, idDon, motifAnnulation, idCompteAnnulateur) {
  const journeeId = normalizeUuid(idJournee, "DON_INVALID", "Identifiant de journée invalide.");
  const donId = normalizeUuid(idDon, "DON_INVALID", "Identifiant de don invalide.");
  const compteId = normalizeUuid(idCompteAnnulateur, "DON_INVALID", "Compte annulateur invalide.");
  if (typeof motifAnnulation !== "string" || !motifAnnulation.trim()) {
    throw businessError("Le motif d'annulation est obligatoire.", "DON_CANCELLATION_REASON_REQUIRED");
  }

  return database.transaction(async () => {
    await getJourneeForWrite(journeeId);
    const current = await getDonByIdForJournee(journeeId, donId, { forUpdate: true });
    if (!current) throw businessError("Don introuvable.", "DON_NOT_FOUND");
    if (current.statut !== "VALIDE") throw businessError("Ce don est déjà annulé.", "DON_ALREADY_CANCELLED");

    await database.query(
      `
        UPDATE don SET statut = 'ANNULE', date_annulation = now(), motif_annulation = $3,
          id_compte_annulateur = $4, date_modification = now()
        WHERE id_journee = $1 AND id = $2
      `,
      [journeeId, donId, motifAnnulation.trim(), compteId],
    );
    return getMappedDon(journeeId, donId);
  });
}
async function getJourneeForStatistiques(idJournee) {
  const result = await database.query(
    `
      SELECT id, date_journee, statut, observation, date_creation, date_modification
      FROM journee_alahadin_taranaka
      WHERE id = $1
    `,
    [idJournee],
  );
  if (!result.rows[0]) throw businessError("Journée introuvable.", "DON_JOURNEE_NOT_FOUND");
  return result.rows[0];
}

async function getStatisticRows(sql, idJournee) {
  const result = await database.query(sql, [idJournee]);
  return result.rows;
}

export async function getStatistiquesDonsByJournee(idJournee) {
  const journeeId = normalizeUuid(idJournee, "DON_INVALID", "Identifiant de journée invalide.");
  const journee = await getJourneeForStatistiques(journeeId);

  const comptages = await getStatisticRows(
    `
      SELECT
        count(*) FILTER (WHERE statut = 'VALIDE')::int AS dons_valides,
        count(*) FILTER (WHERE statut = 'VALIDE' AND type_don = 'ARGENT')::int AS dons_argent_valides,
        count(*) FILTER (WHERE statut = 'VALIDE' AND type_don = 'MATERIEL')::int AS dons_materiel_valides,
        count(*) FILTER (WHERE statut = 'ANNULE')::int AS dons_annules
      FROM don
      WHERE id_journee = $1
    `,
    journeeId,
  );

  const totalGeneralArgent = await getStatisticRows(
    `
      SELECT devise, sum(montant) AS total
      FROM don
      WHERE id_journee = $1 AND statut = 'VALIDE' AND type_don = 'ARGENT'
      GROUP BY devise
      ORDER BY devise ASC
    `,
    journeeId,
  );
  const argentParTypeDonateur = await getStatisticRows(
    `
      SELECT type_donateur, devise, sum(montant) AS total
      FROM don
      WHERE id_journee = $1 AND statut = 'VALIDE' AND type_don = 'ARGENT'
      GROUP BY type_donateur, devise
      ORDER BY type_donateur ASC, devise ASC
    `,
    journeeId,
  );
  const argentParTaranaka = await getStatisticRows(
    `
      SELECT d.id_taranaka_snapshot AS id_taranaka, e.nom AS nom_taranaka, d.devise, sum(d.montant) AS total
      FROM don d
      JOIN element e ON e.id = d.id_taranaka_snapshot
      WHERE d.id_journee = $1 AND d.statut = 'VALIDE' AND d.type_don = 'ARGENT'
        AND d.id_taranaka_snapshot IS NOT NULL
      GROUP BY d.id_taranaka_snapshot, e.nom, d.devise
      ORDER BY e.nom ASC, d.devise ASC
    `,
    journeeId,
  );
  const argentSansTaranaka = await getStatisticRows(
    `
      SELECT devise, sum(montant) AS total
      FROM don
      WHERE id_journee = $1 AND statut = 'VALIDE' AND type_don = 'ARGENT'
        AND id_taranaka_snapshot IS NULL
      GROUP BY devise
      ORDER BY devise ASC
    `,
    journeeId,
  );
  const argentSansTaranakaDetail = await getStatisticRows(
    `
      SELECT d.type_donateur, d.id_personne, p.nom AS nom_personne, p.prenom AS prenom_personne,
        d.id_taranaka, e.nom AS nom_taranaka_donateur, d.devise, sum(d.montant) AS total
      FROM don d
      LEFT JOIN personne p ON p.id = d.id_personne
      LEFT JOIN element e ON e.id = d.id_taranaka
      WHERE d.id_journee = $1 AND d.statut = 'VALIDE' AND d.type_don = 'ARGENT'
        AND d.id_taranaka_snapshot IS NULL
      GROUP BY d.type_donateur, d.id_personne, p.nom, p.prenom, d.id_taranaka, e.nom, d.devise
      ORDER BY d.type_donateur ASC, p.nom ASC NULLS LAST, e.nom ASC NULLS LAST, d.devise ASC
    `,
    journeeId,
  );

  const argentParSampana = await getStatisticRows(
    `
      SELECT d.id_sampana_snapshot AS id_sampana, e.nom AS nom_sampana, d.devise, sum(d.montant) AS total
      FROM don d
      JOIN element e ON e.id = d.id_sampana_snapshot
      WHERE d.id_journee = $1 AND d.statut = 'VALIDE' AND d.type_don = 'ARGENT'
        AND d.id_sampana_snapshot IS NOT NULL
      GROUP BY d.id_sampana_snapshot, e.nom, d.devise
      ORDER BY e.nom ASC, d.devise ASC
    `,
    journeeId,
  );
  const argentSansSampana = await getStatisticRows(
    `
      SELECT devise, sum(montant) AS total
      FROM don
      WHERE id_journee = $1 AND statut = 'VALIDE' AND type_don = 'ARGENT'
        AND id_sampana_snapshot IS NULL
      GROUP BY devise
      ORDER BY devise ASC
    `,
    journeeId,
  );
  const argentSansSampanaDetail = await getStatisticRows(
    `
      SELECT d.type_donateur, d.id_personne, p.nom AS nom_personne, p.prenom AS prenom_personne,
        d.id_taranaka, e.nom AS nom_taranaka_donateur, d.devise, sum(d.montant) AS total
      FROM don d
      LEFT JOIN personne p ON p.id = d.id_personne
      LEFT JOIN element e ON e.id = d.id_taranaka
      WHERE d.id_journee = $1 AND d.statut = 'VALIDE' AND d.type_don = 'ARGENT'
        AND d.id_sampana_snapshot IS NULL
      GROUP BY d.type_donateur, d.id_personne, p.nom, p.prenom, d.id_taranaka, e.nom, d.devise
      ORDER BY d.type_donateur ASC, p.nom ASC NULLS LAST, e.nom ASC NULLS LAST, d.devise ASC
    `,
    journeeId,
  );

  const argentParFoyer = await getStatisticRows(
    `
      SELECT d.id_foyer, f.type_foyer,
        foyer_personne_1.nom AS nom_foyer_personne_1, foyer_personne_1.prenom AS prenom_foyer_personne_1,
        foyer_personne_2.nom AS nom_foyer_personne_2, foyer_personne_2.prenom AS prenom_foyer_personne_2,
        d.devise, sum(d.montant) AS total
      FROM don d
      JOIN foyer f ON f.id = d.id_foyer
      LEFT JOIN personne foyer_personne_1 ON foyer_personne_1.id = f.id_personne_1
      LEFT JOIN personne foyer_personne_2 ON foyer_personne_2.id = f.id_personne_2
      WHERE d.id_journee = $1 AND d.statut = 'VALIDE' AND d.type_don = 'ARGENT'
        AND d.type_donateur = 'FOYER'
      GROUP BY d.id_foyer, f.type_foyer, foyer_personne_1.nom, foyer_personne_1.prenom,
        foyer_personne_2.nom, foyer_personne_2.prenom, d.devise
      ORDER BY d.id_foyer ASC, d.devise ASC
    `,
    journeeId,
  );
  const argentParPersonne = await getStatisticRows(
    `
      SELECT d.id_personne, p.nom AS nom_personne, p.prenom AS prenom_personne, d.devise, sum(d.montant) AS total
      FROM don d
      JOIN personne p ON p.id = d.id_personne
      WHERE d.id_journee = $1 AND d.statut = 'VALIDE' AND d.type_don = 'ARGENT'
        AND d.type_donateur = 'PERSONNE'
      GROUP BY d.id_personne, p.nom, p.prenom, d.devise
      ORDER BY p.nom ASC, p.prenom ASC, d.devise ASC
    `,
    journeeId,
  );

  const totalGeneralMateriel = await getStatisticRows(
    `
      SELECT designation, unite, sum(quantite) AS quantite
      FROM don
      WHERE id_journee = $1 AND statut = 'VALIDE' AND type_don = 'MATERIEL'
      GROUP BY designation, unite
      ORDER BY designation ASC, unite ASC
    `,
    journeeId,
  );
  const materielParTaranaka = await getStatisticRows(
    `
      SELECT d.id_taranaka_snapshot AS id_taranaka, e.nom AS nom_taranaka,
        d.designation, d.unite, sum(d.quantite) AS quantite
      FROM don d
      JOIN element e ON e.id = d.id_taranaka_snapshot
      WHERE d.id_journee = $1 AND d.statut = 'VALIDE' AND d.type_don = 'MATERIEL'
        AND d.id_taranaka_snapshot IS NOT NULL
      GROUP BY d.id_taranaka_snapshot, e.nom, d.designation, d.unite
      ORDER BY e.nom ASC, d.designation ASC, d.unite ASC
    `,
    journeeId,
  );
  const materielSansTaranaka = await getStatisticRows(
    `
      SELECT designation, unite, sum(quantite) AS quantite
      FROM don
      WHERE id_journee = $1 AND statut = 'VALIDE' AND type_don = 'MATERIEL'
        AND id_taranaka_snapshot IS NULL
      GROUP BY designation, unite
      ORDER BY designation ASC, unite ASC
    `,
    journeeId,
  );
  const materielParSampana = await getStatisticRows(
    `
      SELECT d.id_sampana_snapshot AS id_sampana, e.nom AS nom_sampana,
        d.designation, d.unite, sum(d.quantite) AS quantite
      FROM don d
      JOIN element e ON e.id = d.id_sampana_snapshot
      WHERE d.id_journee = $1 AND d.statut = 'VALIDE' AND d.type_don = 'MATERIEL'
        AND d.id_sampana_snapshot IS NOT NULL
      GROUP BY d.id_sampana_snapshot, e.nom, d.designation, d.unite
      ORDER BY e.nom ASC, d.designation ASC, d.unite ASC
    `,
    journeeId,
  );
  const materielSansSampana = await getStatisticRows(
    `
      SELECT designation, unite, sum(quantite) AS quantite
      FROM don
      WHERE id_journee = $1 AND statut = 'VALIDE' AND type_don = 'MATERIEL'
        AND id_sampana_snapshot IS NULL
      GROUP BY designation, unite
      ORDER BY designation ASC, unite ASC
    `,
    journeeId,
  );

  return {
    journee,
    comptages: comptages[0],
    argent: {
      total_general: totalGeneralArgent,
      par_type_donateur: argentParTypeDonateur,
      par_taranaka: argentParTaranaka,
      sans_taranaka: argentSansTaranaka,
      sans_taranaka_detail: argentSansTaranakaDetail,
      par_sampana: argentParSampana,
      sans_sampana: argentSansSampana,
      sans_sampana_detail: argentSansSampanaDetail,
      par_foyer: argentParFoyer,
      par_personne: argentParPersonne,
    },
    materiel: {
      total_general: totalGeneralMateriel,
      par_taranaka: materielParTaranaka,
      sans_taranaka: materielSansTaranaka,
      par_sampana: materielParSampana,
      sans_sampana: materielSansSampana,
    },
  };
}
