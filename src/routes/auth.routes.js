import express from "express";
import {
  connexion,
  deconnexion,
  me,
  refresh,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/connexion", connexion);
router.post("/refresh", refresh);
router.post("/deconnexion", deconnexion);
router.get("/me", requireAuth, me);

export default router;
