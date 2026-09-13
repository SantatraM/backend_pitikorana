import LienAvecFalimanjakaTraduction from "./LienAvecFalimanjakaTraduction.js";

export default class LienAvecFalimanjaka {
  constructor({ id = null, traductions = [] }) {
    this.id = id;
    this.traductions = traductions;
  }

  get id() {
    return this._id;
  }

  set id(valeur) {
    this._id = valeur;
  }

  get traductions() {
    return this._traductions;
  }

  set traductions(valeur) {
    if (!Array.isArray(valeur)) {
      throw new Error("Les traductions doivent être une liste");
    }

    this._traductions = valeur.map((traduction) =>
      traduction instanceof LienAvecFalimanjakaTraduction
        ? traduction
        : new LienAvecFalimanjakaTraduction(traduction),
    );
  }
}
