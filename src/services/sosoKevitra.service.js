import { isBusinessManager } from "../utils/roles.js";
import database from "../config/db.js";
import StatutSosoKevitra from "../models/StatutSosoKevitra.js";
import SosoKevitraCategorieContribution from "../models/SosoKevitraCategorieContribution.js";
import SosoKevitra from "../models/SosoKevitra.js";
import SosoKevitraAction from "../models/SosoKevitraAction.js";
import SosoKevitraLigneBudget from "../models/SosoKevitraLigneBudget.js";
import {
  deleteSosoKevitraStoragePhotos,
  getSosoKevitraPhotos,
} from "./sosoKevitraPhoto.service.js";
import { createSignedStorageUrls } from "./storage.service.js";
import { listContributions } from "./sosoKevitraContribution.service.js";

const DRAFT_FIELDS = [
  "titre",
  "description",
  "raison",
  "objectif",
  "beneficiaires",
  "lieu",
  "lieu_non_defini",
  "details_realisation",
  "ressources_necessaires",
  "budget_non_defini",
  "devise",
  "periode_souhaitee",
];

const SERVER_MANAGED_FIELDS = new Set([
  "id",
  "id_auteur",
  "id_statut_soso_kevitra",
  "date_publication",
  "date_fin_consultation",
  "date_creation",
  "date_modification",
]);

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeLanguage(code = "fr") {
  if (typeof code !== "string") throw businessError("Langue invalide", "LANG_INVALID");
  const normalized = code.trim().toLowerCase();
  if (!["fr", "mg"].includes(normalized)) {
    throw businessError("Langue invalide", "LANG_INVALID");
  }
  return normalized;
}

function normalizeCollection(value, label, Mapper) {
  if (!Array.isArray(value)) throw new Error(`${label} doit être une liste`);
  const collection = value.map((item) => {
    if (!plainObject(item)) throw new Error(`${label} contient une valeur invalide`);
    return new Mapper(item);
  });
  const orders = new Set();
  for (const item of collection) {
    if (orders.has(item.ordre)) throw new Error(`Les ordres des ${label.toLowerCase()} doivent être uniques`);
    orders.add(item.ordre);
  }
  return collection;
}

function normalizePayload(body = {}, { update = false } = {}) {
  if (!plainObject(body)) throw new Error("Les données du brouillon sont invalides");
  if (Object.keys(body).some((field) => SERVER_MANAGED_FIELDS.has(field))) {
    throw new Error("Ces champs sont gérés par le serveur");
  }

  const allowed = new Set([...DRAFT_FIELDS, "actions", "budget"]);
  if (Object.keys(body).some((field) => !allowed.has(field))) {
    throw new Error("Un champ du brouillon n'est pas autorisé");
  }

  const main = {};
  for (const field of DRAFT_FIELDS) {
    if (!update || Object.hasOwn(body, field)) main[field] = body[field];
  }

  return {
    main,
    actions: Object.hasOwn(body, "actions")
      ? normalizeCollection(body.actions, "Actions", SosoKevitraAction)
      : null,
    budget: Object.hasOwn(body, "budget")
      ? normalizeCollection(body.budget, "Lignes budget", SosoKevitraLigneBudget)
      : null,
  };
}

function mapStatut(row) {
  return new StatutSosoKevitra({
    id: row.id,
    code: row.code,
    ordre: row.ordre,
    libelle: row.libelle,
  });
}

function mapCategorie(row) {
  return new SosoKevitraCategorieContribution({
    id: row.id,
    code: row.code,
    ordre: row.ordre,
    libelle: row.libelle,
    actif: row.actif,
  });
}

function mapDraft(row, actions = [], budget = [], totalBudgetCalcule = "0") {
  return {
    ...new SosoKevitra(row).toJSON(),
    statut: mapStatut({
      id: row.id_statut_soso_kevitra,
      code: row.statut_code,
      ordre: row.statut_ordre,
      libelle: row.statut_libelle,
    }),
    actions: actions.map((item) => new SosoKevitraAction(item)),
    budget: budget.map((item) => new SosoKevitraLigneBudget(item)),
    total_budget_calcule: totalBudgetCalcule,
  };
}

async function getDraftRow(id, idAuteur, { forUpdate = false } = {}) {
  const result = await database.query(
    `SELECT s.*, statut.code AS statut_code, statut.ordre AS statut_ordre, now() AS date_serveur
    FROM soso_kevitra s
    JOIN statut_soso_kevitra statut
      ON statut.id = s.id_statut_soso_kevitra
    WHERE s.id = $1
      AND s.id_auteur = $2
      AND statut.code = 'BROUILLON'
    ${forUpdate ? "FOR UPDATE OF s" : ""}`,
    [id, idAuteur],
  );
  return result.rows[0] ?? null;
}

