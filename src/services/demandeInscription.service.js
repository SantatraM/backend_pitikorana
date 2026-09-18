import database from "../config/db.js";
import { createSupabaseAdminClient } from "../lib/supabaseAdmin.js";
import DemandeInscription from "../models/DemandeInscription.js";
import { normalizeTelephonePourAuth } from "../utils/telephoneAuth.js";
import {
  generateCodeSuivi,
  generateReference,
  hashCodeSuivi,
  normalizeCodeSuivi,
  verifyCodeSuivi,
} from "../utils/suiviInscription.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFERENCE_PATTERN = /^PIT-\d{4}-[A-HJ-NP-Z2-9]{8}$/;
const RESERVED_FIELDS = new Set([
  "role",
  "roles",
  "id_role",
  "id_role_attribue",
  "statut_compte",
  "id_statut_compte",
  "id_auth_user",
  "permissions",
  "droits",
  "admin",
  "is_admin",
  "statut",
  "id_statut",
  "id_statut_demande",
  "id_compte_admin_traitement",
  "date_traitement",
  "commentaire_admin",
  "token_suivi_hash",
]);
const MAX_REFERENCE_ATTEMPTS = 5;
const MAX_PERSONNE_SEARCH_RESULTS = 20;
const ASSIGNABLE_ROLE_CODES = new Set(["MEMBRE", "ADMIN"]);
const DRAFT_ROOT_FIELDS = new Set([
  "personne",
  "contact",
  "activites",
  "competences",
  "centres_interet",
]);
const DRAFT_PERSONNE_FIELDS = new Set([
  "nom",
  "prenom",
  "nom_usage",
  "autres_appellations",
  "id_sexe",
  "date_naissance",
  "annee_naissance",
  "lieu_naissance",
  "adresse",
  "id_ville",
  "id_lien",
  "id_element",
]);
const DRAFT_CONTACT_FIELDS = new Set(["whatsapp", "facebook", "lien_facebook"]);
const DRAFT_ACTIVITE_FIELDS = new Set([
  "id_activite",
  "lieu_travail",
  "etude_en_cours",
  "formations",
  "experience_anterieur",
  "diplome_ou_apprentissage",
]);
const DRAFT_COMPETENCE_FIELDS = new Set(["id_competence", "partageable"]);
const DRAFT_CENTRE_INTERET_FIELDS = new Set(["id_centre_interet"]);

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeEmail(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("Email invalide");
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email invalide");
  }
  return email;
}

function normalizeTelephone(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("Numéro de téléphone invalide");
  const telephone = value.trim();
  if (!telephone) return null;
  if (telephone.length > 30) throw new Error("Numéro de téléphone invalide");
  return telephone;
}

function assertPlainObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
}

function assertAllowedFields(value, allowedFields, message) {
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) throw new Error(message);
  }
}

