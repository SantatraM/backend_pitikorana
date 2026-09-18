import {
  creerPremierAdmin,
  getStatutInitialisation,
} from "../services/initialisation.service.js";

function handleBootstrapError(error, res) {
  if (error.code === "BOOTSTRAP_UNAVAILABLE") {
    return res.status(503).json({ success: false, message: error.message });
  }
  if (error.code === "BOOTSTRAP_UNAUTHORIZED") {
    return res.status(403).json({ success: false, message: error.message });
  }
  if (
    [
      "BOOTSTRAP_ALREADY_DONE",
      "PERSONNE_ALREADY_HAS_ACCOUNT",
      "AUTH_COORDINATES_EXISTS",
    ].includes(error.code)
  ) {
    return res.status(409).json({ success: false, message: error.message });
  }
  if (error.code === "23505") {
    return res
      .status(409)
      .json({ success: false, message: "Initialisation déjà effectuée" });
  }
  if (error.code === "PERSONNE_NOT_FOUND") {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (error.code === "DRAFT_FK_NOT_FOUND" || !error.code) {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error(error.code);
  return res.status(500).json({ success: false, message: "Erreur serveur" });
}

export async function statutInitialisation(req, res) {
  try {
    return res.json({ success: true, data: await getStatutInitialisation() });
  } catch (error) {
    console.error(error.code ?? "INITIALISATION_STATUS_FAILED");
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

export async function premierAdmin(req, res) {
  try {
    const result = await creerPremierAdmin(req.body, req.get("X-Bootstrap-Secret"));
    return res.status(201).json({
      success: true,
      message: "Premier administrateur créé",
      data: result,
    });
  } catch (error) {
    return handleBootstrapError(error, res);
  }
}
