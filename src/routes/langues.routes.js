import express from "express";
import {
  getLangues,
} from "../controllers/langue.controller.js";

const router = express.Router();

router.get("/", getLangues);

export default router;
