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

const router = express.Router();

router.get("/personne/:id_personne", getPhotoPersonneByPersonne);
router.post("/upload/:id_personne", uploadPhoto);
router.put("/upload/:id_personne", replaceUploadedPhoto);
router.get("/:id", getPhotoPersonne);
router.get("/", getPhotosPersonne);
router.post("/", addPhotoPersonne);
router.put("/:id", editPhotoPersonne);
router.delete("/:id", removePhotoPersonne);

export default router;