async function getOwnedSosoRow(id, idAuteur, { forUpdate = false } = {}) {
  const result = await database.query(
    `SELECT s.*, statut.code AS statut_code, statut.ordre AS statut_ordre, now() AS date_serveur
    FROM soso_kevitra s
    JOIN statut_soso_kevitra statut
      ON statut.id = s.id_statut_soso_kevitra
    WHERE s.id = $1 AND s.id_auteur = $2
    ${forUpdate ? "FOR UPDATE OF s" : ""}`,
    [id, idAuteur],
  );
  return result.rows[0] ?? null;
}

async function getSosoRow(id, { forUpdate = false } = {}) {
  const result = await database.query(
    `SELECT s.*, statut.code AS statut_code, statut.ordre AS statut_ordre, now() AS date_serveur
    FROM soso_kevitra s
    JOIN statut_soso_kevitra statut
      ON statut.id = s.id_statut_soso_kevitra
    WHERE s.id = $1
    ${forUpdate ? "FOR UPDATE OF s" : ""}`,
    [id],
  );
  return result.rows[0] ?? null;
}

function isAdmin(auth) {
  return auth?.compte?.role === "ADMIN";
}

function canReadSosoKevitra(row, auth) {
  const idPersonne = auth?.personne?.id;
  if (!idPersonne) return false;
  const isAuthor = row.id_auteur === idPersonne;

  switch (row.statut_code) {
    case "BROUILLON":
      return isAuthor;
    case "EN_ATTENTE_VERIFICATION":
    case "A_CORRIGER":
    case "NON_PUBLIE":
      return isAuthor || isAdmin(auth);
    case "EN_CONSULTATION":
    case "A_L_ETUDE":
    case "ACCEPTE":
    case "REFUSE":
      return true;
    default:
      return false;
  }
}

function consultationState(row) {
  const closed = row.statut_code === "EN_CONSULTATION"
    && (row.date_fin_consultation === null
      || new Date(row.date_serveur).getTime() >= new Date(row.date_fin_consultation).getTime());
  return {
    consultation_ouverte: row.statut_code === "EN_CONSULTATION" && !closed,
    statut_fonctionnel: closed ? "A_L_ETUDE" : row.statut_code,
  };
}

