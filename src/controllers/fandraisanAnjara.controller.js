import {
  creerFandraisanAnjara,
  annulerFandraisanAnjara,
  corrigerFandraisanAnjara,
  getFandraisanAnjaraById,
  getFandraisanAnjaraDetailRazambe as getFandraisanAnjaraDetailRazambeService,
  getFandraisanAnjaraList,
  getFandraisanAnjaraParRazambe as getFandraisanAnjaraParRazambeService,
  getFandraisanAnjaraStatistiques as getFandraisanAnjaraStatistiquesService,
  getFandraisanAnjaraHistorique as getFandraisanAnjaraHistoriqueService,
} from "../services/fandraisanAnjara.service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sendError(res, error) {
  if (error.code === "AUTH_REQUIRED") {
    return res.status(401).json({ success: false, message: error.message });
  }
  if (error.code === "FANDRAISAN_ANJARA_FORBIDDEN") {
    return res.status(403).json({ success: false, message: error.message });
  }
  if ([
    "FANDRAISAN_ANJARA_INVALID",
    "FANDRAISAN_ANJARA_IDEMPOTENCY_KEY_INVALID",
    "FANDRAISAN_ANJARA_CONTRIBUTEUR_INVALID",
    "FANDRAISAN_ANJARA_RATTACHEMENT_INVALID",
  ].includes(error.code)) {
    return res.status(400).json({ success: false, code: error.code, message: error.message });
  }
  if (error.code === "FANDRAISAN_ANJARA_CONTRIBUTEUR_NOT_FOUND") {
    return res.status(404).json({ success: false, code: error.code, message: error.message });
  }
  if (error.code === "FANDRAISAN_ANJARA_NOT_FOUND") {
    return res.status(404).json({ success: false, code: error.code, message: error.message });
  }
  if ([
    "FANDRAISAN_ANJARA_REVISION_CONFLICT",
    "FANDRAISAN_ANJARA_STATE_INVALID",
    "FANDRAISAN_ANJARA_IDEMPOTENCY_CONFLICT",
  ].includes(error.code)) {
    return res.status(409).json({ success: false, code: error.code, message: error.message });
  }
  if (error.code) console.error(error);
  return res.status(500).json({ success: false, message: "Erreur serveur" });
}

export async function createFandraisanAnjara(req, res) {
  try {
    const idempotencyKey = typeof req.get === "function"
      ? req.get("Idempotency-Key")
      : req.headers?.["idempotency-key"];
    const data = await creerFandraisanAnjara(req.body, req.auth, idempotencyKey);
    return res.status(data.idempotent_replay ? 200 : 201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function listFandraisanAnjara(req, res) {
  try {
    const data = await getFandraisanAnjaraList(req.query, req.auth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getFandraisanAnjara(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(400).json({ success: false, code: "FANDRAISAN_ANJARA_INVALID", message: "Identifiant de contribution invalide." });
  }
  try {
    const data = await getFandraisanAnjaraById(req.params.id, req.auth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getFandraisanAnjaraStatistiques(req, res) {
  try {
    const data = await getFandraisanAnjaraStatistiquesService(req.query, req.auth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getFandraisanAnjaraParRazambe(req, res) {
  try {
    const data = await getFandraisanAnjaraParRazambeService(req.query, req.auth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getFandraisanAnjaraRazambeDetail(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(400).json({ success: false, code: "FANDRAISAN_ANJARA_INVALID", message: "Identifiant Razambe invalide." });
  }
  try {
    const data = await getFandraisanAnjaraDetailRazambeService(req.params.id, req.query, req.auth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getFandraisanAnjaraNonDetermineDetail(req, res) {
  try {
    const data = await getFandraisanAnjaraDetailRazambeService(null, req.query, req.auth, { nonDetermine: true });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateFandraisanAnjara(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(400).json({ success: false, code: "FANDRAISAN_ANJARA_INVALID", message: "Identifiant de contribution invalide." });
  }
  try {
    const data = await corrigerFandraisanAnjara(req.params.id, req.body, req.auth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function cancelFandraisanAnjara(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(400).json({ success: false, code: "FANDRAISAN_ANJARA_INVALID", message: "Identifiant de contribution invalide." });
  }
  try {
    const data = await annulerFandraisanAnjara(req.params.id, req.body, req.auth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getFandraisanAnjaraHistorique(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(400).json({ success: false, code: "FANDRAISAN_ANJARA_INVALID", message: "Identifiant de contribution invalide." });
  }
  try {
    const data = await getFandraisanAnjaraHistoriqueService(req.params.id, req.auth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}
