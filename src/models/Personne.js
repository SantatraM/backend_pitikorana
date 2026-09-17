const text = (v, n, m) => {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || v.trim().length > m)
    throw new Error(`${n} invalide`);
  return v.trim() || null;
};
const year = (v, n) => {
  if (v == null || v === "") return null;
  v = Number(v);
  if (!Number.isInteger(v) || v < 1800 || v > 2100)
    throw new Error(`${n} invalide`);
  return v;
};
const date = (v, n) => {
  if (v == null || v === "") return null;

  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) throw new Error(`${n} invalide`);
    v = `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(
      v.getDate(),
    ).padStart(2, "0")}`;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    Number.isNaN(Date.parse(`${v}T00:00:00Z`))
  )
    throw new Error(`${n} invalide`);
  return v;
};
export default class Personne {
  constructor(d) {
    this.id = d.id ?? null;
    this.nom = text(d.nom, "nom", 100);
    if (!this.nom) throw new Error("Le nom est obligatoire");
    for (const [k, m] of [
      ["prenom", 100],
      ["nom_usage", 100],
      ["autres_appellations", 255],
      ["lieu_naissance", 150],
      ["adresse", 255],
    ])
      this[k] = text(d[k], k, m);
    this.date_naissance = date(d.date_naissance, "date_naissance");
    this.date_deces = date(d.date_deces, "date_deces");
    this.annee_naissance = year(d.annee_naissance, "annee_naissance");
    this.annee_deces = year(d.annee_deces, "annee_deces");

    if (
      this.annee_naissance &&
      this.annee_deces &&
      this.annee_deces < this.annee_naissance
    )
      throw new Error(
        "L'année de décès ne peut pas être antérieure à l'année de naissance",
      );

    if (
      this.date_naissance &&
      this.date_deces &&
      this.date_deces < this.date_naissance
    )
      throw new Error(
        "La date de décès ne peut pas être antérieure à la date de naissance",
      );

    if (
      this.date_naissance &&
      this.annee_naissance &&
      Number(this.date_naissance.slice(0, 4)) !== this.annee_naissance
    )
      throw new Error(
        "L'année de naissance ne correspond pas à la date de naissance",
      );

    if (
      this.date_deces &&
      this.annee_deces &&
      Number(this.date_deces.slice(0, 4)) !== this.annee_deces
    )
      throw new Error(
        "L'année de décès ne correspond pas à la date de décès",
      );

    for (const k of [
      "id_sexe",
      "id_statut",
      "id_ville",
      "id_lien",
      "id_element",
    ])
      this[k] = d[k] || null;
    for (const k of [
      "sexe",
      "statut",
      "lien",
      "ville",
      "element",
      "razambe",
      "taranaka",
      "sampana",
      "contact",
      "photo",
    ])
    this[k] = d[k] ?? null;
  }
}
