import test from "node:test";
import assert from "node:assert/strict";
import { resolveContributeurFandraisanAnjara } from "../src/services/fandraisanAnjara.service.js";

const ids = {
  razambe: "11111111-1111-4111-8111-111111111111",
  taranaka: "22222222-2222-4222-8222-222222222222",
  sampana: "33333333-3333-4333-8333-333333333333",
  personne1: "44444444-4444-4444-8444-444444444444",
  personne2: "55555555-5555-4555-8555-555555555555",
  foyer: "66666666-6666-4666-8666-666666666666",
};

function person(id, { razambe = ids.razambe, taranaka = ids.taranaka, sampana = ids.sampana } = {}) {
  return { id, nom: id === ids.personne1 ? "Rabe" : "Rasoa", prenom: id === ids.personne1 ? "Jean" : "Marie", id_element: "element", id_razambe: razambe, id_taranaka: taranaka, id_sampana: sampana };
}

function mockDb({ elements = {}, hierarchies = {}, personnes = {}, foyer = null, failure = null } = {}) {
  return { async query(sql, params) {
    if (failure) throw failure;
    const id = params?.[0];
    if (sql.includes("FROM element e")) return { rows: elements[id] ? [elements[id]] : [] };
    if (sql.includes("FROM v_element_hierarchie")) return { rows: hierarchies[id] ? [hierarchies[id]] : [] };
    if (sql.includes("FROM personne p")) return { rows: personnes[id] ? [personnes[id]] : [] };
    if (sql.includes("FROM foyer f")) return { rows: foyer?.id === id ? [foyer] : [] };
    throw new Error(`Requête inattendue: ${sql}`);
  } };
}

test("résout Razambe, Taranaka et Sampana avec leur type réel", async () => {
  const elements = {
    [ids.razambe]: { id: ids.razambe, nom: "Razambe A", code: "RAZAMBE" },
    [ids.taranaka]: { id: ids.taranaka, nom: "Taranaka A", code: "TARANAKA" },
    [ids.sampana]: { id: ids.sampana, nom: "Sampana A", code: "SAMPANA" },
  };
  const hierarchies = {
    [ids.taranaka]: { id_razambe: ids.razambe, id_taranaka: ids.taranaka, id_sampana: null },
    [ids.sampana]: { id_razambe: ids.razambe, id_taranaka: ids.taranaka, id_sampana: ids.sampana },
  };
  const db = mockDb({ elements, hierarchies });
  assert.deepEqual(await resolveContributeurFandraisanAnjara("RAZAMBE", ids.razambe, db), { type_contributeur: "RAZAMBE", id_contributeur: ids.razambe, contributeur: { type: "RAZAMBE", id: ids.razambe }, contributeur_libelle_snapshot: "Razambe A", id_razambe_snapshot: ids.razambe, id_taranaka_snapshot: null, id_sampana_snapshot: null, resolution_razambe: "RESOLU" });
  assert.equal((await resolveContributeurFandraisanAnjara("TARANAKA", ids.taranaka, db)).id_razambe_snapshot, ids.razambe);
  assert.equal((await resolveContributeurFandraisanAnjara("SAMPANA", ids.sampana, db)).id_sampana_snapshot, ids.sampana);
});

test("personne rattachée est résolue, personne sans rattachement est non déterminée", async () => {
  const db = mockDb({ personnes: { [ids.personne1]: person(ids.personne1), [ids.personne2]: person(ids.personne2, { razambe: null, taranaka: null, sampana: null }) } });
  assert.equal((await resolveContributeurFandraisanAnjara("PERSONNE", ids.personne1, db)).resolution_razambe, "RESOLU");
  assert.deepEqual(await resolveContributeurFandraisanAnjara("PERSONNE", ids.personne2, db), { type_contributeur: "PERSONNE", id_contributeur: ids.personne2, contributeur: { type: "PERSONNE", id: ids.personne2 }, contributeur_libelle_snapshot: "Rasoa Marie", id_razambe_snapshot: null, id_taranaka_snapshot: null, id_sampana_snapshot: null, resolution_razambe: "NON_DETERMINE" });
});

