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

const passthrough = (_req, _res, next) => next();

export function createPhotosPersonneRouter({ photoUploadMiddleware = passthrough } = {}) {
  const router = express.Router();

  router.get("/personne/:id_personne", optionalAuth, getPhotoPersonneByPersonne);
  // Authentication runs before the Node multipart parser. In the Worker the
  // multipart body is parsed by the fetch adapter before Express is reached.
  router.post("/upload/:id_personne", requireAuth, photoUploadMiddleware, uploadPhoto);
  router.put("/upload/:id_personne", requireAuth, photoUploadMiddleware, replaceUploadedPhoto);
  router.get("/:id", optionalAuth, getPhotoPersonne);
  router.get("/", optionalAuth, getPhotosPersonne);
  router.post("/", requireAuth, addPhotoPersonne);
  router.put("/:id", requireAuth, editPhotoPersonne);
  router.delete("/:id", requireAuth, removePhotoPersonne);

  return router;
}

export default createPhotosPersonneRouter();
