import { getRequestCookie } from "../config/authCookies.js";
import { createSupabaseAuthClient } from "../lib/supabaseAuth.js";
import { getMembreAuthContext } from "../services/auth.service.js";

function invalidSession(res) {
  return res
    .status(401)
    .json({ success: false, message: "Session invalide ou expirée" });
}

async function authenticateRequest(req, res, next, { allowMissingAccessToken }) {
  const accessToken = getRequestCookie(req, "pitikorana_access_token");
  if (!accessToken) {
    if (allowMissingAccessToken) return next();
    return res
      .status(401)
      .json({ success: false, message: "Authentification requise" });
  }

  try {
    const supabaseAuth = createSupabaseAuthClient();
    const { data, error } = await supabaseAuth.auth.getUser(accessToken);
    if (error) {
      if (error.status === 401 || error.status === 403) return invalidSession(res);
      console.error("AUTH_USER_VERIFICATION_FAILED");
      return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
    if (!data.user?.id) return invalidSession(res);

    const contexte = await getMembreAuthContext(data.user.id);
    req.auth = {
      authUserId: data.user.id,
      compte: contexte.compte,
      personne: contexte.personne,
    };
    return next();
  } catch (error) {
    if (error.code === "COMPTE_MEMBRE_NOT_FOUND") {
      return res.status(403).json({ success: false, message: "Accès refusé" });
    }
    if (error.code === "COMPTE_NOT_ACTIVE") {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.code === "AUTH_CONFIG_UNAVAILABLE") {
      console.error(error.code);
    } else {
      console.error(error.code ?? "AUTH_MIDDLEWARE_FAILED");
    }
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export function requireAuth(req, res, next) {
  return authenticateRequest(req, res, next, { allowMissingAccessToken: false });
}

export function optionalAuth(req, res, next) {
  return authenticateRequest(req, res, next, { allowMissingAccessToken: true });
}
