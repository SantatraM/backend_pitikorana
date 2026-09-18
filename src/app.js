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
import photosPersonneRoutes from "./routes/photosPersonne.routes.js";
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
import demandesInscriptionRoutes from "./routes/demandesInscription.routes.js";
import authRoutes from "./routes/auth.routes.js";
import initialisationRoutes from "./routes/initialisation.routes.js";

const app = express();

// TODO: restreindre les origines CORS et finaliser la stratégie CSRF avant production.
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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
app.use("/api/photos-personne", photosPersonneRoutes);
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
app.use("/api/demandes-inscription", demandesInscriptionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/initialisation", initialisationRoutes);

export default app;
