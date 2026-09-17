import CentreInteretTraduction from "./CentreInteretTraduction.js";

export default class CentreInteret {
  constructor({ id = null, traductions = [] }) {
    if (!Array.isArray(traductions)) {
      throw new Error("Les traductions doivent être une liste");
    }
    this.id = id;
    this.traductions = traductions.map((traduction) =>
      traduction instanceof CentreInteretTraduction
        ? traduction
        : new CentreInteretTraduction(traduction),
    );
  }

  toJSON() {
    return { id: this.id, traductions: this.traductions };
  }
}
