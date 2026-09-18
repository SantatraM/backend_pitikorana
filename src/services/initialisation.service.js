import { timingSafeEqual } from "node:crypto";
import database from "../config/db.js";
import { getRequestContext } from "../config/requestContext.js";
import { createSupabaseAdminClient } from "../lib/supabaseAdmin.js";
import { normalizeEtValiderDonneesNouvellePersonne } from "./demandeInscription.service.js";
import { normalizeTelephonePourAuth } from "../utils/telephoneAuth.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOOTSTRAP_LOCK_KEY = 8_034_189_140;

function businessError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertPlainObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
}

function normalizeEmail(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("Email invalide");
  const email = value.trim().toLowerCase();
  if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email invalide");
  }
  return email;
}

function normalizeTelephone(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("Numéro de téléphone invalide");
  const telephone = value.trim();
  if (!telephone || telephone.length > 30) {
    throw new Error("Numéro de téléphone invalide");
  }
  return telephone;
}

function normalizePassword(value) {
  if (typeof value !== "string") throw new Error("Le mot de passe est obligatoire");
  if (value.length < 8 || value.length > 128) {
    throw new Error("Le mot de passe doit contenir entre 8 et 128 caractères");
  }
  return value;
}

function normalizeBootstrapBody(body = {}) {
  assertPlainObject(body, "Les données d'initialisation sont invalides");
  if (body.mode !== "EXISTANTE" && body.mode !== "NOUVELLE") {
    throw new Error("Mode d'initialisation invalide");
  }

  const allowed =
    body.mode === "EXISTANTE"
      ? new Set(["mode", "id_personne", "email", "telephone", "mot_de_passe"])
      : new Set(["mode", "email", "telephone", "mot_de_passe", "donnees"]);
  for (const field of Object.keys(body)) {
    if (!allowed.has(field)) throw new Error("Champ d'initialisation non autorisé");
  }

  const email = normalizeEmail(body.email);
  const telephone = normalizeTelephone(body.telephone);
  if (!email && !telephone) {
    throw new Error("Un email ou un numéro de téléphone est obligatoire");
  }

  if (body.mode === "EXISTANTE") {
    if (
      typeof body.id_personne !== "string" ||
      !UUID_PATTERN.test(body.id_personne.trim())
    ) {
      throw new Error("Identifiant de personne invalide");
    }
    return {
      mode: body.mode,
      id_personne: body.id_personne.trim(),
      email,
      telephone,
      mot_de_passe: normalizePassword(body.mot_de_passe),
      donnees: null,
    };
  }

  if (Object.hasOwn(body, "id_personne")) {
    throw new Error("Identifiant de personne non autorisé pour une nouvelle fiche");
  }
  return {
    mode: body.mode,
    id_personne: null,
    email,
    telephone,
    mot_de_passe: normalizePassword(body.mot_de_passe),
    donnees: body.donnees,
  };
}

function getBootstrapSecret() {
  const env = getRequestContext()?.env;
  const secret = env?.BOOTSTRAP_ADMIN_SECRET ?? process.env.BOOTSTRAP_ADMIN_SECRET;
  return typeof secret === "string" && secret.trim() ? secret : null;
}

function verifyBootstrapSecret(providedSecret) {
  const configuredSecret = getBootstrapSecret();
  if (!configuredSecret) {
    throw businessError("Initialisation indisponible", "BOOTSTRAP_UNAVAILABLE");
  }
  if (typeof providedSecret !== "string") {
    throw businessError("Initialisation non autorisée", "BOOTSTRAP_UNAUTHORIZED");
  }

  const expected = Buffer.from(configuredSecret);
  const provided = Buffer.from(providedSecret);
  const valid =
    expected.length === provided.length && timingSafeEqual(expected, provided);
  if (!valid) {
    throw businessError("Initialisation non autorisée", "BOOTSTRAP_UNAUTHORIZED");
  }
}

async function hasAdmin() {
  const result = await database.query(
    `SELECT 1
    FROM compte_membre cm
    JOIN role r ON r.id = cm.id_role
    WHERE r.code = $1
    LIMIT 1`,
    ["ADMIN"],
  );
  return Boolean(result.rows[0]);
}

async function getPersonneWithoutCompte(id) {
  const personResult = await database.query(
    `SELECT id, nom, prenom, nom_usage
    FROM personne
    WHERE id = $1`,
    [id],
  );
  if (!personResult.rows[0]) {
    throw businessError("Personne introuvable", "PERSONNE_NOT_FOUND");
  }
  const compteResult = await database.query(
    "SELECT id FROM compte_membre WHERE id_personne = $1 LIMIT 1",
    [id],
  );
  if (compteResult.rows[0]) {
    throw businessError(
      "Cette personne possède déjà un compte membre",
      "PERSONNE_ALREADY_HAS_ACCOUNT",
    );
  }
  return personResult.rows[0];
}

async function getReferenceByCode(table, code, message, errorCode) {
  const result = await database.query(`SELECT id FROM ${table} WHERE code = $1`, [code]);
  if (!result.rows[0]) throw businessError(message, errorCode);
  return result.rows[0];
}

