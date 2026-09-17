import ActiviteTraduction from "./ActiviteTraduction.js";

export default class Activite {
  constructor({ id = null, id_domaine_activite = null, traductions = [] }) {
    if (!Array.isArray(traductions)) {
      throw new Error("Les traductions doivent être une liste");
    }

    this.id = id;
    this.id_domaine_activite = id_domaine_activite ?? null;
    this.traductions = traductions.map((traduction) =>
      traduction instanceof ActiviteTraduction
        ? traduction
        : new ActiviteTraduction(traduction),
    );
  }

  toJSON() {
    return {
      id: this.id,
      id_domaine_activite: this.id_domaine_activite,
      traductions: this.traductions,
    };
  }
}
