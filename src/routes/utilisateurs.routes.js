import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { listUtilisateurs, updateUtilisateurRole, updateUtilisateurStatut } from "../controllers/utilisateur.controller.js";

const router = express.Router();
const requireAdmin = [requireAuth, requireRole("ADMIN")];

router.get("/", ...requireAdmin, listUtilisateurs);
router.patch("/:id/role", ...requireAdmin, updateUtilisateurRole);
router.patch("/:id/statut", ...requireAdmin, updateUtilisateurStatut);

export default router;