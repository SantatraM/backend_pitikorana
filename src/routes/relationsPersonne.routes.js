import express from "express";
import {
  addRelationPersonne,
  editRelationPersonne,
  getRelationPersonne,
  getRelationsPersonne,
  getRelationsPersonneByPersonne,
  removeRelationPersonne,
} from "../controllers/relationPersonne.controller.js";

const router = express.Router();

router.get("/personne/:id_personne", getRelationsPersonneByPersonne);
router.get("/:id", getRelationPersonne);
router.get("/", getRelationsPersonne);
router.post("/", addRelationPersonne);
router.put("/:id", editRelationPersonne);
router.delete("/:id", removeRelationPersonne);

export default router;
