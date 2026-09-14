import Langue from "../models/Langue.js";

import { getAllLangues } from "../services/langue.service.js";

export async function getLangues(req, res) {
  try {
    const langues = await getAllLangues();
    res.json({
      success: true,
      data: langues,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
}
