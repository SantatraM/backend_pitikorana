import express from "express";
import { getRole, getRoles } from "../controllers/role.controller.js";

const router = express.Router();

router.get("/:id", getRole);
router.get("/", getRoles);

export default router;
