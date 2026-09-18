import express from "express";
import {
  addDemandeInscription,
  creerCompteMembre,
  getDemandeInscription,
  getDemandesInscription,
  recherchePersonneInscription,
  refuserDemandeInscriptionController,
  suiviDemandeInscription,
  validerDemandeInscriptionController,
} from "../controllers/demandeInscription.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = express.Router();

router.post("/suivi", suiviDemandeInscription);
router.post("/creer-compte", creerCompteMembre);
router.get("/recherche-personne", recherchePersonneInscription);
router.post(
  "/:id/valider",
  requireAuth,
  requireRole("ADMIN"),
  validerDemandeInscriptionController,
);
router.post(
  "/:id/refuser",
  requireAuth,
  requireRole("ADMIN"),
  refuserDemandeInscriptionController,
);
router.get("/:id", requireAuth, requireRole("ADMIN"), getDemandeInscription);
router.get("/", requireAuth, requireRole("ADMIN"), getDemandesInscription);
router.post("/", addDemandeInscription);

export default router;
