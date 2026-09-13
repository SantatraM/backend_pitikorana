import express from "express";
import { getTypesElement } from "../controllers/typeElement.controller.js";

const router = express.Router();

router.get("/", getTypesElement);

export default router;
