import express from "express";
import {
  getTypesRelation,
  getTypesRelationLangue,
} from "../controllers/typeRelation.controller.js";

const router = express.Router();

router.get("/langue/:code", getTypesRelationLangue);
router.get("/", getTypesRelation);

export default router;
