import express from "express";
import {
  addPersonneCompetence,
  editPersonneCompetence,
  getCompetencesPartageables,
  getPersonneCompetence,
  getPersonnesCompetences,
  getPersonnesCompetencesByPersonne,
  removePersonneCompetence,
} from "../controllers/personneCompetence.controller.js";

const router = express.Router();

router.get("/personne/:id_personne/partageables", getCompetencesPartageables);
router.get("/personne/:id_personne", getPersonnesCompetencesByPersonne);
router.get("/:id", getPersonneCompetence);
router.get("/", getPersonnesCompetences);
router.post("/", addPersonneCompetence);
router.put("/:id", editPersonneCompetence);
router.delete("/:id", removePersonneCompetence);

export default router;
