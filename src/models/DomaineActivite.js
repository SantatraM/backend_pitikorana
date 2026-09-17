import DomaineActiviteTraduction from "./DomaineActiviteTraduction.js";

export default class DomaineActivite {
  constructor({ id = null, traductions = [] }) {
    if (!Array.isArray(traductions)) {
      throw new Error("Les traductions doivent être une liste");
    }

    this.id = id;
    this.traductions = traductions.map((traduction) =>
      traduction instanceof DomaineActiviteTraduction
        ? traduction
        : new DomaineActiviteTraduction(traduction),
    );
  }

  toJSON() {
    return {
      id: this.id,
      traductions: this.traductions,
    };
  }
}
