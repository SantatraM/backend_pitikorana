import express from "express";

import {
    getVilles,
    getVille,
    getVillesRegion,
    getVillesPays,
    getVillesPaysRegion,
    addVille,
    editVille,
    removeVille,
} from "../controllers/ville.controller.js";

const router = express.Router();

// Recherches spécifiques
router.get("/pays/:id_pays/region/:id_region", getVillesPaysRegion);

router.get("/pays/:id_pays", getVillesPays);

router.get("/region/:id_region", getVillesRegion);

// CRUD
router.get("/", getVilles);

router.get("/:id", getVille);

router.post("/", addVille);

router.put("/:id", editVille);

router.delete("/:id", removeVille);

export default router;
