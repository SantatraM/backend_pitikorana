import { listFoyersSelection } from "../services/foyer.service.js";

function sendError(res, error) {
  if (error.code === "FOYER_SELECTION_INVALID") {
    return res.status(400).json({ success: false, code: error.code, message: error.message });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: "Erreur serveur" });
}

export async function selection(req, res) {
  try {
    return res.json({ success: true, data: await listFoyersSelection(req.query) });
  } catch (error) {
    return sendError(res, error);
  }
}
