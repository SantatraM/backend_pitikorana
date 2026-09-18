import express from "express";
import {
  addContactPersonne,
  editContactPersonne,
  getContactPersonne,
  getContactsPersonne,
  getContactsPersonneByPersonne,
  removeContactPersonne,
} from "../controllers/contactsPersonne.controller.js";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/personne/:id_personne", optionalAuth, getContactsPersonneByPersonne);
router.get("/:id", optionalAuth, getContactPersonne);
router.get("/", optionalAuth, getContactsPersonne);
router.post("/", requireAuth, addContactPersonne);
router.put("/:id", requireAuth, editContactPersonne);
router.delete("/:id", requireAuth, removeContactPersonne);

export default router;
