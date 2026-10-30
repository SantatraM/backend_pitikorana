import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const migrationPath = resolve("database/22_fandraisan_anjara_v1.sql");
const migration = await readFile(migrationPath, "utf8");

function includesAll(...parts) {
  for (const part of parts) assert.match(migration, new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
}

test("migration crée uniquement les trois tables Fandraisan'anjara dans une transaction", () => {
  includesAll(
    "begin;",
    "Une table Fandraisan''anjara existe déjà",
    "create table fandraisan_anjara (",
    "create table fandraisan_anjara_ligne (",
    "create table fandraisan_anjara_historique (",
    "commit;",
  );
  assert.doesNotMatch(migration, /\b(?:alter|update|delete|insert)\s+(?:table\s+)?(?:don|journee_alahadin_taranaka)\b/i);
});

test("contributeur, snapshots, annulation et révision sont contraints", () => {
  includesAll(
    "'RAZAMBE', 'TARANAKA', 'SAMPANA', 'FOYER', 'PERSONNE'",
    "fandraisan_anjara_contributeur_check",
    "fandraisan_anjara_contributeur_libelle_snapshot_check",
    "btrim(contributeur_libelle_snapshot) <> ''",
    "resolution_razambe = 'RESOLU'",
    "resolution_razambe = 'NON_DETERMINE'",
    "fandraisan_anjara_snapshots_hierarchie_check",
    "id_taranaka_snapshot is null or id_razambe_snapshot is not null",
    "id_sampana_snapshot is null or id_taranaka_snapshot is not null",
    "statut in ('ACTIF', 'ANNULE')",
    "revision integer not null default 1",
    "revision > 0",
    "motif_annulation is not null",
    "btrim(motif_annulation) <> ''",
  );
  for (const table of ["element", "foyer", "personne", "compte_membre"]) {
    assert.match(migration, new RegExp(`references ${table}\\(id\\) on delete (?:restrict|set null)`, "i"));
  }
});

test("lignes argent et matériel empêchent les données incohérentes", () => {
  includesAll(
    "nature in ('ARGENT', 'MATERIEL')",
    "montant numeric(14, 0) null",
    "fandraisan_anjara_ligne_montant_entier_check",
    "montant is null or montant = trunc(montant)",
    "montant > 0",
    "devise = 'MGA'",
    "quantite > 0",
    "btrim(designation) <> ''",
    "btrim(unite) <> ''",
    "unique (id_fandraisan_anjara, ordre)",
  );
});

test("historique, index et garanties reportées au service sont documentés", () => {
  includesAll(
    "action in ('CREATION', 'CORRECTION', 'ANNULATION')",
    "fandraisan_anjara_historique_motif_check",
    "action = 'CREATION'",
    "or (commentaire is not null and btrim(commentaire) <> '')",
    "id_compte_acteur uuid not null",
    "fandraisan_anjara_razambe_actif_date_idx",
    "fandraisan_anjara_historique_contribution_date_idx",
    "au moins une ligne par contribution",
    "date_contribution <= current_date",
    "v_element_hierarchie",
  );
  assert.doesNotMatch(migration, /current_date\s*\)/i, "La date future ne doit pas être une contrainte SQL volatile.");
});
