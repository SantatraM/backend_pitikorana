import { getAllSexes, getSexesByLangue } from "../services/sexe.service.js";
export async function getSexes(req, res) {
  try {
    return res.json({ success: true, data: await getAllSexes() });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
export async function getSexesLangue(req, res) {
  try {
    return res.json({
      success: true,
      data: await getSexesByLangue(req.params.code),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}
