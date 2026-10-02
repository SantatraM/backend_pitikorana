import { changeUtilisateurRole, changeUtilisateurStatut, getUtilisateurs } from "../services/utilisateur.service.js";

function sendError(error, res) {
  if (error.code === "UTILISATEUR_NOT_FOUND") return res.status(404).json({ success: false, code: error.code, message: error.message });
  if (error.code === "UTILISATEUR_SELF_CHANGE_FORBIDDEN") return res.status(409).json({ success: false, code: error.code, message: error.message });
  if (String(error.code ?? "").startsWith("UTILISATEUR_")) return res.status(400).json({ success: false, code: error.code, message: error.message });
  console.error(error.code ?? error);
  return res.status(500).json({ success: false, message: "Erreur serveur" });
}

export async function listUtilisateurs(req, res) {
  try { return res.json({ success: true, data: await getUtilisateurs() }); } catch (error) { return sendError(error, res); }
}

export async function updateUtilisateurRole(req, res) {
  try { return res.json({ success: true, data: await changeUtilisateurRole(req.params.id, req.body?.role, req.auth.compte.id) }); } catch (error) { return sendError(error, res); }
}

export async function updateUtilisateurStatut(req, res) {
  try { return res.json({ success: true, data: await changeUtilisateurStatut(req.params.id, req.body?.statut, req.auth.compte.id) }); } catch (error) { return sendError(error, res); }
}