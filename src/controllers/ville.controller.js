import Ville from "../models/Ville.js";

import {
    getAllVilles,
    getVilleById,
    getVillesByRegion,
    getVillesByPays,
    getVillesByPaysAndRegion,
    createVille,
    updateVille,
    deleteVille,
} from "../services/ville.service.js";

// =====================================================
// TOUTES LES VILLES
// =====================================================

export async function getVilles(req, res) {
    try {
        const villes = await getAllVilles();

        res.json({
            success: true,
            data: villes,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur",
        });
    }
}

// =====================================================
// VILLE PAR ID
// =====================================================

export async function getVille(req, res) {
  try {
    const ville = await getVilleById(req.params.id);

    if (!ville) {
      return res.status(404).json({
        success: false,
        message: "Ville introuvable",
      });
    }

    res.json({
      success: true,
      data: ville,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
}

// =====================================================
// VILLES PAR REGION
// =====================================================

export async function getVillesRegion(req, res) {
  try {
    const villes = await getVillesByRegion(req.params.id_region);

    res.json({
      success: true,
      data: villes,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
}

// =====================================================
// VILLES PAR PAYS
// =====================================================

export async function getVillesPays(req, res) {
  try {
    const villes = await getVillesByPays(req.params.id_pays);

    res.json({
      success: true,
      data: villes,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
}

// =====================================================
// VILLES PAR PAYS ET REGION
// =====================================================

export async function getVillesPaysRegion(req, res) {
  try {
    const villes = await getVillesByPaysAndRegion(
      req.params.id_pays,
      req.params.id_region,
    );

    res.json({
      success: true,
      data: villes,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
}

// =====================================================
// AJOUTER VILLE
// =====================================================

export async function addVille(req, res) {
  try {
    const ville = new Ville({
      nom: req.body?.nom,
      id_region: req.body?.id_region,
    });

    if (!ville.id_region) {
      return res.status(400).json({
        success: false,
        message: "La région est obligatoire",
      });
    }

    const nouvelleVille = await createVille(ville);

    res.status(201).json({
      success: true,
      message: "Ville créée avec succès",
      data: nouvelleVille,
    });
  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Cette ville existe déjà dans cette région",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "La région sélectionnée n'existe pas",
      });
    }

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "L'identifiant de la région est invalide",
      });
    }

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// =====================================================
// MODIFIER VILLE
// =====================================================

export async function editVille(req, res) {
  try {
    const ville = new Ville({
      nom: req.body?.nom,
      id_region: req.body?.id_region,
    });

    if (!ville.id_region) {
      return res.status(400).json({
        success: false,
        message: "La région est obligatoire",
      });
    }

    const villeModifiee = await updateVille(req.params.id, ville);

    if (!villeModifiee) {
      return res.status(404).json({
        success: false,
        message: "Ville introuvable",
      });
    }

    res.json({
      success: true,
      message: "Ville modifiée avec succès",
      data: villeModifiee,
    });
  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Cette ville existe déjà dans cette région",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "La région sélectionnée n'existe pas",
      });
    }

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Identifiant invalide",
      });
    }

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// =====================================================
// SUPPRIMER VILLE
// =====================================================

export async function removeVille(req, res) {
  try {
    const villeSupprimee = await deleteVille(req.params.id);

    if (!villeSupprimee) {
      return res.status(404).json({
        success: false,
        message: "Ville introuvable",
      });
    }

    res.json({
      success: true,
      message: "Ville supprimée avec succès",
      data: villeSupprimee,
    });
  } catch (error) {
    console.error(error);

    if (error.code === "23503") {
      return res.status(409).json({
        success: false,
        message:
          "Impossible de supprimer cette ville car elle est utilisée par d'autres données",
      });
    }

    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
}
