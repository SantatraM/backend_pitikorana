import StatutTraduction from "./StatutTraduction.js";

export default class Statut {
  constructor({ id = null, traductions = [] }) {
    this.id = id;
    this.traductions = traductions;
  }
  get id() {
    return this._id;
  }
  set id(value) {
    this._id = value;
  }
  get traductions() {
    return this._traductions;
  }
  set traductions(value) {
    if (!Array.isArray(value))
      throw new Error("Les traductions doivent être une liste");
    this._traductions = value.map((item) =>
      item instanceof StatutTraduction ? item : new StatutTraduction(item),
    );
  }
}
