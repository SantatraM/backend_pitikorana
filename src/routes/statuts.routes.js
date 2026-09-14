import express from "express";
import { getStatuts, getStatutsLangue } from "../controllers/statut.controller.js";
const router = express.Router();
router.get("/langue/:code", getStatutsLangue);
router.get("/", getStatuts);
export default router;