async function createAdminAuth(input) {
  const attributes = { password: input.mot_de_passe };
  if (input.email) {
    attributes.email = input.email;
    attributes.email_confirm = true;
  }
  if (input.telephone) {
    attributes.phone = normalizeTelephonePourAuth(input.telephone);
    attributes.phone_confirm = true;
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser(attributes);
  if (error || !data.user?.id) {
    const code = [400, 409, 422].includes(error?.status)
      ? "AUTH_COORDINATES_EXISTS"
      : "AUTH_CREATE_FAILED";
    throw businessError(
      code === "AUTH_COORDINATES_EXISTS"
        ? "Un compte utilisant ces coordonnées existe déjà"
        : "Impossible de créer le compte d'authentification",
      code,
    );
  }
  return { id: data.user.id, supabaseAdmin };
}

async function createPersonneFromDraft(donnees, input, statutVivantId) {
  const personne = donnees.personne;
  const result = await database.query(
    `INSERT INTO personne (
      nom, prenom, nom_usage, autres_appellations, id_sexe, id_statut,
      date_naissance, annee_naissance, lieu_naissance, date_deces,
      annee_deces, adresse, id_ville, id_lien, id_element
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING id, nom, prenom, nom_usage`,
    [
      personne.nom,
      personne.prenom,
      personne.nom_usage,
      personne.autres_appellations,
      personne.id_sexe,
      statutVivantId,
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
  const created = result.rows[0];
  const contact = donnees.contact ?? {};
  await database.query(
    `INSERT INTO contacts_personne (
      id_personne, telephone, whatsapp, email, facebook, lien_facebook
    )
    VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      created.id,
      input.telephone,
      contact.whatsapp ?? null,
      input.email,
      contact.facebook ?? null,
      contact.lien_facebook ?? null,
    ],
  );

  for (const activite of donnees.activites) {
    await database.query(
      `INSERT INTO personne_activite (
        id_personne, id_activite, lieu_travail, etude_en_cours, formations,
        experience_anterieur, diplome_ou_apprentissage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        created.id,
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
      [created.id, competence.id_competence, competence.partageable],
    );
  }
  for (const centreInteret of donnees.centres_interet) {
    await database.query(
      `INSERT INTO personne_centre_interet (id_personne, id_centre_interet)
      VALUES ($1, $2)`,
      [created.id, centreInteret.id_centre_interet],
    );
  }
  return created;
}

export async function getStatutInitialisation() {
  return { initialisation_requise: !(await hasAdmin()) };
}

// TODO: prévoir un rate limit spécifique avant toute exposition publique.
export async function creerPremierAdmin(body, providedSecret) {
  verifyBootstrapSecret(providedSecret);
  if (await hasAdmin()) {
    throw businessError("Initialisation déjà effectuée", "BOOTSTRAP_ALREADY_DONE");
  }
  const input = normalizeBootstrapBody(body);
  const donnees =
    input.mode === "NOUVELLE"
      ? await normalizeEtValiderDonneesNouvellePersonne(input.donnees)
      : null;
  let authUser = null;

  try {
    return await database.transaction(async () => {
      await database.query("SELECT pg_advisory_xact_lock($1)", [BOOTSTRAP_LOCK_KEY]);
      if (await hasAdmin()) {
        throw businessError("Initialisation déjà effectuée", "BOOTSTRAP_ALREADY_DONE");
      }

      const [roleAdmin, statutActif, statutVivant] = await Promise.all([
        getReferenceByCode("role", "ADMIN", "Le rôle ADMIN est introuvable", "ADMIN_ROLE_MISSING"),
        getReferenceByCode(
          "statut_compte_membre",
          "ACTIF",
          "Le statut de compte ACTIF est introuvable",
          "ACTIF_STATUS_MISSING",
        ),
        input.mode === "NOUVELLE"
          ? getReferenceByCode("statut", "VIVANT", "Le statut VIVANT est introuvable", "VIVANT_STATUS_MISSING")
          : Promise.resolve(null),
      ]);

      let personne =
        input.mode === "EXISTANTE"
          ? await getPersonneWithoutCompte(input.id_personne)
          : null;
      authUser = await createAdminAuth(input);

      if (input.mode === "NOUVELLE") {
        personne = await createPersonneFromDraft(donnees, input, statutVivant.id);
      }

      const compteResult = await database.query(
        `INSERT INTO compte_membre (
          id_personne, id_auth_user, id_role, id_statut_compte,
          date_creation, date_activation
        ) VALUES ($1, $2, $3, $4, now(), now())
        RETURNING id`,
        [personne.id, authUser.id, roleAdmin.id, statutActif.id],
      );

      return {
        compte: {
          id: compteResult.rows[0].id,
          role: "ADMIN",
          statut: "ACTIF",
        },
        personne: {
          id: personne.id,
          nom: personne.nom,
          prenom: personne.prenom,
          nom_usage: personne.nom_usage,
        },
      };
    });
  } catch (error) {
    if (authUser) {
      try {
        const { error: cleanupError } = await authUser.supabaseAdmin.auth.admin.deleteUser(
          authUser.id,
        );
        if (cleanupError) throw cleanupError;
      } catch {
        // TODO: ajouter une réconciliation des utilisateurs Auth orphelins de bootstrap.
        console.error("Compensation Auth bootstrap échouée", authUser.id);
        throw businessError(
          "Impossible de finaliser l'initialisation",
          "BOOTSTRAP_AUTH_COMPENSATION_FAILED",
        );
      }
    }
    throw error;
  }
}
