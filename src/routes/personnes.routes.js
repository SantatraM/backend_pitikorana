import express from "express";
import {
  all,
  one,
  profil,
  ascendants,
  genealogicalDescendants,
  fratrie,
  conjoints,
  famille,
  foyer,
  foyerFormePreview,
  foyerPersistant,
  element,
  descendants,
  getConfidentialite,
  updateConfidentialite,
  add,
  addComplete,
  edit,
  editComplete,
  remove,
} from "../controllers/personne.controller.js";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware.js";
import { requireBusinessAdmin, requireRole } from "../middlewares/role.middleware.js";
const r = express.Router();
r.get("/element/:id_element/descendants", optionalAuth, descendants);
r.get("/element/:id_element", optionalAuth, element);
r.get("/:id/profil", optionalAuth, profil);
r.get("/:id/ascendants", optionalAuth, ascendants);
r.get("/:id/descendants", optionalAuth, genealogicalDescendants);
r.get("/:id/fratrie", optionalAuth, fratrie);
r.get("/:id/conjoints", optionalAuth, conjoints);
r.get("/:id/famille", optionalAuth, famille);
r.get("/:id/foyer", optionalAuth, foyer);
r.get("/:id/foyer-forme", requireAuth, foyerFormePreview);
r.get("/:id/foyer-persistant", requireAuth, foyerPersistant);
r.get("/:id/confidentialite", requireAuth, getConfidentialite);
r.put("/:id/confidentialite", requireAuth, updateConfidentialite);
r.get("/:id", optionalAuth, one);
r.get("/", optionalAuth, all);
r.post("/complete", requireAuth, requireRole("ADMIN", "PASTEUR", "BUREAU_ZANAKA_AMPIELEZANA", "MEMBRE"), addComplete);
r.put("/:id/complete", requireAuth, editComplete);
r.post("/", requireAuth, add);
r.put("/:id", requireAuth, edit);
r.delete("/:id", requireAuth, requireBusinessAdmin, remove);
export default r;
