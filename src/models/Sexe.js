import SexeTraduction from "./SexeTraduction.js";

export default class Sexe {
  constructor({ id = null, code = null, traductions = [] }) {
    this.id = id;
    this.code = code;
    this.traductions = traductions;
  }
  get id() {
    return this._id;
  }
  set id(value) {
    this._id = value;
  }
  get code() {
    return this._code;
  }
  set code(value) {
    this._code = value;
  }
  get traductions() {
    return this._traductions;
  }
  set traductions(value) {
    if (!Array.isArray(value))
      throw new Error("Les traductions doivent être une liste");
    this._traductions = value.map((item) =>
      item instanceof SexeTraduction ? item : new SexeTraduction(item),
    );
  }

  toJSON() {
    return {
      id: this.id,
      code: this.code,
      traductions: this.traductions.map((traduction) => ({
        id: traduction.id,
        id_sexe: traduction.id_sexe,
        id_langue: traduction.id_langue,
        libelle: traduction.libelle,
        langue: traduction.langue
          ? {
              id: traduction.langue.id,
              code: traduction.langue.code,
              nom: traduction.langue.nom,
            }
          : null,
      })),
    };
  }
}
