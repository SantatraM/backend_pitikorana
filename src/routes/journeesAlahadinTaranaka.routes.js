import express from "express";
import {
  cloturerJournee,
  createJournee,
  getJournee,
  getJournees,
  ouvrirJournee,
  rouvrirJournee,
  updateJournee,
} from "../controllers/journeeAlahadinTaranaka.controller.js";
import { createDonForJournee, getDonsForJournee, getDonForJournee, getStatistiquesDonsForJournee, updateDonForJournee, cancelDonForJournee } from "../controllers/don.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireBusinessAdmin } from "../middlewares/role.middleware.js";

const router = express.Router();
const requireAdmin = [requireAuth, requireBusinessAdmin];

router.get("/", requireAuth, getJournees);
router.post("/", ...requireAdmin, createJournee);
router.post("/:id/ouvrir", ...requireAdmin, ouvrirJournee);
router.post("/:id/cloturer", ...requireAdmin, cloturerJournee);
router.post("/:id/rouvrir", ...requireAdmin, rouvrirJournee);
router.post("/:journeeId/dons", ...requireAdmin, createDonForJournee);
router.get("/:journeeId/dons", requireAuth, getDonsForJournee);
router.get("/:journeeId/dons/:donId", requireAuth, getDonForJournee);
router.put("/:journeeId/dons/:donId", ...requireAdmin, updateDonForJournee);
router.post("/:journeeId/dons/:donId/annuler", ...requireAdmin, cancelDonForJournee);
router.get("/:id/statistiques", requireAuth, getStatistiquesDonsForJournee);
router.get("/:id", requireAuth, getJournee);
router.put("/:id", ...requireAdmin, updateJournee);

export default router;