import Region from "../models/Region.js";

import {
    getAllRegions,
    getRegionById,
    createRegion,
    updateRegion,
    deleteRegion,
} from "../services/region.service.js";

export async function getRegions(req, res) {
    try {
        const regions = await getAllRegions();

        res.json({
        success: true,
        data: regions,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
        success: false,
        message: "Erreur serveur",
        });
    }
}

export async function getRegion(req, res) {
    try {
        const region = await getRegionById(req.params.id);

        if (!region) {
        return res.status(404).json({
            success: false,
            message: "Région introuvable",
        });
        }

        res.json({
            success: true,
            data: region,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur",
        });
    }
}

export async function addRegion(req, res) {
    try {
        const region = new Region({
            nom: req.body?.nom,
            id_pays: req.body?.id_pays,
        });

        if (!region.id_pays) {
            return res.status(400).json({
                success: false,
                message: "Le pays est obligatoire",
            });
        }

        const nouvelleRegion = await createRegion(region);

        res.status(201).json({
            success: true,
            message: "Région créée avec succès",
            data: nouvelleRegion,
        });
    } catch (error) {
        console.error(error);

        if (error.code === "23505") {
        return res.status(409).json({
            success: false,
            message: "Cette région existe déjà pour ce pays",
        });
        }

        if (error.code === "23503") {
        return res.status(400).json({
            success: false,
            message: "Le pays sélectionné n'existe pas",
        });
        }

        if (error.code === "22P02") {
        return res.status(400).json({
            success: false,
            message: "L'identifiant du pays est invalide",
        });
        }

        res.status(400).json({
        success: false,
        message: error.message,
        });
    }
}

export async function editRegion(req, res) {
    try {
        const region = new Region({
        nom: req.body?.nom,
        id_pays: req.body?.id_pays,
        });

        if (!region.id_pays) {
        return res.status(400).json({
            success: false,
            message: "Le pays est obligatoire",
        });
        }

        const regionModifiee = await updateRegion(req.params.id, region);

        if (!regionModifiee) {
        return res.status(404).json({
            success: false,
            message: "Région introuvable",
        });
        }

        res.json({
        success: true,
        message: "Région modifiée avec succès",
        data: regionModifiee,
        });
    } catch (error) {
        console.error(error);

        if (error.code === "23505") {
        return res.status(409).json({
            success: false,
            message: "Cette région existe déjà pour ce pays",
        });
        }

        if (error.code === "23503") {
        return res.status(400).json({
            success: false,
            message: "Le pays sélectionné n'existe pas",
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

export async function removeRegion(req, res) {
    try {
        const regionSupprimee = await deleteRegion(req.params.id);

        if (!regionSupprimee) {
        return res.status(404).json({
            success: false,
            message: "Région introuvable",
        });
        }

        res.json({
        success: true,
        message: "Région supprimée avec succès",
        data: regionSupprimee,
        });
    } catch (error) {
        console.error(error);

        if (error.code === "23503") {
        return res.status(409).json({
            success: false,
            message:
            "Impossible de supprimer cette région car elle est utilisée par d'autres données",
        });
        }

        if (error.code === "22P02") {
        return res.status(400).json({
            success: false,
            message: "Identifiant de région invalide",
        });
        }

        res.status(500).json({
        success: false,
        message: "Erreur serveur",
        });
    }
}
