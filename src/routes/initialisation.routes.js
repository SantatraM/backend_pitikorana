import express from "express";
import {
  premierAdmin,
  statutInitialisation,
} from "../controllers/initialisation.controller.js";

const router = express.Router();

router.get("/statut", statutInitialisation);
router.post("/premier-admin", premierAdmin);

export default router;
