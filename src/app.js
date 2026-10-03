import express from "express";
import cors from "cors";

import paysRoutes from "./routes/pays.routes.js";
import languesRoutes from "./routes/langues.routes.js";
import regionRoutes from "./routes/region.routes.js";
import villeRoutes from "./routes/villes.routes.js";
import liensFalimanjakaRoutes from "./routes/liensFalimanjaka.routes.js";
import typesElementRoutes from "./routes/typesElement.routes.js";
import elementsRoutes from "./routes/elements.routes.js";
import sexesRoutes from "./routes/sexes.routes.js";
import statutsRoutes from "./routes/statuts.routes.js";
import personnesRoutes from "./routes/personnes.routes.js";
import contactsPersonneRoutes from "./routes/contactsPersonne.routes.js";
import typesRelationRoutes from "./routes/typesRelation.routes.js";
import relationsPersonneRoutes from "./routes/relationsPersonne.routes.js";
import photosPersonneRoutes, {
  createPhotosPersonneRouter,
} from "./routes/photosPersonne.routes.js";
import domainesActiviteRoutes from "./routes/domainesActivite.routes.js";
import activitesRoutes from "./routes/activites.routes.js";
import personnesActivitesRoutes from "./routes/personnesActivites.routes.js";
import competencesRoutes from "./routes/competences.routes.js";
import personnesCompetencesRoutes from "./routes/personnesCompetences.routes.js";
import centresInteretRoutes from "./routes/centresInteret.routes.js";
import personnesCentresInteretRoutes from "./routes/personnesCentresInteret.routes.js";
import rolesRoutes from "./routes/roles.routes.js";
import statutsDemandeInscriptionRoutes from "./routes/statutsDemandeInscription.routes.js";
import statutsCompteMembreRoutes from "./routes/statutsCompteMembre.routes.js";
import demandesInscriptionRoutes, {
  createDemandesInscriptionRouter,
} from "./routes/demandesInscription.routes.js";
import authRoutes from "./routes/auth.routes.js";
import initialisationRoutes from "./routes/initialisation.routes.js";
import utilisateursRoutes from "./routes/utilisateurs.routes.js";
import journeesAlahadinTaranakaRoutes from "./routes/journeesAlahadinTaranaka.routes.js";
import sosoKevitraRoutes, {
  createSosoKevitraRouter,
} from "./routes/sosoKevitra.routes.js";
import {
  getRequestContext,
  runWithRequestContext,
} from "./config/requestContext.js";

function getEnvironmentValue(name) {
  return getRequestContext()?.env?.[name] ?? process.env[name];
}

function normalizedOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isDevelopmentEnvironment() {
  return getEnvironmentValue("NODE_ENV") !== "production";
}

function isAllowedFrontendOrigin(origin) {
  if (!origin) return true;

  const configuredOrigin = normalizedOrigin(getEnvironmentValue("FRONTEND_URL"));
  if (configuredOrigin && origin === configuredOrigin) return true;

  return (
    isDevelopmentEnvironment() &&
    /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)
  );
}

export function createApp({ photoUploadMiddleware, requestContext = null } = {}) {
  const app = express();

  app.use((req, res, next) => {
    if (!isAllowedFrontendOrigin(req.get("Origin"))) {
      return res.status(403).json({
        success: false,
        message: "Origine non autorisée",
      });
    }
    return next();
  });
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isAllowedFrontendOrigin(origin));
      },
      credentials: true,
    }),
  );
  app.use(express.json());

  if (requestContext) {
    app.use((req, res, next) => runWithRequestContext(requestContext, next));
  }

  app.get("/", (req, res) => {
    res.json({
      success: true,
      message: "Backend Pitikorana opérationnel",
    });
  });

  app.use("/api/pays", paysRoutes);
  app.use("/api/langues", languesRoutes);
  app.use("/api/regions", regionRoutes);
  app.use("/api/villes", villeRoutes);
  app.use("/api/liens-falimanjaka", liensFalimanjakaRoutes);
  app.use("/api/types-element", typesElementRoutes);
  app.use("/api/elements", elementsRoutes);
  app.use("/api/sexes", sexesRoutes);
  app.use("/api/statuts", statutsRoutes);
  app.use("/api/personnes", personnesRoutes);
  app.use("/api/contacts-personne", contactsPersonneRoutes);
  app.use("/api/types-relation", typesRelationRoutes);
  app.use("/api/relations-personne", relationsPersonneRoutes);
  app.use(
    "/api/photos-personne",
    photoUploadMiddleware
      ? createPhotosPersonneRouter({ photoUploadMiddleware })
      : photosPersonneRoutes,
  );
  app.use("/api/domaines-activite", domainesActiviteRoutes);
  app.use("/api/activites", activitesRoutes);
  app.use("/api/personnes-activites", personnesActivitesRoutes);
  app.use("/api/competences", competencesRoutes);
  app.use("/api/personnes-competences", personnesCompetencesRoutes);
  app.use("/api/centres-interet", centresInteretRoutes);
  app.use("/api/personnes-centres-interet", personnesCentresInteretRoutes);
  app.use("/api/roles", rolesRoutes);
  app.use(
    "/api/statuts-demande-inscription",
    statutsDemandeInscriptionRoutes,
  );
  app.use("/api/statuts-compte-membre", statutsCompteMembreRoutes);
  app.use(
    "/api/demandes-inscription",
    photoUploadMiddleware
      ? createDemandesInscriptionRouter({ photoUploadMiddleware })
      : demandesInscriptionRoutes,
  );
  app.use("/api/auth", authRoutes);
  app.use("/api/initialisation", initialisationRoutes);
  app.use("/api/utilisateurs", utilisateursRoutes);
  app.use("/api/journees-alahadin-taranaka", journeesAlahadinTaranakaRoutes);
  app.use(
    "/api/soso-kevitra",
    photoUploadMiddleware
      ? createSosoKevitraRouter({ photoUploadMiddleware })
      : sosoKevitraRoutes,
  );

  return app;
}

export default createApp();
