import express from "express";
import { selection } from "../controllers/foyer.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/selection", requireAuth, selection);

export default router;