async function getSosoDetails(row, lang, auth = null) {
  const idLecteur = auth?.personne?.id ?? null;
  const [translation, actions, budget, total, history, photos, auteur, soutienSummary, soutiens, contributions, prolongations, decisionFinale] = await Promise.all([
    database.query(
      `SELECT traduction.libelle
      FROM statut_soso_kevitra_traduction traduction
      JOIN langue l ON l.id = traduction.id_langue
      WHERE traduction.id_statut_soso_kevitra = $1
        AND lower(l.code) = $2`,
      [row.id_statut_soso_kevitra, lang],
    ),
    database.query(
      `SELECT id, id_soso_kevitra, description, ordre
      FROM soso_kevitra_action
      WHERE id_soso_kevitra = $1
      ORDER BY ordre ASC`,
      [row.id],
    ),
    database.query(
      `SELECT id, id_soso_kevitra, designation, quantite,
        prix_unitaire_estime, ordre
      FROM soso_kevitra_ligne_budget
      WHERE id_soso_kevitra = $1
      ORDER BY ordre ASC`,
      [row.id],
    ),
    database.query(
      `SELECT COALESCE(SUM(quantite * prix_unitaire_estime), 0) AS total
      FROM soso_kevitra_ligne_budget
      WHERE id_soso_kevitra = $1`,
      [row.id],
    ),
    database.query(
      `SELECT verification.action, verification.commentaire, verification.date_action,
        personne.id AS id_personne_action, personne.nom AS personne_action_nom,
        personne.prenom AS personne_action_prenom,
        personne.nom_usage AS personne_action_nom_usage
      FROM soso_kevitra_verification verification
      JOIN personne ON personne.id = verification.id_personne_action
      WHERE verification.id_soso_kevitra = $1
      ORDER BY verification.date_action ASC, verification.id ASC`,
      [row.id],
    ),
    getSosoKevitraPhotos(row.id),
    database.query(
      `SELECT id, nom, prenom, nom_usage
      FROM personne
      WHERE id = $1`,
      [row.id_auteur],
    ),
    database.query(
      `SELECT COUNT(*)::integer AS nombre_soutiens,
        EXISTS(
          SELECT 1 FROM soso_kevitra_soutien
          WHERE id_soso_kevitra = $1 AND id_personne = $2
        ) AS utilisateur_soutient
      FROM soso_kevitra_soutien
      WHERE id_soso_kevitra = $1`,
      [row.id, idLecteur],
    ),
    database.query(
      `SELECT personne.id, personne.nom, personne.prenom, personne.nom_usage,
        soutien.date_soutien
      FROM soso_kevitra_soutien soutien
      JOIN personne ON personne.id = soutien.id_personne
      WHERE soutien.id_soso_kevitra = $1
      ORDER BY soutien.date_soutien ASC, soutien.id_personne ASC`,
      [row.id],
    ),
      listContributions(row.id, auth, lang),
    database.query(`SELECT prolongation.id, prolongation.ancienne_date_fin, prolongation.nouvelle_date_fin, prolongation.raison, prolongation.date_prolongation, personne.id AS personne_action_id, personne.nom AS personne_action_nom, personne.prenom AS personne_action_prenom, personne.nom_usage AS personne_action_nom_usage FROM soso_kevitra_prolongation prolongation JOIN personne ON personne.id = prolongation.id_admin WHERE prolongation.id_soso_kevitra = $1 ORDER BY prolongation.date_prolongation ASC, prolongation.id ASC`, [row.id]),
    database.query(
      `SELECT decision.decision, decision.observation, decision.date_decision,
        personne.id AS personne_action_id, personne.nom AS personne_action_nom,
        personne.prenom AS personne_action_prenom,
        personne.nom_usage AS personne_action_nom_usage
      FROM soso_kevitra_decision decision
      JOIN personne ON personne.id = decision.id_admin
      WHERE decision.id_soso_kevitra = $1`,
      [row.id],
    ),
  ]);

  return {
    ...mapDraft(
    { ...row, statut_libelle: translation.rows[0]?.libelle ?? null },
    actions.rows,
    budget.rows,
    total.rows[0].total,
    ),
    verification_historique: history.rows.map((item) => ({
      action: item.action,
      commentaire: item.commentaire,
      date_action: item.date_action,
      personne_action: {
        id: item.id_personne_action,
        nom: item.personne_action_nom,
        prenom: item.personne_action_prenom,
        nom_usage: item.personne_action_nom_usage,
      },
    })),
    photos,
    auteur: auteur.rows[0] ?? null,
    ...consultationState(row),
    nombre_soutiens: soutienSummary.rows[0].nombre_soutiens,
    utilisateur_soutient: soutienSummary.rows[0].utilisateur_soutient,
    soutiens: soutiens.rows,
    contributions,
    prolongations: prolongations.rows.map((item) => ({ id: item.id, ancienne_date_fin_consultation: item.ancienne_date_fin, nouvelle_date_fin_consultation: item.nouvelle_date_fin, raison: item.raison, date_prolongation: item.date_prolongation, personne_action: { id: item.personne_action_id, nom: item.personne_action_nom, prenom: item.personne_action_prenom, nom_usage: item.personne_action_nom_usage } })),
    decision_finale: decisionFinale.rows[0]
      ? {
          decision: decisionFinale.rows[0].decision,
          observation: decisionFinale.rows[0].observation,
          date_decision: decisionFinale.rows[0].date_decision,
          personne_action: {
            id: decisionFinale.rows[0].personne_action_id,
            nom: decisionFinale.rows[0].personne_action_nom,
            prenom: decisionFinale.rows[0].personne_action_prenom,
            nom_usage: decisionFinale.rows[0].personne_action_nom_usage,
          },
        }
      : null,
  };
}

async function insertActions(idSosoKevitra, actions) {
  for (const action of actions) {
    await database.query(
      `INSERT INTO soso_kevitra_action (id_soso_kevitra, description, ordre)
      VALUES ($1, $2, $3)`,
      [idSosoKevitra, action.description, action.ordre],
    );
  }
}

async function insertBudget(idSosoKevitra, budget) {
  for (const ligne of budget) {
    await database.query(
      `INSERT INTO soso_kevitra_ligne_budget (
        id_soso_kevitra,
        designation,
        quantite,
        prix_unitaire_estime,
        ordre
      )
      VALUES ($1, $2, $3, $4, $5)`,
      [
        idSosoKevitra,
        ligne.designation,
        ligne.quantite,
        ligne.prix_unitaire_estime,
        ligne.ordre,
      ],
    );
  }
}