function normalizeOptionalText(value, label, maxLength = null) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} invalide`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (maxLength && normalized.length > maxLength) {
    throw new Error(`${label} invalide`);
  }
  return normalized;
}

function normalizeRequiredText(value, label, maxLength) {
  const normalized = normalizeOptionalText(value, label, maxLength);
  if (!normalized) throw new Error(`${label} est obligatoire`);
  return normalized;
}

function normalizeUuid(value, label, required = false) {
  if (value == null || value === "") {
    if (required) throw new Error(`${label} est obligatoire`);
    return null;
  }
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new Error(`${label} invalide`);
  }
  return value.trim();
}

function normalizeCivilDate(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date de naissance invalide");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Date de naissance invalide");
  }
  return value;
}

function normalizeBirthYear(value) {
  if (value == null || value === "") return null;
  if (!Number.isInteger(value) || value < 1800 || value > 2100) {
    throw new Error("Année de naissance invalide");
  }
  return value;
}

function normalizePersonneDraft(value) {
  assertPlainObject(value, "Les données personne sont invalides");
  assertAllowedFields(value, DRAFT_PERSONNE_FIELDS, "Champ personne non autorisé");

  const personne = {
    nom: normalizeRequiredText(value.nom, "Nom", 100),
    prenom: normalizeOptionalText(value.prenom, "Prénom", 100),
    nom_usage: normalizeOptionalText(value.nom_usage, "Nom d'usage", 100),
    autres_appellations: normalizeOptionalText(
      value.autres_appellations,
      "Autres appellations",
      255,
    ),
    id_sexe: normalizeUuid(value.id_sexe, "Identifiant de sexe"),
    date_naissance: normalizeCivilDate(value.date_naissance),
    annee_naissance: normalizeBirthYear(value.annee_naissance),
    lieu_naissance: normalizeOptionalText(value.lieu_naissance, "Lieu de naissance", 150),
    adresse: normalizeOptionalText(value.adresse, "Adresse", 255),
    id_ville: normalizeUuid(value.id_ville, "Identifiant de ville"),
    id_lien: normalizeUuid(value.id_lien, "Identifiant de lien"),
    id_element: normalizeUuid(value.id_element, "Identifiant d'élément"),
  };

  if (
    personne.date_naissance &&
    personne.annee_naissance &&
    Number(personne.date_naissance.slice(0, 4)) !== personne.annee_naissance
  ) {
    throw new Error("L'année de naissance ne correspond pas à la date de naissance");
  }
  return personne;
}

function normalizeContactDraft(value) {
  if (value == null) return null;
  assertPlainObject(value, "Les données contact sont invalides");
  assertAllowedFields(value, DRAFT_CONTACT_FIELDS, "Champ contact non autorisé");
  return {
    whatsapp: normalizeOptionalText(value.whatsapp, "WhatsApp", 30),
    facebook: normalizeOptionalText(value.facebook, "Facebook", 150),
    lien_facebook: normalizeOptionalText(value.lien_facebook, "Lien Facebook"),
  };
}

function normalizeArrayDraft(value, label, maxLength, normalizeItem) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} doivent être une liste`);
  if (value.length > maxLength) throw new Error(`Maximum ${maxLength} ${label.toLowerCase()} autorisés`);
  return value.map(normalizeItem);
}

