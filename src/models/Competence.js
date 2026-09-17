import CompetenceTraduction from "./CompetenceTraduction.js";

export default class Competence {
  constructor({ id = null, traductions = [] }) {
    if (!Array.isArray(traductions)) {
      throw new Error("Les traductions doivent être une liste");
    }

    this.id = id;
    this.traductions = traductions.map((traduction) =>
      traduction instanceof CompetenceTraduction
        ? traduction
        : new CompetenceTraduction(traduction),
    );
  }

  toJSON() {
    return {
      id: this.id,
      traductions: this.traductions,
    };
  }
}