async function getBrouillonStatusId() {
  const result = await database.query(
    "SELECT id FROM statut_soso_kevitra WHERE code = 'BROUILLON'",
  );
  if (!result.rows[0]) {
    throw businessError("Statut Brouillon introuvable", "SOSO_KEVITRA_STATUS_NOT_FOUND");
  }
  return result.rows[0].id;
}

async function getStatusId(code) {
  const result = await database.query(
    "SELECT id FROM statut_soso_kevitra WHERE code = $1",
    [code],
  );
  if (!result.rows[0]) {
    throw businessError("Statut Soso-kevitra introuvable", "SOSO_KEVITRA_STATUS_NOT_FOUND");
  }
  return result.rows[0].id;
}

async function addVerificationHistory(idSosoKevitra, action, commentaire, idPersonneAction) {
  await database.query(
    `INSERT INTO soso_kevitra_verification (
      id_soso_kevitra, action, commentaire, id_personne_action
    ) VALUES ($1, $2, $3, $4)`,
    [idSosoKevitra, action, commentaire, idPersonneAction],
  );
}

function assertAdmin(auth) {
  if (!isAdmin(auth)) {
    throw businessError("Accès administrateur requis", "SOSO_KEVITRA_ADMIN_FORBIDDEN");
  }
}

function assertTransition(row, acceptedStatuses) {
  if (!acceptedStatuses.includes(row.statut_code)) {
    throw businessError("Transition de statut impossible", "WORKFLOW_TRANSITION_INVALID");
  }
}

function assertSubmissionFields(row, actions) {
  const required = [
    ["titre", "Le titre est obligatoire pour soumettre la proposition"],
    ["description", "La description est obligatoire pour soumettre la proposition"],
    ["raison", "La raison est obligatoire pour soumettre la proposition"],
    ["objectif", "L'objectif est obligatoire pour soumettre la proposition"],
  ];
  const invalidFields = required
    .filter(([field]) => typeof row[field] !== "string" || !row[field].trim())
    .map(([field, message]) => ({ field, message }));
  if (!actions.length) {
    invalidFields.push({ field: "actions", message: "Au moins une action est obligatoire pour soumettre la proposition" });
  }
  if (invalidFields.length) {
    const error = businessError("La proposition est incomplète", "SUBMISSION_INVALID");
    error.details = invalidFields;
    throw error;
  }
}

function normalizeReason(body) {
  if (!plainObject(body) || typeof body.raison !== "string" || !body.raison.trim()) {
    throw new Error("La raison est obligatoire");
  }
  return body.raison.trim();
}

function normalizeConsultationEndDate(body) {
  const value = body?.date_fin_consultation;
  const isoWithTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
  if (typeof value !== "string" || !isoWithTimezone.test(value)) {
    throw new Error("La date de fin de consultation doit être une date ISO avec fuseau horaire");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    throw new Error("La date de fin de consultation doit être strictement future");
  }
  return value;
}

export async function getStatutsSosoKevitra(lang) {
  const language = normalizeLanguage(lang);
  const result = await database.query(
    `SELECT statut.id, statut.code, statut.ordre, traduction.libelle
    FROM statut_soso_kevitra statut
    JOIN statut_soso_kevitra_traduction traduction
      ON traduction.id_statut_soso_kevitra = statut.id
    JOIN langue l ON l.id = traduction.id_langue
    WHERE lower(l.code) = $1
    ORDER BY statut.ordre ASC`,
    [language],
  );
  return result.rows.map(mapStatut);
}

export async function getCategoriesContribution(lang) {
  const language = normalizeLanguage(lang);
  const result = await database.query(
    `SELECT categorie.id, categorie.code, categorie.ordre, categorie.actif,
      traduction.libelle
    FROM soso_kevitra_categorie_contribution categorie
    JOIN soso_kevitra_categorie_contribution_traduction traduction
      ON traduction.id_categorie = categorie.id
    JOIN langue l ON l.id = traduction.id_langue
    WHERE categorie.actif = true
      AND lower(l.code) = $1
    ORDER BY categorie.ordre ASC`,
    [language],
  );
  return result.rows.map(mapCategorie);
}

