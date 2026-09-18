import express from "express";
import {
  addRelationPersonne,
  editRelationPersonne,
  getRelationPersonne,
  getRelationsPersonne,
  getRelationsPersonneByPersonne,
  removeRelationPersonne,
} from "../controllers/relationPersonne.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/personne/:id_personne", getRelationsPersonneByPersonne);
router.get("/:id", getRelationPersonne);
router.get("/", getRelationsPersonne);
router.post("/", requireAuth, addRelationPersonne);
router.put("/:id", requireAuth, editRelationPersonne);
router.delete("/:id", requireAuth, removeRelationPersonne);

export default router;
