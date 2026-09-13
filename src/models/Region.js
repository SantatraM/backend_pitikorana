import Pays from "./Pays.js";

export default class Region {
    constructor({ id = null, nom, id_pays = null, pays = null }) {
        this.id = id;
        this.nom = nom;
        this.id_pays = id_pays;
        this.pays = pays;
    }

    get id() {
        return this._id;
    }

    set id(valeur) {
        this._id = valeur;
    }

    get nom() {
        return this._nom;
    }

    set nom(valeur) {
        if (!valeur || valeur.trim() === "") {
            throw new Error("Le nom de la région est obligatoire");
        }

        if (valeur.trim().length > 100) {
            throw new Error(
                "Le nom de la région ne doit pas dépasser 100 caractères",
            );
        }

        this._nom = valeur.trim();
    }

    get id_pays() {
        return this._id_pays;
    }

    set id_pays(valeur) {
        this._id_pays = valeur;
    }

    get pays() {
        return this._pays;
    }

    set pays(valeur) {
        if (valeur === null) {
            this._pays = null;
            return;
        }

        if (valeur instanceof Pays) {
            this._pays = valeur;
            return;
        }

        this._pays = new Pays(valeur);
    }
}