function ensureNoDuplicate(items, key, label) {
  const ids = items.map((item) => item[key]);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Une seule occurrence par ${label} est autorisée`);
  }
}

function normalizeActiviteDraft(value) {
  assertPlainObject(value, "Une activité est invalide");
  assertAllowedFields(value, DRAFT_ACTIVITE_FIELDS, "Champ activité non autorisé");
  return {
    id_activite: normalizeUuid(value.id_activite, "Identifiant d'activité", true),
    lieu_travail: normalizeOptionalText(value.lieu_travail, "Lieu de travail"),
    etude_en_cours: normalizeOptionalText(value.etude_en_cours, "Étude en cours"),
    formations: normalizeOptionalText(value.formations, "Formations"),
    experience_anterieur: normalizeOptionalText(value.experience_anterieur, "Expérience antérieure"),
    diplome_ou_apprentissage: normalizeOptionalText(
      value.diplome_ou_apprentissage,
      "Diplôme ou apprentissage",
    ),
  };
}

function normalizeCompetenceDraft(value) {
  assertPlainObject(value, "Une compétence est invalide");
  assertAllowedFields(value, DRAFT_COMPETENCE_FIELDS, "Champ compétence non autorisé");
  if (value.partageable !== undefined && typeof value.partageable !== "boolean") {
    throw new Error("Partageable invalide");
  }
  return {
    id_competence: normalizeUuid(value.id_competence, "Identifiant de compétence", true),
    partageable: value.partageable ?? false,
  };
}

function normalizeCentreInteretDraft(value) {
  assertPlainObject(value, "Un centre d'intérêt est invalide");
  assertAllowedFields(value, DRAFT_CENTRE_INTERET_FIELDS, "Champ centre d'intérêt non autorisé");
  return {
    id_centre_interet: normalizeUuid(
      value.id_centre_interet,
      "Identifiant de centre d'intérêt",
      true,
    ),
  };
}

function normalizeDonnees(value, hasExistingPersonne) {
  const donnees = value === undefined ? {} : value;
  assertPlainObject(donnees, "Les données de profil sont invalides");

  if (hasExistingPersonne) {
    if (Object.keys(donnees).length !== 0) {
      throw new Error("Les données doivent être vides pour une personne existante");
    }
    return {};
  }

  assertAllowedFields(donnees, DRAFT_ROOT_FIELDS, "Champ de données non autorisé");
  if (!Object.hasOwn(donnees, "personne")) {
    throw new Error("Les données personne sont obligatoires pour une nouvelle personne");
  }

  const activites = normalizeArrayDraft(
    donnees.activites,
    "Activités",
    20,
    normalizeActiviteDraft,
  );
  const competences = normalizeArrayDraft(
    donnees.competences,
    "Compétences",
    50,
    normalizeCompetenceDraft,
  );
  const centresInteret = normalizeArrayDraft(
    donnees.centres_interet,
    "Centres d'intérêt",
    50,
    normalizeCentreInteretDraft,
  );
  ensureNoDuplicate(activites, "id_activite", "activité");
  ensureNoDuplicate(competences, "id_competence", "compétence");
  ensureNoDuplicate(centresInteret, "id_centre_interet", "centre d'intérêt");

  return {
    personne: normalizePersonneDraft(donnees.personne),
    contact: normalizeContactDraft(donnees.contact),
    activites,
    competences,
    centres_interet: centresInteret,
  };
}

function normalizePayload(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Données de demande invalides");
  }
  for (const field of RESERVED_FIELDS) {
    if (Object.hasOwn(body, field)) {
      throw new Error("Les champs de rôle et permissions ne sont pas autorisés");
    }
  }

  const idPersonne = body.id_personne ?? null;
  if (idPersonne !== null && (!UUID_PATTERN.test(idPersonne) || typeof idPersonne !== "string")) {
    throw new Error("Identifiant de personne invalide");
  }

  const email = normalizeEmail(body.email);
  const telephone = normalizeTelephone(body.telephone);
  if (!email && !telephone) {
    throw new Error("Un email ou un numéro de téléphone est obligatoire");
  }

  return {
    id_personne: idPersonne,
    email,
    telephone,
    donnees: normalizeDonnees(body.donnees, idPersonne !== null),
  };
}

function normalizeAdminTreatmentBody(body = {}, allowRole = false) {
  assertPlainObject(body, "Les données de traitement sont invalides");
  const allowedFields = new Set(["commentaire_admin"]);
  if (allowRole) allowedFields.add("role");
  assertAllowedFields(
    body,
    allowedFields,
    "Champ de traitement non autorisé",
  );

  let role = null;
  if (allowRole) {
    role = "MEMBRE";
  }
  if (body.role !== undefined) {
    if (typeof body.role !== "string") {
      throw new Error("Rôle attribué invalide");
    }
    role = body.role.trim().toUpperCase();
    if (!ASSIGNABLE_ROLE_CODES.has(role)) {
      throw new Error("Rôle attribué invalide");
    }
  }

  return {
    role,
    commentaire_admin: normalizeOptionalText(
      body.commentaire_admin,
      "Commentaire administrateur",
    ),
  };
}

function normalizeCreateCompteBody(body = {}) {
  assertPlainObject(body, "Les données de création du compte sont invalides");
  assertAllowedFields(
    body,
    new Set(["reference", "code_suivi", "mot_de_passe"]),
    "Champ de création du compte non autorisé",
  );

  const reference =
    typeof body.reference === "string" ? body.reference.trim().toUpperCase() : null;
  const codeSuivi = normalizeCodeSuivi(body.code_suivi);
  if (!reference || !REFERENCE_PATTERN.test(reference) || !codeSuivi) {
    throw new Error("Référence ou code de suivi invalide");
  }
  if (typeof body.mot_de_passe !== "string") {
    throw new Error("Le mot de passe est obligatoire");
  }
  if (body.mot_de_passe.length < 8 || body.mot_de_passe.length > 128) {
    throw new Error("Le mot de passe doit contenir entre 8 et 128 caractères");
  }

  return { reference, code_suivi: codeSuivi, mot_de_passe: body.mot_de_passe };
}

function mapDemandeRow(row) {
  return new DemandeInscription({
    id: row.id,
    id_personne: row.id_personne,
    email: row.email,
    telephone: row.telephone,
    reference: row.reference,
    donnees: row.donnees,
    statut: {
      id: row.id_statut_demande,
      code: row.code_statut_demande,
    },
    role_attribue: row.id_role_attribue
      ? {
          id: row.id_role_attribue,
          code: row.code_role_attribue,
        }
      : null,
    date_demande: row.date_demande,
    date_traitement: row.date_traitement,
    id_compte_admin_traitement: row.id_compte_admin_traitement,
    commentaire_admin: row.commentaire_admin,
  });
}

async function validatePersonne(idPersonne) {
  if (!idPersonne) return;
  const result = await database.query("SELECT id FROM personne WHERE id = $1", [
    idPersonne,
  ]);
  if (!result.rows[0]) {
    throw businessError("Personne introuvable", "PERSONNE_NOT_FOUND");
  }
}

async function validateReferences(table, ids, label) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const result = await database.query(
    `SELECT id FROM ${table} WHERE id = ANY($1::uuid[])`,
    [uniqueIds],
  );
  if (result.rows.length !== uniqueIds.length) {
    throw businessError(`${label} inexistante`, "DRAFT_FK_NOT_FOUND");
  }
}

async function validateDonneesReferences(donnees) {
  if (!donnees.personne) return;

  await Promise.all([
    validateReferences("sexe", [donnees.personne.id_sexe], "Référence de sexe"),
    validateReferences("ville", [donnees.personne.id_ville], "Référence de ville"),
    validateReferences(
      "lien_avec_falimanjaka",
      [donnees.personne.id_lien],
      "Référence de lien",
    ),
    validateReferences("element", [donnees.personne.id_element], "Référence d'élément"),
    validateReferences(
      "activite",
      donnees.activites.map((activite) => activite.id_activite),
      "Référence d'activité",
    ),
    validateReferences(
      "competence",
      donnees.competences.map((competence) => competence.id_competence),
      "Référence de compétence",
    ),
    validateReferences(
      "centre_interet",
      donnees.centres_interet.map(
        (centreInteret) => centreInteret.id_centre_interet,
      ),
      "Référence de centre d'intérêt",
    ),
  ]);
}

export async function normalizeEtValiderDonneesNouvellePersonne(donnees) {
  const normalized = normalizeDonnees(donnees, false);
  await validateDonneesReferences(normalized);
  return normalized;
}

async function getPendingStatus() {
  const result = await database.query(
    `SELECT id, code
    FROM statut_demande_inscription
    WHERE code = 'EN_ATTENTE'
    FOR UPDATE`,
  );
  if (!result.rows[0]) {
    throw businessError(
      "Le statut EN_ATTENTE est introuvable",
      "PENDING_STATUS_MISSING",
    );
  }
  return result.rows[0];
}

async function getStatutDemandeByCode(code) {
  const result = await database.query(
    "SELECT id, code FROM statut_demande_inscription WHERE code = $1",
    [code],
  );
  if (!result.rows[0]) {
    throw businessError(`Le statut ${code} est introuvable`, "REQUEST_STATUS_MISSING");
  }
  return result.rows[0];
}

async function getStatutPersonneVivant() {
  const result = await database.query(
    "SELECT id FROM statut WHERE code = $1",
    ["VIVANT"],
  );
  if (!result.rows[0]) {
    throw businessError("Le statut VIVANT est introuvable", "VIVANT_STATUS_MISSING");
  }
  return result.rows[0];
}

async function lockDemandeEnAttente(id) {
  const result = await database.query(
    `SELECT
      di.id,
      di.id_personne,
      di.email,
      di.telephone,
      di.reference,
      di.donnees,
      sdi.code AS code_statut_demande
    FROM demande_inscription di
    JOIN statut_demande_inscription sdi
      ON sdi.id = di.id_statut_demande
    WHERE di.id = $1
    FOR UPDATE OF di`,
    [id],
  );
  const demande = result.rows[0];
  if (!demande) return null;
  if (demande.code_statut_demande !== "EN_ATTENTE") {
    throw businessError(
      "Cette demande a déjà été traitée",
      "DEMANDE_NOT_PENDING",
    );
  }
  return demande;
}

async function getDemandeForAccountCreation(reference) {
  const result = await database.query(
    `SELECT
      di.id,
      di.id_personne,
      di.email,
      di.telephone,
      di.token_suivi_hash,
      di.id_role_attribue,
      sdi.code AS code_statut_demande
    FROM demande_inscription di
    JOIN statut_demande_inscription sdi
      ON sdi.id = di.id_statut_demande
    WHERE di.reference = $1`,
    [reference],
  );
  return result.rows[0] ?? null;
}

function ensureDemandeCanCreateAccount(demande) {
  if (demande.code_statut_demande !== "VALIDEE") {
    const message =
      demande.code_statut_demande === "EN_ATTENTE"
        ? "Cette demande n'est pas encore validée"
        : "Cette demande ne peut plus permettre la création d'un compte";
    throw businessError(message, "DEMANDE_NOT_VALIDATED");
  }
  if (!demande.id_personne) {
    throw businessError(
      "La demande validée n'est associée à aucune personne",
      "VALIDATED_DEMANDE_WITHOUT_PERSONNE",
    );
  }
}

async function ensureNoCompteMembre(idPersonne) {
  const result = await database.query(
    "SELECT id FROM compte_membre WHERE id_personne = $1 LIMIT 1",
    [idPersonne],
  );
  if (result.rows[0]) {
    throw businessError(
      "Un compte membre existe déjà pour cette personne",
      "COMPTE_MEMBRE_EXISTS",
    );
  }
}

async function lockDemandeValidee(id) {
  const result = await database.query(
    `SELECT
      di.id,
      di.id_personne,
      di.email,
      di.telephone,
      di.id_role_attribue,
      sdi.code AS code_statut_demande
    FROM demande_inscription di
    JOIN statut_demande_inscription sdi
      ON sdi.id = di.id_statut_demande
    WHERE di.id = $1
    FOR UPDATE OF di`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function getRoleByCode(code) {
  const result = await database.query("SELECT id, code FROM role WHERE code = $1", [
    code,
  ]);
  if (!result.rows[0]) {
    throw businessError(`Le rôle ${code} est introuvable`, "ROLE_MISSING");
  }
  return result.rows[0];
}

async function getRolePourCreationCompte(demande) {
  // Compatibilité des demandes VALIDEE historiques antérieures à id_role_attribue.
  if (!demande.id_role_attribue) return getRoleByCode("MEMBRE");

  const result = await database.query("SELECT id, code FROM role WHERE id = $1", [
    demande.id_role_attribue,
  ]);
  if (!result.rows[0]) {
    throw businessError("Le rôle attribué est introuvable", "ASSIGNED_ROLE_MISSING");
  }
  return result.rows[0];
}

async function getStatutCompteActif() {
  const result = await database.query(
    "SELECT id FROM statut_compte_membre WHERE code = $1",
    ["ACTIF"],
  );
  if (!result.rows[0]) {
    throw businessError("Le statut de compte ACTIF est introuvable", "ACTIF_STATUS_MISSING");
  }
  return result.rows[0];
}

async function createAuthUser(demande, motDePasse) {
  const attributes = { password: motDePasse };
  if (demande.email) {
    attributes.email = demande.email;
    attributes.email_confirm = true;
  }
  if (demande.telephone) {
    attributes.phone = normalizeTelephonePourAuth(demande.telephone);
    attributes.phone_confirm = true;
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser(attributes);
  if (error || !data.user?.id) {
    throw businessError(
      "Impossible de créer le compte d'authentification",
      "AUTH_CREATE_FAILED",
    );
  }
  return { id: data.user.id, supabaseAdmin };
}

async function compensateAuthUser(supabaseAdmin, idAuthUser) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(idAuthUser);
  if (error) throw error;
}

function getNormalizedStoredDraft(donnees) {
  assertPlainObject(donnees, "Le brouillon de la demande est invalide");
  assertPlainObject(donnees.personne, "Le brouillon personne est invalide");
  if (
    !Array.isArray(donnees.activites) ||
    !Array.isArray(donnees.competences) ||
    !Array.isArray(donnees.centres_interet)
  ) {
    throw new Error("Le brouillon de la demande est invalide");
  }
  if (donnees.contact !== null && donnees.contact !== undefined) {
    assertPlainObject(donnees.contact, "Le brouillon contact est invalide");
  }
  return donnees;
}

async function createPersonneDepuisBrouillon(demande) {
  const donnees = getNormalizedStoredDraft(demande.donnees);
  const personne = donnees.personne;
  const statutVivant = await getStatutPersonneVivant();

  const personneResult = await database.query(
    `INSERT INTO personne (
      nom,
      prenom,
      nom_usage,
      autres_appellations,
      id_sexe,
      id_statut,
      date_naissance,
      annee_naissance,
      lieu_naissance,
      date_deces,
      annee_deces,
      adresse,
      id_ville,
      id_lien,
      id_element
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
    )
    RETURNING id`,
    [
      personne.nom,
      personne.prenom,
      personne.nom_usage,
      personne.autres_appellations,
      personne.id_sexe,
      statutVivant.id,
      personne.date_naissance,
      personne.annee_naissance,
      personne.lieu_naissance,
      null,
      null,
      personne.adresse,
      personne.id_ville,
      personne.id_lien,
      personne.id_element,
    ],
  );
  const idPersonne = personneResult.rows[0].id;
  const contact = donnees.contact ?? {};
  const contactValues = {
    telephone: demande.telephone,
    whatsapp: contact.whatsapp ?? null,
    email: demande.email,
    facebook: contact.facebook ?? null,
    lien_facebook: contact.lien_facebook ?? null,
  };

  if (Object.values(contactValues).some((value) => value !== null)) {
    await database.query(
      `INSERT INTO contacts_personne (
        id_personne,
        telephone,
        whatsapp,
        email,
        facebook,
        lien_facebook
      )
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        idPersonne,
        contactValues.telephone,
        contactValues.whatsapp,
        contactValues.email,
        contactValues.facebook,
        contactValues.lien_facebook,
      ],
    );
  }

  for (const activite of donnees.activites) {
    await database.query(
      `INSERT INTO personne_activite (
        id_personne,
        id_activite,
        lieu_travail,
        etude_en_cours,
        formations,
        experience_anterieur,
        diplome_ou_apprentissage
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        idPersonne,
        activite.id_activite,
        activite.lieu_travail,
        activite.etude_en_cours,
        activite.formations,
        activite.experience_anterieur,
        activite.diplome_ou_apprentissage,
      ],
    );
  }

  for (const competence of donnees.competences) {
    await database.query(
      `INSERT INTO personne_competence (id_personne, id_competence, partageable)
      VALUES ($1, $2, $3)`,
      [idPersonne, competence.id_competence, competence.partageable],
    );
  }

  for (const centreInteret of donnees.centres_interet) {
    await database.query(
      `INSERT INTO personne_centre_interet (id_personne, id_centre_interet)
      VALUES ($1, $2)`,
      [idPersonne, centreInteret.id_centre_interet],
    );
  }

  return idPersonne;
}

async function finaliserDemande({
  demandeId,
  idPersonne,
  idCompteAdmin,
  roleAttribue,
  statutCode,
  commentaireAdmin,
}) {
  const statut = await getStatutDemandeByCode(statutCode);
  const result = await database.query(
    `UPDATE demande_inscription
    SET
      id_personne = $1,
      id_statut_demande = $2,
      date_traitement = now(),
      id_compte_admin_traitement = $3,
      id_role_attribue = $4,
      commentaire_admin = $5
    WHERE id = $6
    RETURNING id, reference, id_personne, date_traitement, commentaire_admin`,
    [
      idPersonne,
      statut.id,
      idCompteAdmin,
      roleAttribue?.id ?? null,
      commentaireAdmin,
      demandeId,
    ],
  );
  return {
    ...result.rows[0],
    statut: statut.code,
    role_attribue: roleAttribue
      ? { id: roleAttribue.id, code: roleAttribue.code }
      : null,
  };
}

async function ensureNoPendingDuplicate(input, statusId) {
  const checks = [
    ["email", input.email, "Une demande d'inscription est déjà en attente pour cet email", "PENDING_EMAIL_EXISTS"],
    ["telephone", input.telephone, "Une demande d'inscription est déjà en attente pour ce numéro de téléphone", "PENDING_PHONE_EXISTS"],
    ["id_personne", input.id_personne, "Une demande d'inscription est déjà en attente pour cette personne", "PENDING_PERSON_EXISTS"],
  ];

  for (const [column, value, message, code] of checks) {
    if (value === null) continue;
    const result = await database.query(
      `SELECT id
      FROM demande_inscription
      WHERE id_statut_demande = $1 AND ${column} = $2
      LIMIT 1`,
      [statusId, value],
    );
    if (result.rows[0]) throw businessError(message, code);
  }
}

function isReferenceCollision(error) {
  return error.code === "23505" && error.constraint?.includes("reference");
}

function normalizeSearchQuery(value) {
  if (typeof value !== "string") {
    throw new Error("La recherche doit contenir au moins 2 caractères");
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2) {
    throw new Error("La recherche doit contenir au moins 2 caractères");
  }
  return normalized;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function searchPersonnesPourInscription(query) {
  const terms = normalizeSearchQuery(query).split(" ").slice(0, 5);
  const params = terms.map((term) => `%${escapeLike(term)}%`);
  const conditions = params.map(
    (_, index) =>
      `(nom ILIKE $${index + 1} ESCAPE '\\' OR prenom ILIKE $${index + 1} ESCAPE '\\')`,
  );

  const result = await database.query(
    `SELECT
      id,
      nom,
      prenom,
      nom_usage,
      annee_naissance,
      lieu_naissance
    FROM personne
    WHERE ${conditions.join(" AND ")}
    ORDER BY nom ASC, prenom ASC NULLS LAST
    LIMIT ${MAX_PERSONNE_SEARCH_RESULTS}`,
    params,
  );

  return result.rows;
}

export async function getAllDemandesInscription() {
  const result = await database.query(
    "SELECT * FROM v_demande_inscription ORDER BY date_demande DESC",
  );
  return result.rows.map(mapDemandeRow);
}

export async function getDemandeInscriptionById(id) {
  const result = await database.query(
    "SELECT * FROM v_demande_inscription WHERE id = $1",
    [id],
  );
  return result.rows[0] ? mapDemandeRow(result.rows[0]) : null;
}

export async function createDemandeInscription(body) {
  const input = normalizePayload(body);

  return database.transaction(async () => {
    await validatePersonne(input.id_personne);
    await validateDonneesReferences(input.donnees);
    const pendingStatus = await getPendingStatus();
    await ensureNoPendingDuplicate(input, pendingStatus.id);

    const codeSuivi = generateCodeSuivi();
    const tokenHash = await hashCodeSuivi(codeSuivi);

    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt += 1) {
      const reference = generateReference();
      try {
        const result = await database.query(
          `INSERT INTO demande_inscription (
            id_personne,
            email,
            telephone,
            reference,
            token_suivi_hash,
            donnees,
            id_statut_demande,
            id_role_attribue
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, reference, date_demande`,
          [
            input.id_personne,
            input.email,
            input.telephone,
            reference,
            tokenHash,
            input.donnees,
            pendingStatus.id,
            null,
          ],
        );
        const row = result.rows[0];
        return {
          demande: {
            id: row.id,
            reference: row.reference,
            statut: pendingStatus.code,
            date_demande: row.date_demande,
          },
          code_suivi: codeSuivi,
        };
      } catch (error) {
        if (!isReferenceCollision(error)) throw error;
      }
    }

    throw businessError(
      "Impossible de générer une référence d'inscription unique",
      "REFERENCE_GENERATION_FAILED",
    );
  });
}

export async function creerCompteMembreDepuisDemande(body) {
  const input = normalizeCreateCompteBody(body);
  const demande = await getDemandeForAccountCreation(input.reference);

  if (!demande || !(await verifyCodeSuivi(input.code_suivi, demande.token_suivi_hash))) {
    throw businessError(
      "Référence ou code de suivi invalide",
      "SUIVI_INVALID",
    );
  }

  ensureDemandeCanCreateAccount(demande);
  await ensureNoCompteMembre(demande.id_personne);

  let authUser = null;
  try {
    authUser = await createAuthUser(demande, input.mot_de_passe);

    return await database.transaction(async () => {
      const demandeVerrouillee = await lockDemandeValidee(demande.id);
      if (!demandeVerrouillee) {
        throw businessError(
          "Demande d'inscription introuvable",
          "DEMANDE_NOT_FOUND",
        );
      }
      ensureDemandeCanCreateAccount(demandeVerrouillee);
      await ensureNoCompteMembre(demandeVerrouillee.id_personne);

      const [roleAttribue, statutActif] = await Promise.all([
        getRolePourCreationCompte(demandeVerrouillee),
        getStatutCompteActif(),
      ]);
      const result = await database.query(
        `INSERT INTO compte_membre (
          id_personne,
          id_auth_user,
          id_role,
          id_statut_compte,
          date_creation,
          date_activation
        )
        VALUES ($1, $2, $3, $4, now(), now())
        RETURNING id`,
        [
          demandeVerrouillee.id_personne,
          authUser.id,
          roleAttribue.id,
          statutActif.id,
        ],
      );

      return {
        id_compte_membre: result.rows[0].id,
        id_personne: demandeVerrouillee.id_personne,
        role: roleAttribue.code,
        statut: "ACTIF",
      };
    });
  } catch (error) {
    if (authUser) {
      try {
        await compensateAuthUser(authUser.supabaseAdmin, authUser.id);
      } catch (cleanupError) {
        // TODO: ajouter une réconciliation des utilisateurs Auth orphelins.
        console.error(
          "Compensation Auth échouée pour l'utilisateur créé",
          authUser.id,
          cleanupError?.code ?? "erreur inconnue",
        );
        throw businessError(
          "Impossible de finaliser la création du compte",
          "AUTH_COMPENSATION_FAILED",
        );
      }
    }
    throw error;
  }
}

export async function validerDemandeInscription(id, body, idCompteAdmin) {
  const { commentaire_admin: commentaireAdmin, role: roleCode } =
    normalizeAdminTreatmentBody(body, true);
  const adminId = normalizeUuid(
    idCompteAdmin,
    "Identifiant de compte administrateur",
    true,
  );

  return database.transaction(async () => {
    const demande = await lockDemandeEnAttente(id);
    if (!demande) {
      throw businessError(
        "Demande d'inscription introuvable",
        "DEMANDE_NOT_FOUND",
      );
    }

    const roleAttribue = await getRoleByCode(roleCode);
    const idPersonne = demande.id_personne ?? (await createPersonneDepuisBrouillon(demande));
    return finaliserDemande({
      demandeId: demande.id,
      idPersonne,
      idCompteAdmin: adminId,
      roleAttribue,
      statutCode: "VALIDEE",
      commentaireAdmin,
    });
  });
}

export async function refuserDemandeInscription(id, body, idCompteAdmin) {
  const { commentaire_admin: commentaireAdmin } = normalizeAdminTreatmentBody(body);
  const adminId = normalizeUuid(
    idCompteAdmin,
    "Identifiant de compte administrateur",
    true,
  );

  return database.transaction(async () => {
    const demande = await lockDemandeEnAttente(id);
    if (!demande) {
      throw businessError(
        "Demande d'inscription introuvable",
        "DEMANDE_NOT_FOUND",
      );
    }

    return finaliserDemande({
      demandeId: demande.id,
      idPersonne: demande.id_personne,
      idCompteAdmin: adminId,
      roleAttribue: null,
      statutCode: "REFUSEE",
      commentaireAdmin,
    });
  });
}

export async function getSuiviDemandeInscription(referenceValue, codeValue) {
  const reference =
    typeof referenceValue === "string" ? referenceValue.trim().toUpperCase() : null;
  const codeSuivi = normalizeCodeSuivi(codeValue);
  if (!reference || !REFERENCE_PATTERN.test(reference) || !codeSuivi) {
    throw new Error("Référence ou code de suivi invalide");
  }

  const result = await database.query(
    `SELECT
      di.reference,
      di.token_suivi_hash,
      sdi.code AS code_statut_demande,
      di.date_demande,
      di.date_traitement,
      di.commentaire_admin
    FROM demande_inscription di
    JOIN statut_demande_inscription sdi
      ON sdi.id = di.id_statut_demande
    WHERE di.reference = $1`,
    [reference],
  );
  const demande = result.rows[0];

  if (!demande || !(await verifyCodeSuivi(codeSuivi, demande.token_suivi_hash))) {
    throw businessError(
      "Référence ou code de suivi invalide",
      "SUIVI_INVALID",
    );
  }

  return {
    reference: demande.reference,
    statut: demande.code_statut_demande,
    date_demande: demande.date_demande,
    date_traitement: demande.date_traitement,
    commentaire_admin: demande.commentaire_admin,
  };
}
