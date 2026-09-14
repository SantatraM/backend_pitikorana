import Pays from "../models/Pays.js";

import {
  getAllPays,
  getPaysById,
  createPays,
  updatePays,
  deletePays,
} from "../services/pays.service.js";

export async function getPays(req, res) {
  try {
    const pays = await getAllPays();
    res.json({
      success: true,
      data: pays,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
}

export async function getPaysId(req, res) {
  try {
    const pays = await getPaysById(req.params.id);
    if (!pays) {
      return res.status(404).json({
        success: false,
        message: "Pays introuvable",
      });
    }
    res.json({
      success: true,
      data: pays,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
}

export async function addPays(req, res) {
  try {
    const pays = new Pays({
      nom: req.body?.nom,
    });
    const nouveauPays = await createPays(pays);
    res.status(201).json({
      success: true,
      message: "Pays créé avec succès",
      data: nouveauPays,
    });
  } catch (error) {
    console.error(error);
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Ce pays existe déjà",
      });
    }
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function editPays(req, res) {
  try {
    const pays = new Pays({
      nom: req.body?.nom,
    });
    const paysModifie = await updatePays(req.params.id, pays);
    if (!paysModifie) {
      return res.status(404).json({
        success: false,
        message: "Pays introuvable",
      });
    }
    res.json({
      success: true,
      message: "Pays modifié avec succès",
      data: paysModifie,
    });
  } catch (error) {
    console.error(error);
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Ce nom de pays existe déjà",
      });
    }
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function removePays(req, res) {
  try {
    const paysSupprime = await deletePays(req.params.id);
    if (!paysSupprime) {
      return res.status(404).json({
        success: false,
        message: "Pays introuvable",
      });
    }
    res.json({
      success: true,
      message: "Pays supprimé avec succès",
      data: paysSupprime,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
}
