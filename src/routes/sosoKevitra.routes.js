import express from "express";
import {
  addSoutien,
  addContribution,
  addContributionPhotos,
  createBrouillon,
  demanderCorrection,
  editContribution,
  getContributions,
  masquer,
  restaurer,
  removeContribution,
  removeContributionPhoto,
  reorderContributionPhotosHandler,
  editBrouillon,
  getAdminAVerifier,
  getBrouillon,
  getCategories,
  getMesBrouillons,
  getMesPropositions,
  getPublics,
  getStatuts,
  nonPublier,
  publier,
  prendreDecision,
  prolonger,
  removePhoto,
  removeBrouillon,
  removeSoutien,
  reorderPhotos,
  soumettre,
  uploadPhotos,
} from "../controllers/sosoKevitra.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireBusinessAdmin } from "../middlewares/role.middleware.js";

const passthrough = (_req, _res, next) => next();

export function createSosoKevitraRouter({ photoUploadMiddleware = passthrough } = {}) {
  const router = express.Router();

  router.get("/mes-brouillons", requireAuth, getMesBrouillons);
  router.get("/mes-propositions", requireAuth, getMesPropositions);
  router.get("/statuts", getStatuts);
  router.get("/categories-contribution", getCategories);
  router.get("/admin/a-verifier", requireAuth, requireBusinessAdmin, getAdminAVerifier);
  router.get("/", requireAuth, getPublics);
  router.post("/", requireAuth, createBrouillon);
  router.get("/:id/contributions", requireAuth, getContributions);
  router.post("/:id/contributions", requireAuth, addContribution);
  router.put("/:id/contributions/:contributionId", requireAuth, editContribution);
  router.post("/:id/contributions/:contributionId/photos", requireAuth, photoUploadMiddleware, addContributionPhotos);
  router.put("/:id/contributions/:contributionId/photos/ordre", requireAuth, reorderContributionPhotosHandler);
  router.delete("/:id/contributions/:contributionId/photos/:photoId", requireAuth, removeContributionPhoto);
  router.delete("/:id/contributions/:contributionId", requireAuth, removeContribution);
  router.post("/:id/contributions/:contributionId/masquer", requireAuth, requireBusinessAdmin, masquer);
  router.post("/:id/contributions/:contributionId/restaurer", requireAuth, requireBusinessAdmin, restaurer);
  router.post("/:id/soumettre", requireAuth, soumettre);
  router.post("/:id/demander-correction", requireAuth, requireBusinessAdmin, demanderCorrection);
  router.post("/:id/non-publier", requireAuth, requireBusinessAdmin, nonPublier);
  router.post("/:id/publier", requireAuth, requireBusinessAdmin, publier);
  router.post("/:id/decision", requireAuth, requireBusinessAdmin, prendreDecision);
  router.post("/:id/prolonger", requireAuth, requireBusinessAdmin, prolonger);
  router.post("/:id/photos", requireAuth, photoUploadMiddleware, uploadPhotos);
  router.put("/:id/photos/ordre", requireAuth, reorderPhotos);
  router.delete("/:id/photos/:photoId", requireAuth, removePhoto);
  router.post("/:id/soutien", requireAuth, addSoutien);
  router.delete("/:id/soutien", requireAuth, removeSoutien);
  router.get("/:id", requireAuth, getBrouillon);
  router.put("/:id", requireAuth, editBrouillon);
  router.delete("/:id", requireAuth, removeBrouillon);

  return router;
}

export default createSosoKevitraRouter();
