import express from "express";
import {
  addDemandeInscription,
  creerCompteMembre,
  getDemandeInscription,
  getDemandesInscription,
  recherchePersonneInscription,
  refuserDemandeInscriptionController,
  suiviDemandeInscription,
  uploadPhotoTemporaireDemande,
  validerDemandeInscriptionController,
} from "../controllers/demandeInscription.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireBusinessAdmin } from "../middlewares/role.middleware.js";

const passthrough = (_req, _res, next) => next();

export function createDemandesInscriptionRouter({
  photoUploadMiddleware = passthrough,
} = {}) {
  const router = express.Router();

  router.post("/photo-temporaire", photoUploadMiddleware, uploadPhotoTemporaireDemande);
  router.post("/suivi", suiviDemandeInscription);
  router.post("/creer-compte", creerCompteMembre);
  router.get("/recherche-personne", recherchePersonneInscription);
  router.post("/:id/valider", requireAuth, requireBusinessAdmin, validerDemandeInscriptionController);
  router.post("/:id/refuser", requireAuth, requireBusinessAdmin, refuserDemandeInscriptionController);
  router.get("/:id", requireAuth, requireBusinessAdmin, getDemandeInscription);
  router.get("/", requireAuth, requireBusinessAdmin, getDemandesInscription);
  router.post("/", addDemandeInscription);

  return router;
}

export default createDemandesInscriptionRouter();