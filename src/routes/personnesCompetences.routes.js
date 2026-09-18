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
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/personne/:id_personne/partageables", getCompetencesPartageables);
router.get("/personne/:id_personne", getPersonnesCompetencesByPersonne);
router.get("/:id", getPersonneCompetence);
router.get("/", getPersonnesCompetences);
router.post("/", requireAuth, addPersonneCompetence);
router.put("/:id", requireAuth, editPersonneCompetence);
router.delete("/:id", requireAuth, removePersonneCompetence);

export default router;