export async function createBrouillonSosoKevitra(body, auth, lang = "fr") {
  const idAuteur = auth?.personne?.id;
  if (!idAuteur) throw businessError("Authentification requise", "AUTH_REQUIRED");
  const language = normalizeLanguage(lang);
  const payload = normalizePayload(body);
  const draft = new SosoKevitra(payload.main);
  const actions = payload.actions ?? [];
  const budget = draft.budget_non_defini ? [] : payload.budget ?? [];

  const idSosoKevitra = await database.transaction(async () => {
    const idStatut = await getBrouillonStatusId();
    const result = await database.query(
      `INSERT INTO soso_kevitra (
        id_auteur, titre, description, raison, objectif, beneficiaires,
        lieu, lieu_non_defini, details_realisation, ressources_necessaires,
        budget_non_defini, devise, periode_souhaitee, id_statut_soso_kevitra
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING id`,
      [
        idAuteur,
        draft.titre,
        draft.description,
        draft.raison,
        draft.objectif,
        draft.beneficiaires,
        draft.lieu,
        draft.lieu_non_defini,
        draft.details_realisation,
        draft.ressources_necessaires,
        draft.budget_non_defini,
        draft.devise,
        draft.periode_souhaitee,
        idStatut,
      ],
    );
    const id = result.rows[0].id;
    await insertActions(id, actions);
    await insertBudget(id, budget);
    return id;
  });

  return getBrouillonSosoKevitraById(idSosoKevitra, auth, language);
}

export async function getBrouillonSosoKevitraById(id, auth, lang = "fr") {
  const idAuteur = auth?.personne?.id;
  if (!idAuteur) throw businessError("Authentification requise", "AUTH_REQUIRED");
  const row = await getDraftRow(id, idAuteur);
  if (!row) return null;
  return getSosoDetails(row, normalizeLanguage(lang), auth);
}

export async function getSosoKevitraById(id, auth, lang = "fr") {
  if (!auth?.personne?.id) throw businessError("Authentification requise", "AUTH_REQUIRED");
  const row = await getSosoRow(id);
  if (!row || !canReadSosoKevitra(row, auth)) return null;
  return getSosoDetails(row, normalizeLanguage(lang), auth);
}

export async function getMesBrouillonsSosoKevitra(auth, lang = "fr") {
  const idAuteur = auth?.personne?.id;
  if (!idAuteur) throw businessError("Authentification requise", "AUTH_REQUIRED");
  const language = normalizeLanguage(lang);
  const result = await database.query(
    `SELECT
      s.id,
      s.titre,
      s.date_creation,
      s.date_modification,
      statut.id AS id_statut_soso_kevitra,
      statut.code AS statut_code,
      statut.ordre AS statut_ordre,
      traduction.libelle AS statut_libelle
    FROM soso_kevitra s
    JOIN statut_soso_kevitra statut
      ON statut.id = s.id_statut_soso_kevitra
    LEFT JOIN langue l ON lower(l.code) = $2
    LEFT JOIN statut_soso_kevitra_traduction traduction
      ON traduction.id_statut_soso_kevitra = statut.id
      AND traduction.id_langue = l.id
    WHERE s.id_auteur = $1
      AND statut.code = 'BROUILLON'
    ORDER BY s.date_modification DESC, s.date_creation DESC`,
    [idAuteur, language],
  );
  return result.rows.map((row) => ({
    id: row.id,
    titre: row.titre,
    date_creation: row.date_creation,
    date_modification: row.date_modification,
    statut: mapStatut({
      id: row.id_statut_soso_kevitra,
      code: row.statut_code,
      ordre: row.statut_ordre,
      libelle: row.statut_libelle,
    }),
  }));
}

export async function getMesPropositionsSosoKevitra(auth, lang = "fr") {
  const idAuteur = auth?.personne?.id;
  if (!idAuteur) throw businessError("Authentification requise", "AUTH_REQUIRED");
  const language = normalizeLanguage(lang);
  const result = await database.query(
    `SELECT
      s.id, s.titre, s.date_creation, s.date_modification,
      s.date_publication, s.date_fin_consultation,
      statut.id AS id_statut_soso_kevitra,
      statut.code AS statut_code, statut.ordre AS statut_ordre,
      traduction.libelle AS statut_libelle
    FROM soso_kevitra s
    JOIN statut_soso_kevitra statut ON statut.id = s.id_statut_soso_kevitra
    LEFT JOIN langue l ON lower(l.code) = $2
    LEFT JOIN statut_soso_kevitra_traduction traduction
      ON traduction.id_statut_soso_kevitra = statut.id
      AND traduction.id_langue = l.id
    WHERE s.id_auteur = $1
    ORDER BY s.date_modification DESC, s.date_creation DESC`,
    [idAuteur, language],
  );
  return result.rows.map((row) => ({
    id: row.id,
    titre: row.titre,
    date_creation: row.date_creation,
    date_modification: row.date_modification,
    date_publication: row.date_publication,
    date_fin_consultation: row.date_fin_consultation,
    statut: mapStatut({
      id: row.id_statut_soso_kevitra,
      code: row.statut_code,
      ordre: row.statut_ordre,
      libelle: row.statut_libelle,
    }),
  }));
}

