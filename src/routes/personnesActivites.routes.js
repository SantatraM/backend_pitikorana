import express from "express";
import {
  addPersonneActivite,
  editPersonneActivite,
  getPersonneActivite,
  getPersonnesActivites,
  getPersonnesActivitesByPersonne,
  removePersonneActivite,
} from "../controllers/personneActivite.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/personne/:id_personne", getPersonnesActivitesByPersonne);
router.get("/:id", getPersonneActivite);
router.get("/", getPersonnesActivites);
router.post("/", requireAuth, addPersonneActivite);
router.put("/:id", requireAuth, editPersonneActivite);
router.delete("/:id", requireAuth, removePersonneActivite);

export default router;
