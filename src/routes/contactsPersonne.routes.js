import express from "express";
import {
  addContactPersonne,
  editContactPersonne,
  getContactPersonne,
  getContactsPersonne,
  getContactsPersonneByPersonne,
  removeContactPersonne,
} from "../controllers/contactsPersonne.controller.js";

const router = express.Router();

router.get("/personne/:id_personne", getContactsPersonneByPersonne);
router.get("/:id", getContactPersonne);
router.get("/", getContactsPersonne);
router.post("/", addContactPersonne);
router.put("/:id", editContactPersonne);
router.delete("/:id", removeContactPersonne);

export default router;
