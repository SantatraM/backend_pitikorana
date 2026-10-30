import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const migration = await readFile(resolve("database/23_fandraisan_anjara_idempotence.sql"), "utf8");

test("la migration d'idempotence est transactionnelle et échoue si la table existe", () => {
  assert.match(migration, /begin;/i);
  assert.match(migration, /to_regclass\('public\.fandraisan_anjara_idempotence'\)/i);
  assert.match(migration, /raise exception/i);
  assert.match(migration, /commit;/i);
});

test("la réservation est unique par compte et clé, et référence une contribution", () => {
  assert.match(migration, /primary key\s*\(id_compte_createur, cle_idempotence\)/i);
  assert.match(migration, /references compte_membre\(id\)\s*on delete restrict/i);
  assert.match(migration, /references fandraisan_anjara\(id\)\s*on delete restrict\s*deferrable initially deferred/i);
  assert.match(migration, /unique\s*\(id_fandraisan_anjara\)/i);
  assert.match(migration, /empreinte_contenu varchar\(64\) not null/i);
  assert.match(migration, /\^\[0-9a-f\]\{64\}\$/i);
});

test("la migration ne modifie aucune table métier existante", () => {
  assert.doesNotMatch(migration, /\b(?:alter|update|delete|insert)\s+(?:table\s+)?fandraisan_anjara\b/i);
  assert.doesNotMatch(migration, /\b(?:don|journee_alahadin_taranaka)\b/i);
});
