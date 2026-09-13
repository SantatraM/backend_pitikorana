import Region from "./Region.js";

export default class Ville {
    constructor({ id = null, nom, id_region = null, region = null }) {
        this.id = id;
        this.nom = nom;
        this.id_region = id_region;
        this.region = region;
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
        throw new Error("Le nom de la ville est obligatoire");
        }

        if (valeur.trim().length > 100) {
        throw new Error("Le nom de la ville ne doit pas dépasser 100 caractères");
        }

        this._nom = valeur.trim();
    }

    get id_region() {
        return this._id_region;
    }

    set id_region(valeur) {
        this._id_region = valeur;
    }

    get region() {
        return this._region;
    }

    set region(valeur) {
        if (valeur === null) {
            this._region = null;
            return;
        }

        if (valeur instanceof Region) {
            this._region = valeur;
            return;
        }

        this._region = new Region(valeur);
    }
}
