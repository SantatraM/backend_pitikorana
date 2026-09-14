import express from "express";
import { getSexes, getSexesLangue } from "../controllers/sexe.controller.js";
const router = express.Router();
router.get("/langue/:code", getSexesLangue);
router.get("/", getSexes);
export default router;