export async function getSosoKevitraPublics(auth, lang = "fr") {
  const idLecteur = auth?.personne?.id;
  if (!idLecteur) throw businessError("Authentification requise", "AUTH_REQUIRED");
  const language = normalizeLanguage(lang);
  const result = await database.query(
    `SELECT s.id, s.titre, s.description, s.objectif, s.beneficiaires,
      s.lieu, s.lieu_non_defini, s.periode_souhaitee,
      s.date_publication, s.date_fin_consultation, s.date_modification,
      statut.id AS id_statut_soso_kevitra, statut.code AS statut_code,
      statut.ordre AS statut_ordre, traduction.libelle AS statut_libelle,
      personne.id AS auteur_id, personne.nom AS auteur_nom,
      personne.prenom AS auteur_prenom, personne.nom_usage AS auteur_nom_usage,
      photo.id AS photo_id, photo.chemin_photo AS photo_chemin_photo,
      photo.ordre AS photo_ordre, photo.date_creation AS photo_date_creation,
      COALESCE(soutiens.nombre_soutiens, 0)::integer AS nombre_soutiens,
      EXISTS(
        SELECT 1 FROM soso_kevitra_soutien soutien_utilisateur
        WHERE soutien_utilisateur.id_soso_kevitra = s.id
          AND soutien_utilisateur.id_personne = $1
      ) AS utilisateur_soutient,
      CASE WHEN statut.code = 'EN_CONSULTATION'
        AND s.date_fin_consultation IS NOT NULL
        AND now() < s.date_fin_consultation THEN true ELSE false END AS consultation_ouverte,
      CASE WHEN statut.code = 'EN_CONSULTATION'
        AND (s.date_fin_consultation IS NULL OR now() >= s.date_fin_consultation)
        THEN 'A_L_ETUDE' ELSE statut.code END AS statut_fonctionnel
    FROM soso_kevitra s
    JOIN statut_soso_kevitra statut ON statut.id = s.id_statut_soso_kevitra
    JOIN personne ON personne.id = s.id_auteur
    LEFT JOIN langue l ON lower(l.code) = $2
    LEFT JOIN statut_soso_kevitra_traduction traduction
      ON traduction.id_statut_soso_kevitra = statut.id AND traduction.id_langue = l.id
    LEFT JOIN LATERAL (
      SELECT id, chemin_photo, ordre, date_creation
      FROM soso_kevitra_photo
      WHERE id_soso_kevitra = s.id
      ORDER BY ordre ASC
      LIMIT 1
    ) photo ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS nombre_soutiens
      FROM soso_kevitra_soutien
      WHERE id_soso_kevitra = s.id
    ) soutiens ON true
    WHERE statut.code IN ('EN_CONSULTATION', 'A_L_ETUDE', 'ACCEPTE', 'REFUSE')
    ORDER BY
      CASE WHEN statut.code = 'EN_CONSULTATION'
        AND s.date_fin_consultation IS NOT NULL
        AND now() < s.date_fin_consultation THEN 0 ELSE 1 END ASC,
      COALESCE(s.date_publication, s.date_modification) DESC,
      s.id ASC`,
    [idLecteur, language],
  );

  const urls = await createSignedStorageUrls(
    "photos_personne",
    result.rows.filter((row) => row.photo_chemin_photo).map((row) => row.photo_chemin_photo),
  );
  return result.rows.map((row) => ({
    id: row.id,
    titre: row.titre,
    description: row.description,
    objectif: row.objectif,
    beneficiaires: row.beneficiaires,
    lieu: row.lieu,
    lieu_non_defini: row.lieu_non_defini,
    periode_souhaitee: row.periode_souhaitee,
    date_publication: row.date_publication,
    date_fin_consultation: row.date_fin_consultation,
    statut: mapStatut({
      id: row.id_statut_soso_kevitra,
      code: row.statut_code,
      ordre: row.statut_ordre,
      libelle: row.statut_libelle,
    }),
    statut_fonctionnel: row.statut_fonctionnel,
    consultation_ouverte: row.consultation_ouverte,
    auteur: {
      id: row.auteur_id,
      nom: row.auteur_nom,
      prenom: row.auteur_prenom,
      nom_usage: row.auteur_nom_usage,
    },
    photo_principale: row.photo_id ? {
      id: row.photo_id,
      chemin_photo: row.photo_chemin_photo,
      ordre: row.photo_ordre,
      date_creation: row.photo_date_creation,
      url_photo: urls.get(row.photo_chemin_photo),
    } : null,
    nombre_soutiens: row.nombre_soutiens,
    utilisateur_soutient: row.utilisateur_soutient,
  }));
}

