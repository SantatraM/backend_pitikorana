import express from "express";
import {
  getStatutDemandeInscription,
  getStatutsDemandeInscription,
} from "../controllers/statutDemandeInscription.controller.js";

const router = express.Router();

router.get("/:id", getStatutDemandeInscription);
router.get("/", getStatutsDemandeInscription);

export default router;
