import express from "express";
import {
  addCompetence,
  editCompetence,
  getCompetence,
  getCompetences,
  getCompetencesLangue,
  removeCompetence,
} from "../controllers/competence.controller.js";

const router = express.Router();

router.get("/langue/:code", getCompetencesLangue);
router.get("/:id", getCompetence);
router.get("/", getCompetences);
router.post("/", addCompetence);
router.put("/:id", editCompetence);
router.delete("/:id", removeCompetence);

export default router;