test("foyer monoparental et couple au même Razambe sont résolus sans inventer les niveaux divergents", async () => {
  const mono = { id: ids.foyer, type_foyer: "MONOPARENTAL", id_personne_1: ids.personne1, id_personne_2: null, personne_1_nom: "Rabe", personne_1_prenom: "Jean", personne_2_nom: null, personne_2_prenom: null };
  const monoDb = mockDb({ foyer: mono, personnes: { [ids.personne1]: person(ids.personne1) } });
  assert.equal((await resolveContributeurFandraisanAnjara("FOYER", ids.foyer, monoDb)).id_sampana_snapshot, ids.sampana);
  const couple = { ...mono, type_foyer: "COUPLE", id_personne_2: ids.personne2, personne_2_nom: "Rasoa", personne_2_prenom: "Marie" };
  const sameHierarchyDb = mockDb({ foyer: couple, personnes: { [ids.personne1]: person(ids.personne1), [ids.personne2]: person(ids.personne2) } });
  const sameHierarchy = await resolveContributeurFandraisanAnjara("FOYER", ids.foyer, sameHierarchyDb);
  assert.equal(sameHierarchy.id_taranaka_snapshot, ids.taranaka);
  assert.equal(sameHierarchy.id_sampana_snapshot, ids.sampana);
  const coupleDb = mockDb({ foyer: couple, personnes: { [ids.personne1]: person(ids.personne1), [ids.personne2]: person(ids.personne2, { taranaka: "77777777-7777-4777-8777-777777777777", sampana: "88888888-8888-4888-8888-888888888888" }) } });
  const resolved = await resolveContributeurFandraisanAnjara("FOYER", ids.foyer, coupleDb);
  assert.equal(resolved.resolution_razambe, "RESOLU"); assert.equal(resolved.id_razambe_snapshot, ids.razambe); assert.equal(resolved.id_taranaka_snapshot, null); assert.equal(resolved.id_sampana_snapshot, null);
});

test("foyer couple divergent ou indéterminé reste non déterminé", async () => {
  const foyer = { id: ids.foyer, type_foyer: "COUPLE", id_personne_1: ids.personne1, id_personne_2: ids.personne2, personne_1_nom: "Rabe", personne_1_prenom: "Jean", personne_2_nom: "Rasoa", personne_2_prenom: "Marie" };
  for (const second of [person(ids.personne2, { razambe: "77777777-7777-4777-8777-777777777777" }), person(ids.personne2, { razambe: null, taranaka: null, sampana: null })]) {
    const db = mockDb({ foyer, personnes: { [ids.personne1]: person(ids.personne1), [ids.personne2]: second } });
    assert.equal((await resolveContributeurFandraisanAnjara("FOYER", ids.foyer, db)).resolution_razambe, "NON_DETERMINE");
  }
});

test("erreurs métier et erreurs PostgreSQL ne sont pas masquées", async () => {
  await assert.rejects(resolveContributeurFandraisanAnjara("INCONNU", ids.razambe, mockDb()), { code: "FANDRAISAN_ANJARA_CONTRIBUTEUR_INVALID" });
  await assert.rejects(resolveContributeurFandraisanAnjara("RAZAMBE", "invalide", mockDb()), { code: "FANDRAISAN_ANJARA_CONTRIBUTEUR_INVALID" });
  await assert.rejects(resolveContributeurFandraisanAnjara("PERSONNE", ids.personne1, mockDb()), { code: "FANDRAISAN_ANJARA_CONTRIBUTEUR_NOT_FOUND" });
  await assert.rejects(resolveContributeurFandraisanAnjara("TARANAKA", ids.taranaka, mockDb({ elements: { [ids.taranaka]: { id: ids.taranaka, nom: "Mauvais", code: "SAMPANA" } } })), { code: "FANDRAISAN_ANJARA_CONTRIBUTEUR_INVALID" });
  await assert.rejects(resolveContributeurFandraisanAnjara("SAMPANA", ids.sampana, mockDb({ elements: { [ids.sampana]: { id: ids.sampana, nom: "S", code: "SAMPANA" } }, hierarchies: { [ids.sampana]: { id_razambe: null, id_taranaka: null, id_sampana: ids.sampana } } })), { code: "FANDRAISAN_ANJARA_RATTACHEMENT_INVALID" });
  const failure = Object.assign(new Error("connexion indisponible"), { code: "ECONNRESET" });
  await assert.rejects(resolveContributeurFandraisanAnjara("PERSONNE", ids.personne1, mockDb({ failure })), failure);
});