export async function updateBrouillonSosoKevitra(id, body, auth, lang = "fr") {
  const idAuteur = auth?.personne?.id;
  if (!idAuteur) throw businessError("Authentification requise", "AUTH_REQUIRED");
  const language = normalizeLanguage(lang);
  const payload = normalizePayload(body, { update: true });

  const updated = await database.transaction(async () => {
    const existing = await getOwnedSosoRow(id, idAuteur, { forUpdate: true });
    if (!existing) return null;
    if (!["BROUILLON", "A_CORRIGER"].includes(existing.statut_code)) return null;

    const merged = new SosoKevitra({ ...existing, ...payload.main });
    await database.query(
      `UPDATE soso_kevitra
      SET
        titre = $1,
        description = $2,
        raison = $3,
        objectif = $4,
        beneficiaires = $5,
        lieu = $6,
        lieu_non_defini = $7,
        details_realisation = $8,
        ressources_necessaires = $9,
        budget_non_defini = $10,
        devise = $11,
        periode_souhaitee = $12,
        date_modification = now()
      WHERE id = $13`,
      [
        merged.titre,
        merged.description,
        merged.raison,
        merged.objectif,
        merged.beneficiaires,
        merged.lieu,
        merged.lieu_non_defini,
        merged.details_realisation,
        merged.ressources_necessaires,
        merged.budget_non_defini,
        merged.devise,
        merged.periode_souhaitee,
        id,
      ],
    );

    if (payload.actions !== null) {
      await database.query(
        "DELETE FROM soso_kevitra_action WHERE id_soso_kevitra = $1",
        [id],
      );
      await insertActions(id, payload.actions);
    }

    if (merged.budget_non_defini || payload.budget !== null) {
      await database.query(
        "DELETE FROM soso_kevitra_ligne_budget WHERE id_soso_kevitra = $1",
        [id],
      );
      if (!merged.budget_non_defini) await insertBudget(id, payload.budget ?? []);
    }

    return true;
  });

  if (!updated) return null;
  return getSosoKevitraById(id, auth, language);
}

export async function deleteBrouillonSosoKevitra(id, auth) {
  const idAuteur = auth?.personne?.id;
  if (!idAuteur) throw businessError("Authentification requise", "AUTH_REQUIRED");

  return database.transaction(async () => {
    const existing = await getDraftRow(id, idAuteur, { forUpdate: true });
    if (!existing) return null;
    const photos = await database.query(
      "SELECT chemin_photo FROM soso_kevitra_photo WHERE id_soso_kevitra = $1 FOR UPDATE",
      [id],
    );
    await deleteSosoKevitraStoragePhotos(photos.rows.map((photo) => photo.chemin_photo));
    await database.query("DELETE FROM soso_kevitra WHERE id = $1", [id]);
    return mapDraft(existing);
  });
}

export async function soumettreSosoKevitra(id, auth, lang = "fr") {
  const idAuteur = auth?.personne?.id;
  if (!idAuteur) throw businessError("Authentification requise", "AUTH_REQUIRED");
  const language = normalizeLanguage(lang);

  const submitted = await database.transaction(async () => {
    const sosoKevitra = await getOwnedSosoRow(id, idAuteur, { forUpdate: true });
    if (!sosoKevitra) return null;
    assertTransition(sosoKevitra, ["BROUILLON", "A_CORRIGER"]);
    const actions = await database.query(
      "SELECT id FROM soso_kevitra_action WHERE id_soso_kevitra = $1 ORDER BY ordre ASC",
      [id],
    );
    assertSubmissionFields(sosoKevitra, actions.rows);
    const idStatut = await getStatusId("EN_ATTENTE_VERIFICATION");
    await addVerificationHistory(
      id,
      sosoKevitra.statut_code === "BROUILLON" ? "SOUMIS" : "RESOUMIS",
      null,
      idAuteur,
    );
    await database.query(
      `UPDATE soso_kevitra
      SET id_statut_soso_kevitra = $1, date_modification = now()
      WHERE id = $2`,
      [idStatut, id],
    );
    return true;
  });

  if (!submitted) return null;
  return getSosoKevitraById(id, auth, language);
}

