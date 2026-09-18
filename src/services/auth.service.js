import database from "../config/db.js";
import { createSupabaseAuthClient } from "../lib/supabaseAuth.js";
import { normalizeTelephonePourAuth } from "../utils/telephoneAuth.js";

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

function normalizeConnexionBody(body = {}) {
  assertPlainObject(body, "Les données de connexion sont invalides");
  const allowedFields = new Set(["identifiant", "mot_de_passe"]);
  for (const field of Object.keys(body)) {
    if (!allowedFields.has(field)) {
      throw new Error("Champ de connexion non autorisé");
    }
  }

  if (typeof body.identifiant !== "string" || !body.identifiant.trim()) {
    throw new Error("L'identifiant est obligatoire");
  }
  if (
    typeof body.mot_de_passe !== "string" ||
    !body.mot_de_passe ||
    body.mot_de_passe.length > 128
  ) {
    throw new Error("Le mot de passe est invalide");
  }

  return {
    identifiant: body.identifiant.trim(),
    mot_de_passe: body.mot_de_passe,
  };
}

function normalizeRefreshBody(body = {}) {
  assertPlainObject(body, "Les données de renouvellement sont invalides");
  if (Object.keys(body).length !== 0) {
    throw new Error("Champ de renouvellement non autorisé");
  }
}

function normalizeDeconnexionBody(body = {}) {
  assertPlainObject(body, "Les données de déconnexion sont invalides");
  if (Object.keys(body).length !== 0) {
    throw new Error("Champ de déconnexion non autorisé");
  }
}

function getAuthCredentials(identifiant, motDePasse) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifiant)) {
    return { email: identifiant.toLowerCase(), password: motDePasse };
  }
  return {
    phone: normalizeTelephonePourAuth(identifiant),
    password: motDePasse,
  };
}

function isExpectedSessionError(error) {
  return [400, 401, 403, 404].includes(error?.status);
}

async function getCompteMembreByAuthUserId(idAuthUser) {
  const result = await database.query(
    `SELECT
      cm.id,
      cm.id_personne,
      r.code AS code_role,
      scm.code AS code_statut_compte,
      p.nom,
      p.prenom,
      p.nom_usage
    FROM compte_membre cm
    JOIN role r
      ON r.id = cm.id_role
    JOIN statut_compte_membre scm
      ON scm.id = cm.id_statut_compte
    JOIN personne p
      ON p.id = cm.id_personne
    WHERE cm.id_auth_user = $1`,
    [idAuthUser],
  );
  return result.rows[0] ?? null;
}

export async function getMembreAuthContext(idAuthUser) {
  const compte = await getCompteMembreByAuthUserId(idAuthUser);
  if (!compte) {
    throw businessError("Ce compte n'est pas autorisé", "COMPTE_MEMBRE_NOT_FOUND");
  }
  if (compte.code_statut_compte !== "ACTIF") {
    throw businessError("Ce compte n'est pas actif", "COMPTE_NOT_ACTIVE");
  }

  return {
    compte: {
      id: compte.id,
      role: compte.code_role,
      statut: compte.code_statut_compte,
    },
    personne: {
      id: compte.id_personne,
      nom: compte.nom,
      prenom: compte.prenom,
      nom_usage: compte.nom_usage,
    },
  };
}

async function buildAuthenticatedMembre(user, session) {
  if (!user?.id || !session?.access_token || !session?.refresh_token) {
    throw businessError("Session invalide ou expirée", "AUTH_SESSION_INVALID");
  }

  return {
    ...(await getMembreAuthContext(user.id)),
    session,
  };
}

export async function connecterMembre(body) {
  const input = normalizeConnexionBody(body);
  const supabaseAuth = createSupabaseAuthClient();
  const { data, error } = await supabaseAuth.auth.signInWithPassword(
    getAuthCredentials(input.identifiant, input.mot_de_passe),
  );

  if (error) {
    throw businessError(
      "Identifiant ou mot de passe incorrect",
      "AUTH_INVALID_CREDENTIALS",
    );
  }
  try {
    return await buildAuthenticatedMembre(data.user, data.session);
  } catch (buildError) {
    if (buildError.code === "AUTH_SESSION_INVALID") {
      throw businessError(
        "Identifiant ou mot de passe incorrect",
        "AUTH_INVALID_CREDENTIALS",
      );
    }
    throw buildError;
  }
}

export async function renouvelerSessionMembre(refreshToken, body) {
  normalizeRefreshBody(body);
  if (typeof refreshToken !== "string" || !refreshToken) {
    throw businessError("Session invalide ou expirée", "AUTH_SESSION_INVALID");
  }

  const supabaseAuth = createSupabaseAuthClient();
  const { data, error } = await supabaseAuth.auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (error) {
    throw businessError("Session invalide ou expirée", "AUTH_SESSION_INVALID");
  }
  return buildAuthenticatedMembre(data.user, data.session);
}

export async function deconnecterSessionMembre(accessToken, refreshToken, body) {
  normalizeDeconnexionBody(body);
  if (!accessToken && !refreshToken) return;

  const supabaseAuth = createSupabaseAuthClient();
  try {
    let sessionReady = false;

    if (accessToken && refreshToken) {
      const { error } = await supabaseAuth.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error && !isExpectedSessionError(error)) throw error;
      sessionReady = !error;
    } else if (refreshToken) {
      const { data, error } = await supabaseAuth.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (error && !isExpectedSessionError(error)) throw error;
      sessionReady = !error && Boolean(data.session);
    }

    if (sessionReady) {
      const { error } = await supabaseAuth.auth.signOut({ scope: "local" });
      if (error && !isExpectedSessionError(error)) throw error;
    }
  } catch {
    throw businessError(
      "Impossible de terminer la session Supabase",
      "AUTH_SIGNOUT_FAILED",
    );
  }
}
