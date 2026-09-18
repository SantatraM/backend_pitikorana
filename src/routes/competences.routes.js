import express from "express";
import {
  addCompetence,
  editCompetence,
  getCompetence,
  getCompetences,
  getCompetencesLangue,
  removeCompetence,
} from "../controllers/competence.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = express.Router();

router.get("/langue/:code", getCompetencesLangue);
router.get("/:id", getCompetence);
router.get("/", getCompetences);
router.post("/", requireAuth, requireRole("ADMIN"), addCompetence);
router.put("/:id", requireAuth, requireRole("ADMIN"), editCompetence);
router.delete("/:id", requireAuth, requireRole("ADMIN"), removeCompetence);

export default router;