async function applyAdminTransition(id, body, auth, {
  nextStatus,
  historyAction,
  requiresConsultationEndDate = false,
}) {
  const idAdmin = auth?.personne?.id;
  if (!idAdmin) throw businessError("Authentification requise", "AUTH_REQUIRED");
  assertAdmin(auth);
  const commentaire = historyAction === "PUBLIE" ? null : normalizeReason(body);
  const dateFinConsultation = requiresConsultationEndDate
    ? normalizeConsultationEndDate(body)
    : null;

  const transitioned = await database.transaction(async () => {
    const sosoKevitra = await getSosoRow(id, { forUpdate: true });
    if (!sosoKevitra) return null;
    assertTransition(sosoKevitra, ["EN_ATTENTE_VERIFICATION"]);
    const idStatut = await getStatusId(nextStatus);
    if (!requiresConsultationEndDate) {
      await addVerificationHistory(id, historyAction, commentaire, idAdmin);
    }
    if (requiresConsultationEndDate) {
      await database.query(
        `UPDATE soso_kevitra
        SET id_statut_soso_kevitra = $1,
          date_publication = now(),
          date_fin_consultation = $2,
          date_modification = now()
        WHERE id = $3`,
        [idStatut, dateFinConsultation, id],
      );
    } else {
      await database.query(
        `UPDATE soso_kevitra
        SET id_statut_soso_kevitra = $1, date_modification = now()
        WHERE id = $2`,
        [idStatut, id],
      );
    }
    if (requiresConsultationEndDate) {
      await addVerificationHistory(id, historyAction, commentaire, idAdmin);
    }
    return true;
  });

  return transitioned;
}

export async function demanderCorrectionSosoKevitra(id, body, auth, lang = "fr") {
  const language = normalizeLanguage(lang);
  const transitioned = await applyAdminTransition(id, body, auth, {
    nextStatus: "A_CORRIGER",
    historyAction: "DEMANDE_CORRECTION",
  });
  return transitioned && getSosoKevitraById(id, auth, language);
}

export async function nonPublierSosoKevitra(id, body, auth, lang = "fr") {
  const language = normalizeLanguage(lang);
  const transitioned = await applyAdminTransition(id, body, auth, {
    nextStatus: "NON_PUBLIE",
    historyAction: "NON_PUBLIE",
  });
  return transitioned && getSosoKevitraById(id, auth, language);
}

export async function publierSosoKevitra(id, body, auth, lang = "fr") {
  const language = normalizeLanguage(lang);
  const transitioned = await applyAdminTransition(id, body, auth, {
    nextStatus: "EN_CONSULTATION",
    historyAction: "PUBLIE",
    requiresConsultationEndDate: true,
  });
  return transitioned && getSosoKevitraById(id, auth, language);
}

export async function getSosoKevitraAVerifier(auth, lang = "fr") {
  assertAdmin(auth);
  const language = normalizeLanguage(lang);
  const result = await database.query(
    `SELECT s.id, s.titre, s.date_creation, s.date_modification,
      personne.id AS auteur_id, personne.nom AS auteur_nom,
      personne.prenom AS auteur_prenom, personne.nom_usage AS auteur_nom_usage,
      statut.id AS id_statut_soso_kevitra, statut.code AS statut_code,
      statut.ordre AS statut_ordre, traduction.libelle AS statut_libelle,
      soumission.date_soumission
    FROM soso_kevitra s
    JOIN statut_soso_kevitra statut ON statut.id = s.id_statut_soso_kevitra
    JOIN personne ON personne.id = s.id_auteur
    LEFT JOIN langue l ON lower(l.code) = $1
    LEFT JOIN statut_soso_kevitra_traduction traduction
      ON traduction.id_statut_soso_kevitra = statut.id AND traduction.id_langue = l.id
    LEFT JOIN LATERAL (
      SELECT verification.date_action AS date_soumission
      FROM soso_kevitra_verification verification
      WHERE verification.id_soso_kevitra = s.id
        AND verification.action IN ('SOUMIS', 'RESOUMIS')
      ORDER BY verification.date_action DESC, verification.id DESC
      LIMIT 1
    ) soumission ON true
    WHERE statut.code = 'EN_ATTENTE_VERIFICATION'
    ORDER BY soumission.date_soumission ASC NULLS LAST, s.date_creation ASC`,
    [language],
  );
  return result.rows.map((row) => ({
    id: row.id,
    titre: row.titre,
    auteur: {
      id: row.auteur_id,
      nom: row.auteur_nom,
      prenom: row.auteur_prenom,
      nom_usage: row.auteur_nom_usage,
    },
    statut: mapStatut({
      id: row.id_statut_soso_kevitra,
      code: row.statut_code,
      ordre: row.statut_ordre,
      libelle: row.statut_libelle,
    }),
    date_creation: row.date_creation,
    date_modification: row.date_modification,
    date_soumission: row.date_soumission,
  }));
}
