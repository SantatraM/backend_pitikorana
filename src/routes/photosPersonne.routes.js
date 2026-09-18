import express from "express";
import {
  addPhotoPersonne,
  editPhotoPersonne,
  getPhotoPersonne,
  getPhotoPersonneByPersonne,
  getPhotosPersonne,
  removePhotoPersonne,
  replaceUploadedPhoto,
  uploadPhoto,
} from "../controllers/photoPersonne.controller.js";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/personne/:id_personne", optionalAuth, getPhotoPersonneByPersonne);
router.post("/upload/:id_personne", requireAuth, uploadPhoto);
router.put("/upload/:id_personne", requireAuth, replaceUploadedPhoto);
router.get("/:id", optionalAuth, getPhotoPersonne);
router.get("/", optionalAuth, getPhotosPersonne);
router.post("/", requireAuth, addPhotoPersonne);
router.put("/:id", requireAuth, editPhotoPersonne);
router.delete("/:id", requireAuth, removePhotoPersonne);

export default router;
