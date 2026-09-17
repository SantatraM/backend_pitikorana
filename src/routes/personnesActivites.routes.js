import express from "express";
import {
  addPersonneActivite,
  editPersonneActivite,
  getPersonneActivite,
  getPersonnesActivites,
  getPersonnesActivitesByPersonne,
  removePersonneActivite,
} from "../controllers/personneActivite.controller.js";

const router = express.Router();

router.get("/personne/:id_personne", getPersonnesActivitesByPersonne);
router.get("/:id", getPersonneActivite);
router.get("/", getPersonnesActivites);
router.post("/", addPersonneActivite);
router.put("/:id", editPersonneActivite);
router.delete("/:id", removePersonneActivite);

export default router;
