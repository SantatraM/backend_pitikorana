import {
  clearAuthSessionCookies,
  getRequestCookie,
  setAuthSessionCookies,
} from "../config/authCookies.js";
import {
  connecterMembre,
  deconnecterSessionMembre,
  renouvelerSessionMembre,
} from "../services/auth.service.js";

export async function connexion(req, res) {
  try {
    const resultat = await connecterMembre(req.body);
    setAuthSessionCookies(res, resultat.session);

    return res.json({
      success: true,
      message: "Connexion réussie",
      data: {
        compte: resultat.compte,
        personne: resultat.personne,
      },
    });
  } catch (error) {
    if (error.code === "AUTH_INVALID_CREDENTIALS") {
      return res.status(401).json({ success: false, message: error.message });
    }
    if (["COMPTE_MEMBRE_NOT_FOUND", "COMPTE_NOT_ACTIVE"].includes(error.code)) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (!error.code) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error(error.code);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function refresh(req, res) {
  const refreshToken = getRequestCookie(req, "pitikorana_refresh_token");
  if (!refreshToken) {
    return res
      .status(401)
      .json({ success: false, message: "Session invalide ou expirée" });
  }

  try {
    const resultat = await renouvelerSessionMembre(refreshToken, req.body);
    setAuthSessionCookies(res, resultat.session);
    return res.json({
      success: true,
      message: "Session renouvelée",
      data: {
        compte: resultat.compte,
        personne: resultat.personne,
      },
    });
  } catch (error) {
    if (!error.code) {
      return res.status(400).json({ success: false, message: error.message });
    }

    clearAuthSessionCookies(res);
    if (error.code === "AUTH_SESSION_INVALID") {
      return res
        .status(401)
        .json({ success: false, message: "Session invalide ou expirée" });
    }
    if (["COMPTE_MEMBRE_NOT_FOUND", "COMPTE_NOT_ACTIVE"].includes(error.code)) {
      return res.status(403).json({ success: false, message: error.message });
    }
    console.error(error.code);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export function me(req, res) {
  return res.json({
    success: true,
    data: {
      compte: req.auth.compte,
      personne: req.auth.personne,
    },
  });
}

export async function deconnexion(req, res) {
  try {
    await deconnecterSessionMembre(
      getRequestCookie(req, "pitikorana_access_token"),
      getRequestCookie(req, "pitikorana_refresh_token"),
      req.body,
    );
  } catch (error) {
    if (!error.code) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error(error.code);
  }

  clearAuthSessionCookies(res);
  return res.json({ success: true, message: "Déconnexion réussie" });
}
